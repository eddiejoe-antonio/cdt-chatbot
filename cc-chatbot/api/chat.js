// api/chat.js — Vercel serverless function for POST /api/chat
const fs        = require('fs');
const readline  = require('readline');
const path      = require('path');
const { parse } = require('csv-parse/sync');
const { SERVICES } = require('../services');

// ─── Load plans_with_tech.csv at cold start ───────────────────────────────────

let plansData = [];
try {
  const raw = fs.readFileSync(path.join(process.cwd(), 'public', 'plans_with_tech.csv'));
  plansData  = parse(raw, { columns: true, skip_empty_lines: true, trim: true });
  console.log(`Loaded ${plansData.length} plans`);
} catch (err) {
  console.error('Error loading plans_with_tech.csv:', err.message);
}

// ─── Haversine distance (miles) ───────────────────────────────────────────────

const haversineMiles = (lat1, lon1, lat2, lon2) => {
  const R    = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
             + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
             * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ─── Geocode via Nominatim ────────────────────────────────────────────────────

const geocodeAddress = async (addr, city, state, zip) => {
  const parts = [addr, city, `${state} ${zip}`.trim()].filter(Boolean);
  const q     = encodeURIComponent(parts.join(', '));
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=us`;
  try {
    const res  = await fetch(url, { headers: { 'User-Agent': 'ClarkCountyBroadbandChatbot/1.0' } });
    const data = await res.json();
    if (data.length > 0) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch (e) {
    console.error('[geocode] error:', e.message);
  }
  return null;
};

// ─── Services lookup ──────────────────────────────────────────────────────────

const getServicesNearAddress = (userLat, userLon) => {
  const national = SERVICES.filter(s => s.lat === null);
  const withDist = SERVICES.filter(s => s.lat !== null).map(s => ({
    ...s,
    distanceMiles: haversineMiles(userLat, userLon, s.lat, s.long),
  })).sort((a, b) => a.distanceMiles - b.distanceMiles);

  return {
    within1  : withDist.filter(s => s.distanceMiles <= 1),
    within5  : withDist.filter(s => s.distanceMiles > 1  && s.distanceMiles <= 5),
    within10 : withDist.filter(s => s.distanceMiles > 5  && s.distanceMiles <= 10),
    national,
  };
};

// ─── CSV parsing ──────────────────────────────────────────────────────────────

const parseCSVLine = (line) => {
  const result = [];
  let cur = '', inQ = false;
  for (const ch of line) {
    if      (ch === '"')         { inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur); cur = ''; }
    else                         { cur += ch; }
  }
  result.push(cur);
  return result;
};

// ─── Address normalisation ────────────────────────────────────────────────────

const STREET_ABBREVS = {
  AVENUE: 'AVE', STREET: 'ST', BOULEVARD: 'BLVD', DRIVE: 'DR',
  ROAD: 'RD', LANE: 'LN', COURT: 'CT', PLACE: 'PL', CIRCLE: 'CIR',
  HIGHWAY: 'HWY', PARKWAY: 'PKWY', SQUARE: 'SQ', LOOP: 'LOOP',
  NORTH: 'N', SOUTH: 'S', EAST: 'E', WEST: 'W',
};

const normalizeAddr = (str) => {
  let s = (str || '').toUpperCase().replace(/[.,#]/g, '').replace(/\s+/g, ' ').trim();
  for (const [full, abbr] of Object.entries(STREET_ABBREVS)) {
    s = s.replace(new RegExp(`\\b${full}\\b`, 'g'), abbr);
  }
  return s;
};

const normalizeCity = (str) =>
  (str || '').toUpperCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();

const stripDirectional = (addr) => {
  const m = addr.match(/^(\d+)\s+(N|S|E|W)\s+(.+)$/);
  return m ? `${m[1]} ${m[3]}` : null;
};

// ─── Address extraction ───────────────────────────────────────────────────────

const SUFFIX_PAT = '(?:STREET|AVENUE|BOULEVARD|DRIVE|ROAD|LANE|COURT|PLACE|CIRCLE|HIGHWAY|PARKWAY|SQUARE|ST|AVE|BLVD|DR|RD|LN|CT|WAY|PL|CIR|HWY|PKWY|LOOP|SQ)';
const ADDR_RE          = new RegExp(`(\\d+[\\w\\s.#-]+?\\b${SUFFIX_PAT}\\.?)[\\s,]+([A-Za-z][A-Za-z\\s]+?)[\\s,]+\\b([A-Za-z]{2})\\b(?:[\\s,]+(\\d{5}))?`, 'i');
const CITY_NO_STATE_RE = new RegExp(`(\\d+[\\w\\s.#-]+?\\b${SUFFIX_PAT}\\.?)[\\s,]+([A-Za-z][A-Za-z\\s]+?)\\s*$`, 'i');
const BARE_ADDR_RE     = new RegExp(`(\\d+[\\w\\s.#-]+?\\b${SUFFIX_PAT}\\.?)\\s*$`, 'i');

const extractAddress = (text) => {
  // Full: "123 Main St, Henderson, NV 89002"
  const m = text.match(ADDR_RE);
  if (m) {
    const addr = normalizeAddr(m[1]);
    return { addr, addrAlt: stripDirectional(addr), city: normalizeCity(m[2]), state: m[3].toUpperCase(), zip: m[4] || '' };
  }
  // Street + city, no state: "123 Main St, Henderson" — assume NV
  const mc = text.match(CITY_NO_STATE_RE);
  if (mc) {
    const addr = normalizeAddr(mc[1]);
    return { addr, addrAlt: stripDirectional(addr), city: normalizeCity(mc[2]), state: 'NV', zip: '' };
  }
  // Street only — search without city filter
  const bare = text.match(BARE_ADDR_RE);
  if (bare) {
    const addr = normalizeAddr(bare[1]);
    return { addr, addrAlt: stripDirectional(addr), city: null, state: 'NV', zip: '' };
  }
  return null;
};

// ─── Points CSV — fetch from S3 into /tmp, cache across warm invocations ──────

const POINTS_S3_URL = 'https://clark-county.s3.us-east-1.amazonaws.com/points.csv';
const TMP_POINTS    = '/tmp/points.csv';

let _pointsPathPromise = null;

const getPointsCSVPath = () => {
  if (_pointsPathPromise) return _pointsPathPromise;
  _pointsPathPromise = (async () => {
    if (fs.existsSync(TMP_POINTS)) return TMP_POINTS;
    console.log('[points.csv] Downloading from S3…');
    const res = await fetch(POINTS_S3_URL);
    if (!res.ok) throw new Error(`S3 fetch failed: ${res.status}`);
    const { Readable } = require('stream');
    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(TMP_POINTS);
      Readable.fromWeb(res.body).pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    console.log('[points.csv] Saved to /tmp/points.csv');
    return TMP_POINTS;
  })().catch(err => {
    _pointsPathPromise = null; // allow retry on next request
    throw err;
  });
  return _pointsPathPromise;
};

// ─── Points CSV stream search ─────────────────────────────────────────────────

const searchPointsCSV = async ({ addr, addrAlt, city, state, zip }) => {
  let csvPath;
  try { csvPath = await getPointsCSVPath(); } catch { return null; }
  if (!csvPath || !fs.existsSync(csvPath)) return null;
  return new Promise((resolve) => {

    const rl = readline.createInterface({ input: fs.createReadStream(csvPath), crlfDelay: Infinity });
    let headers = null, found = null, done = false;

    rl.on('line', (line) => {
      if (done) return;
      if (!headers) { headers = parseCSVLine(line).map(h => h.replace(/"/g, '').trim()); return; }

      const scanTarget = addrAlt || addr;
      if (!line.toUpperCase().includes(scanTarget)) return;

      const values    = parseCSVLine(line);
      const row       = Object.fromEntries(headers.map((h, i) => [h, (values[i] || '').replace(/"/g, '').trim()]));
      const rowAddr   = normalizeAddr(row.ADDR);
      const rowCity   = normalizeCity(row.CITY);
      const rowState  = (row.STATE || '').toUpperCase();
      const rowZip    = (row.ZIP  || '').replace(/"/g, '').trim();
      const candidates    = [addr, addrAlt].filter(Boolean);
      const addrMatch     = candidates.some(a => rowAddr === a || rowAddr.startsWith(a + ' '));
      const stateMatch    = rowState === state;
      const cityMatch     = !city || rowCity === city;
      const zipMatch      = zip && rowZip === zip;
      const locationMatch = stateMatch && (cityMatch || zipMatch);

      if (addrMatch && locationMatch) { found = row; done = true; rl.close(); }
    });

    rl.on('close', () => resolve(found));
    rl.on('error', () => resolve(null));
  });
};

// ─── Plan matching ────────────────────────────────────────────────────────────

const parseTechRules = (techrules) => {
  if (!techrules) return new Set();
  return new Set(techrules.split(';').map(p => p.trim().split(':')[0].trim()).filter(Boolean));
};

const matchPlans = (brandnames, techsAtAddress, bldType) => {
  if (!brandnames) return [];
  const targetServiceType = bldType === 'R' ? 'Residential' : 'Commercial';
  const brands = brandnames.split(/;\s*/).map(b => b.trim().toLowerCase()).filter(Boolean);

  return plansData
    .filter(plan => {
      const provider = (plan['Providers'] || '').toLowerCase();
      if (!brands.some(b => provider.includes(b) || b.includes(provider))) return false;
      const serviceTypes = new Set((plan['Service Type'] || '').split(',').map(s => s.trim()));
      if (!serviceTypes.has(targetServiceType)) return false;
      const planTechs = (plan['Technology'] || '').split(',').map(t => t.trim()).filter(Boolean);
      return planTechs.some(t => techsAtAddress.has(t));
    })
    .map(plan => {
      const dl = parseFloat(plan[' Download Speed (Mbps) ']) || 0;
      const ul = parseFloat(plan[' Upload Speed (Mbps) '])   || 0;
      return {
        planName      : plan['Plan Name']                          || '',
        provider      : plan['Providers']                          || '',
        technology    : (plan['Technology'] || '').trim()          || 'Unknown',
        price         : plan['Full Monthly Price']                  || '',
        introDiscount : plan['Intro Discount']                      || '',
        introPeriod   : plan['Intro Period (months)']               || '',
        downloadMbps  : plan[' Download Speed (Mbps) ']            || '',
        uploadMbps    : plan[' Upload Speed (Mbps) ']              || '',
        dataCap       : plan['Data Cap? (Y/N)']                     || '',
        dataCapGB     : plan['Data Cap (GB)']                       || '',
        contract      : plan['Contract Required? (Y/N)']            || '',
        contractMonths: plan['Contract Length (months)']            || '',
        otherFees     : plan['Other Monthly Fees (Total Est.)']     || '',
        otherFeesNote : plan['Other Monthly Fees (Notes)']          || '',
        installFee    : plan['Installation Fees']                   || '',
        etf           : plan['Early Termination Fee? (Y/N)']        || '',
        lowIncome     : plan['Low-Income Plan? (Y/N)']              || '',
        liDiscount    : plan['Low-Income Discount ($)']             || '',
        meetsThreshold: dl >= 100 && ul >= 25,
      };
    });
};

const groupPlans = (matched) => {
  if (!matched.length) return null;
  const threshold  = matched.filter(p => p.meetsThreshold);
  const byProvider = {};
  for (const plan of matched.filter(p => !p.meetsThreshold)) {
    const key = plan.provider.trim() || 'Other';
    if (!byProvider[key]) byProvider[key] = [];
    byProvider[key].push(plan);
  }
  return { threshold, byProvider };
};

// ─── Text formatters for Claude context ──────────────────────────────────────

const formatPlan = (p) => {
  const lines = [`  • ${p.provider} — ${p.planName} [${p.technology}]`];
  if (p.downloadMbps || p.uploadMbps) lines.push(`    Speed: ${p.downloadMbps} Mbps ↓ / ${p.uploadMbps} Mbps ↑`);
  if (p.price) {
    const intro = p.introDiscount && p.introDiscount.trim() !== '$0'
      ? ` (intro: ${p.introDiscount} off for ${p.introPeriod} mo)` : '';
    lines.push(`    Price: ${p.price}/mo${intro}`);
  }
  if (p.otherFees && p.otherFees.trim() !== '$0') lines.push(`    Other fees: ${p.otherFees}/mo`);
  if (p.dataCap === 'Yes' && p.dataCapGB)          lines.push(`    Data cap: ${p.dataCapGB} GB`);
  if (p.contract === 'No')                         lines.push(`    No contract required`);
  if (p.lowIncome === 'Yes')                       lines.push(`    ✓ Low-income plan — discount: ${p.liDiscount}`);
  if (p.meetsThreshold)                            lines.push(`    ✓ Meets 100/25 Mbps threshold`);
  return lines.join('\n');
};

const formatService = (s) => {
  const dist = s.distanceMiles !== undefined ? ` (${s.distanceMiles.toFixed(1)} mi)` : '';
  return `  • ${s.name}${dist} | ${s.type} | ${s.phone || 'no phone'} | ${s.address}\n    ${s.description}`;
};

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a caseworker assistant helping people find internet service options and digital inclusion resources in Clark County, Nevada.

When a user provides an address you will receive:
1. Broadband data from the FCC database and matched internet plans
2. Nearby digital inclusion services (within 1 mile, 1–5 miles, 5–10 miles, and national/virtual programs)

Use this data to give a concise, helpful response:
- Confirm the address and best available technology
- Note provider competition (number of fixed providers)
- Tell the user that plans meeting 100/25 Mbps threshold are highlighted; note any low-income or no-contract options
- Briefly mention the services available nearby, grouped by distance tier. National/virtual programs are always available.
- Be concise. The UI renders full plan tables and service cards — don't repeat every detail yourself.

If no address is found in the database, say so and suggest checking broadbandmap.fcc.gov or calling 211.`;

// ─── Handler ──────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages } = req.body;
    const userMessage  = messages[messages.length - 1].content;

    let contextBlock  = '';
    let planGroups    = null;
    let serviceGroups = null;

    const parsed = extractAddress(userMessage);
    console.log('[debug] parsed:', JSON.stringify(parsed));

    if (parsed) {
      const [row, geoResult] = await Promise.all([
        searchPointsCSV(parsed),
        geocodeAddress(parsed.addr, parsed.city, parsed.state, parsed.zip),
      ]);
      console.log('[debug] CSV row:', row ? row.ADDR : 'null');
      console.log('[debug] geocode:', geoResult);

      if (row) {
        const techsAtAddress = parseTechRules(row.TECHRULES);
        const matched        = matchPlans(row.BRANDNAMES, techsAtAddress, row.BLD_TYPE);
        planGroups = groupPlans(matched);

        const plansText = matched.length > 0
          ? `AVAILABLE PLANS (${matched.length} total, ${matched.filter(p => p.meetsThreshold).length} meet 100/25 threshold):\n` +
            matched.map(formatPlan).join('\n\n')
          : `AVAILABLE PLANS: No plan records found for providers: ${row.BRANDNAMES}`;

        const userLat = geoResult?.lat ?? parseFloat(row.LATITUDE) ?? null;
        const userLon = geoResult?.lon ?? parseFloat(row.LONGITUDE) ?? null;

        serviceGroups = (userLat && userLon)
          ? getServicesNearAddress(userLat, userLon)
          : { within1: [], within5: [], within10: [], national: SERVICES.filter(s => s.lat === null) };

        const servicesText = [
          serviceGroups.within1.length  > 0 ? `SERVICES WITHIN 1 MILE (${serviceGroups.within1.length}):\n${serviceGroups.within1.map(formatService).join('\n')}` : 'SERVICES WITHIN 1 MILE: None',
          serviceGroups.within5.length  > 0 ? `SERVICES 1–5 MILES (${serviceGroups.within5.length}):\n${serviceGroups.within5.map(formatService).join('\n')}` : 'SERVICES 1–5 MILES: None',
          serviceGroups.within10.length > 0 ? `SERVICES 5–10 MILES (${serviceGroups.within10.length}):\n${serviceGroups.within10.map(formatService).join('\n')}` : 'SERVICES 5–10 MILES: None',
          `NATIONAL / VIRTUAL PROGRAMS (${serviceGroups.national.length}):\n${serviceGroups.national.map(formatService).join('\n')}`,
        ].join('\n\n');

        contextBlock = `\n\n## Data for this query
ADDRESS: ${row.ADDR}, ${row.CITY}, ${row.STATE} ${row.ZIP}
Building type: ${row.BLD_TYPE === 'R' ? 'Residential' : 'Commercial'}
Providers at this address: ${row.BRANDNAMES}
Best available technology: ${row.TECHBEST}
Technologies available: ${[...techsAtAddress].join(', ')}
Max speeds: ${row.MAX_DL} Mbps ↓ / ${row.MAX_UL} Mbps ↑
Fixed providers: ${row.FIXEDCNT}
Competition status: ${row.CSCHOICE}

${plansText}

${servicesText}`;

      } else {
        contextBlock  = `\n\n## Data for this query\nADDRESS NOT FOUND: "${parsed.addr}, ${parsed.city}, ${parsed.state}" did not match any record in the FCC broadband database.`;
        serviceGroups = { within1: [], within5: [], within10: [], national: SERVICES.filter(s => s.lat === null) };
      }
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method  : 'POST',
      headers : {
        'Content-Type'      : 'application/json',
        'x-api-key'         : process.env.ANTHROPIC_API_KEY,
        'anthropic-version' : '2023-06-01',
      },
      body: JSON.stringify({
        model     : 'claude-sonnet-4-6',
        max_tokens: 1024,
        system    : SYSTEM_PROMPT + contextBlock,
        messages  : messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'API request failed');

    res.json({ message: data.content[0].text, planGroups, serviceGroups });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
};

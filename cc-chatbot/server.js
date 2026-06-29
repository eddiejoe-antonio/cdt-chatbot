// server.js
const express   = require('express');
const cors      = require('cors');
const fs        = require('fs');
const readline  = require('readline');
const path      = require('path');
const { parse } = require('csv-parse/sync');
const { SERVICES } = require('./services');
require('dotenv').config();

const app  = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// ─── Load plans_with_tech.csv at startup ──────────────────────────────────────

let plansData = [];
try {
  const raw = fs.readFileSync(path.join(__dirname, 'public', 'plans_with_tech.csv'));
  plansData  = parse(raw, { columns: true, skip_empty_lines: true, trim: true });
  console.log(`Loaded ${plansData.length} plans`);
} catch (err) {
  console.error('Error loading plans_with_tech.csv:', err.message);
}

// ─── Haversine distance (miles) ───────────────────────────────────────────────

const haversineMiles = (lat1, lon1, lat2, lon2) => {
  const R  = 3958.8; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a   = Math.sin(dLat / 2) ** 2
            + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
            * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ─── Geocode address via Nominatim ────────────────────────────────────────────
// Free, no API key. Rate-limited to 1 req/sec — fine for this use case.

const geocodeAddress = async (addr, city, state, zip) => {
  const q = encodeURIComponent(`${addr}, ${city}, ${state} ${zip}`.trim());
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=us`;
  try {
    const res  = await fetch(url, { headers: { 'User-Agent': 'ClarkCountyBroadbandChatbot/1.0' } });
    const data = await res.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
  } catch (e) {
    console.error('[geocode] error:', e.message);
  }
  return null;
};

// ─── Services lookup by distance ─────────────────────────────────────────────
// Returns { within1, within5, within10, national }
// national = lat:null entries, always included

const getServicesNearAddress = (userLat, userLon) => {
  const national = SERVICES.filter(s => s.lat === null);
  const local    = SERVICES.filter(s => s.lat !== null);

  const withDist = local.map(s => ({
    ...s,
    distanceMiles: haversineMiles(userLat, userLon, s.lat, s.long),
  })).sort((a, b) => a.distanceMiles - b.distanceMiles);

  return {
    within1  : withDist.filter(s => s.distanceMiles <= 1),
    within5  : withDist.filter(s => s.distanceMiles > 1 && s.distanceMiles <= 5),
    within10 : withDist.filter(s => s.distanceMiles > 5 && s.distanceMiles <= 10),
    national,
  };
};

// ─── Parse TECHRULES from points.csv row ──────────────────────────────────────

const parseTechRules = (techrules) => {
  if (!techrules) return new Set();
  return new Set(
    techrules.split(';')
      .map(part => part.trim().split(':')[0].trim())
      .filter(Boolean)
  );
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

// ─── Extract address from message ─────────────────────────────────────────────

const ADDR_RE      = /(\d+[\w\s.#-]+?\b(?:STREET|AVENUE|BOULEVARD|DRIVE|ROAD|LANE|COURT|PLACE|CIRCLE|HIGHWAY|PARKWAY|SQUARE|ST|AVE|BLVD|DR|RD|LN|CT|WAY|PL|CIR|HWY|PKWY|LOOP|SQ)\.?)[\s,]+([A-Za-z][A-Za-z\s]+?)[\s,]+\b([A-Za-z]{2})\b(?:[\s,]+(\d{5}))?/i;
const BARE_ADDR_RE = /(\d+[\w\s.#-]+?\b(?:STREET|AVENUE|BOULEVARD|DRIVE|ROAD|LANE|COURT|PLACE|CIRCLE|HIGHWAY|PARKWAY|SQUARE|ST|AVE|BLVD|DR|RD|LN|CT|WAY|PL|CIR|HWY|PKWY|LOOP|SQ)\.?)\s*$/i;

const extractAddress = (text) => {
  const m = text.match(ADDR_RE);
  if (m) {
    const addr = normalizeAddr(m[1]);
    return { addr, addrAlt: stripDirectional(addr), city: normalizeCity(m[2]), state: m[3].toUpperCase(), zip: m[4] || '' };
  }
  const bare = text.match(BARE_ADDR_RE);
  if (bare) {
    const addr = normalizeAddr(bare[1]);
    return { addr, addrAlt: stripDirectional(addr), city: 'LAS VEGAS', state: 'NV', zip: '' };
  }
  return null;
};

// ─── CSV line parser ──────────────────────────────────────────────────────────

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

// ─── Stream-search points.csv ─────────────────────────────────────────────────

const searchPointsCSV = ({ addr, addrAlt, city, state, zip }) =>
  new Promise((resolve) => {
    const csvPath = path.join(__dirname, 'public', 'points.csv');
    if (!fs.existsSync(csvPath)) return resolve(null);

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
      const rowZip    = (row.ZIP || '').replace(/"/g, '').trim();
      const candidates = [addr, addrAlt].filter(Boolean);
      const addrMatch  = candidates.some(a => rowAddr === a || rowAddr.startsWith(a + ' '));
      const stateMatch = rowState === state;
      const cityMatch    = rowCity === city;
      const zipMatch     = zip && rowZip === zip;
      const locationMatch = (cityMatch && stateMatch) || (zipMatch && stateMatch);

      if (addrMatch && locationMatch) {
        found = row; done = true; rl.close();
      }
    });

    rl.on('close', () => resolve(found));
    rl.on('error', () => resolve(null));
  });

// ─── Match plans by PROVIDER + TECHNOLOGY (both must match) ──────────────────
// Fix: plan Technology can be "Cable, Fiber to the Premises" — split and check
// each part against techsAtAddress individually.

const matchPlans = (brandnames, techsAtAddress, bldType) => {
  if (!brandnames) return [];

  const targetServiceType = bldType === 'R' ? 'Residential' : 'Commercial';
  const brands = brandnames.split(/;\s*/).map(b => b.trim().toLowerCase()).filter(Boolean);

  return plansData
    .filter(plan => {
      // 1. Provider match
      const provider = (plan['Providers'] || '').toLowerCase();
      if (!brands.some(b => provider.includes(b) || b.includes(provider))) return false;

      // 2. Service type match
      const serviceTypes = new Set(
        (plan['Service Type'] || '').split(',').map(s => s.trim()).filter(Boolean)
      );
      if (!serviceTypes.has(targetServiceType)) return false;

      // 3. Technology match — split comma-separated tech values
      const planTechs = (plan['Technology'] || '')
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      // At least one of the plan's technologies must be present at the address
      return planTechs.some(t => techsAtAddress.has(t));
    })
    .map(plan => {
      const dl = parseFloat(plan[' Download Speed (Mbps) ']) || 0;
      const ul = parseFloat(plan[' Upload Speed (Mbps) '])   || 0;

      return {
        planName      : plan['Plan Name']                         || '',
        provider      : plan['Providers']                         || '',
        technology    : (plan['Technology'] || '').trim()         || 'Unknown',
        price         : plan['Full Monthly Price']                 || '',
        introDiscount : plan['Intro Discount']                     || '',
        introPeriod   : plan['Intro Period (months)']              || '',
        downloadMbps  : plan[' Download Speed (Mbps) ']           || '',
        uploadMbps    : plan[' Upload Speed (Mbps) ']             || '',
        dataCap       : plan['Data Cap? (Y/N)']                    || '',
        dataCapGB     : plan['Data Cap (GB)']                      || '',
        contract      : plan['Contract Required? (Y/N)']           || '',
        contractMonths: plan['Contract Length (months)']           || '',
        otherFees     : plan['Other Monthly Fees (Total Est.)']    || '',
        otherFeesNote : plan['Other Monthly Fees (Notes)']         || '',
        installFee    : plan['Installation Fees']                  || '',
        etf           : plan['Early Termination Fee? (Y/N)']       || '',
        lowIncome     : plan['Low-Income Plan? (Y/N)']             || '',
        liDiscount    : plan['Low-Income Discount ($)']            || '',
        meetsThreshold: dl >= 100 && ul >= 25,
      };
    });
};

// ─── Group plans: threshold first, then by provider ───────────────────────────

const groupPlans = (matched) => {
  if (!matched.length) return null;
  const threshold  = matched.filter(p => p.meetsThreshold);
  const rest       = matched.filter(p => !p.meetsThreshold);
  const byProvider = {};
  for (const plan of rest) {
    const key = plan.provider.trim() || 'Other';
    if (!byProvider[key]) byProvider[key] = [];
    byProvider[key].push(plan);
  }
  return { threshold, byProvider };
};

// ─── Format plans as text for Claude's context ────────────────────────────────

const formatPlan = (p) => {
  const lines = [`  • ${p.provider} — ${p.planName} [${p.technology}]`];
  if (p.downloadMbps || p.uploadMbps) lines.push(`    Speed: ${p.downloadMbps} Mbps ↓ / ${p.uploadMbps} Mbps ↑`);
  if (p.price) {
    const intro = p.introDiscount && p.introDiscount.trim() !== '$0'
      ? ` (intro: ${p.introDiscount} off for ${p.introPeriod} mo)` : '';
    lines.push(`    Price: ${p.price}/mo${intro}`);
  }
  if (p.otherFees && p.otherFees.trim() !== '$0') lines.push(`    Other fees: ${p.otherFees}/mo${p.otherFeesNote ? ' (' + p.otherFeesNote + ')' : ''}`);
  if (p.dataCap === 'Yes' && p.dataCapGB)          lines.push(`    Data cap: ${p.dataCapGB} GB`);
  if (p.contract === 'No')                         lines.push(`    No contract required`);
  if (p.installFee && p.installFee.trim() !== '$0') lines.push(`    Installation: ${p.installFee}`);
  if (p.lowIncome === 'Yes')                       lines.push(`    ✓ Low-income plan — discount: ${p.liDiscount}`);
  if (p.meetsThreshold)                            lines.push(`    ✓ Meets 100/25 Mbps threshold`);
  return lines.join('\n');
};

// ─── Format services for Claude context ──────────────────────────────────────

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

// ─── Request handler ──────────────────────────────────────────────────────────

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    const userMessage  = messages[messages.length - 1].content;

    let contextBlock  = '';
    let planGroups    = null;
    let serviceGroups = null;

    const parsed = extractAddress(userMessage);
    console.log('[debug] parsed:', JSON.stringify(parsed));

    if (parsed) {
      // Run CSV lookup and geocode in parallel
      const [row, geoResult] = await Promise.all([
        searchPointsCSV(parsed),
        geocodeAddress(parsed.addr, parsed.city, parsed.state, parsed.zip),
      ]);
      console.log('[debug] CSV row:', row ? row.ADDR : 'null');
      console.log('[debug] geocode:', geoResult);

      if (row) {
        const techsAtAddress = parseTechRules(row.TECHRULES);
        const matched        = matchPlans(row.BRANDNAMES, techsAtAddress, row.BLD_TYPE);
        console.log('[debug] plans matched:', matched.length, '| techs:', [...techsAtAddress]);

        planGroups = groupPlans(matched);

        const plansText = matched.length > 0
          ? `AVAILABLE PLANS (${matched.length} total, ${matched.filter(p => p.meetsThreshold).length} meet 100/25 threshold):\n` +
            matched.map(formatPlan).join('\n\n')
          : `AVAILABLE PLANS: No plan records found for providers: ${row.BRANDNAMES}`;

        // Services lookup — use geocoded coords if we got them, else fall back to row lat/lon if available
        const userLat = geoResult?.lat ?? parseFloat(row.LATITUDE) ?? null;
        const userLon = geoResult?.lon ?? parseFloat(row.LONGITUDE) ?? null;

        if (userLat && userLon) {
          serviceGroups = getServicesNearAddress(userLat, userLon);
        } else {
          // No coords — just return national services
          serviceGroups = {
            within1: [], within5: [], within10: [],
            national: SERVICES.filter(s => s.lat === null),
          };
        }

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
        contextBlock = `\n\n## Data for this query\nADDRESS NOT FOUND: "${parsed.addr}, ${parsed.city}, ${parsed.state}" did not match any record in the FCC broadband database.`;

        // Still return national services even if address not found in FCC DB
        serviceGroups = {
          within1: [], within5: [], within10: [],
          national: SERVICES.filter(s => s.lat === null),
        };
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

    res.json({
      message      : data.content[0].text,
      planGroups,
      serviceGroups,   // ← new: passed to frontend for rendering
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
// One-time script to load public/points.csv into Neon Postgres via COPY protocol.
// Run: node scripts/import-points.js
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');
const copyFrom = require('pg-copy-streams').from;

const CSV_PATH = path.join(__dirname, '..', 'public', 'points.csv');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set — add it to .env');
    process.exit(1);
  }
  if (!fs.existsSync(CSV_PATH)) {
    console.error('points.csv not found at', CSV_PATH);
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  console.log('Connected. Streaming CSV into Neon...');

  try {
    const stream = client.query(copyFrom(
      `COPY points (loc_id, brandnames, bld_type, techbest, max_dl, max_ul, fixedcnt, cschoice,
                    beadfund, program, techrules, period, addr, city, state, zip, lat, long)
       FROM STDIN WITH (FORMAT csv, HEADER true)`
    ));

    const fileStream = fs.createReadStream(CSV_PATH);
    fileStream.pipe(stream);

    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
      fileStream.on('error', reject);
    });

    const { rows } = await client.query('SELECT COUNT(*) FROM points');
    console.log(`Done! ${rows[0].count} rows imported.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });

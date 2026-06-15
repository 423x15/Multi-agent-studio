// Orchestrate full startup: bootstrap (NATS+SQLite+pip) then Express server.
const path = require('path');

async function main() {
  const dev = process.argv.includes('--dev');
  const noPip = process.argv.includes('--no-pip');
  process.env.MODE = dev ? 'dev' : 'prod';

  // Load .env if present
  try {
    require('fs')
      .readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
      .split('\n')
      .forEach((line) => {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
      });
  } catch (_) {}

  const { bootstrap } = require('./bootstrap');
  await bootstrap({ withPip: !noPip });

  // Start backend (also serves/proxies frontend)
  require('../server/index.js');
}

main().catch((e) => { console.error(e); process.exit(1); });

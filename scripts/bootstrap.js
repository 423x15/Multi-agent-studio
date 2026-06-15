// Bootstrap: NATS server (system binary), SQLite init, Python deps.
const { spawn, spawnSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = process.env.SQLITE_PATH || path.join(DATA_DIR, 'studio.db');
const JS_STORE = path.join(DATA_DIR, 'jetstream');

function findNatsServer() {
  const isWin = process.platform === 'win32';
  const local = path.join(ROOT, 'nats-bin', isWin ? 'nats-server.exe' : 'nats-server');
  if (fs.existsSync(local)) return local;
  try {
    const cmd = isWin ? 'where nats-server' : 'which nats-server';
    const p = execSync(cmd).toString().trim().split('\n')[0].trim();
    if (p) return p;
  } catch (_) {}
  return null;
}

function waitPort(port, host, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const tryOnce = () => {
      const sock = net.connect(port, host);
      sock.on('connect', () => { sock.destroy(); resolve(); });
      sock.on('error', () => {
        sock.destroy();
        if (Date.now() > deadline) return reject(new Error('NATS port timeout'));
        setTimeout(tryOnce, 250);
      });
    };
    tryOnce();
  });
}

async function startNats() {
  const bin = findNatsServer();
  if (!bin) {
    const hint = process.platform === 'win32'
      ? 'Download nats-server.exe from https://github.com/nats-io/nats-server/releases and place it in the nats-bin/ folder.'
      : 'Install it (brew install nats-server) or drop a binary in nats-bin/.';
    throw new Error(`nats-server not found. ${hint}`);
  }
  fs.mkdirSync(JS_STORE, { recursive: true });
  console.log(`[bootstrap] starting nats-server: ${bin}`);
  const proc = spawn(bin, ['-js', '-sd', JS_STORE, '-p', '4222'], {
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  proc.on('exit', (code) => console.log(`[bootstrap] nats-server exited ${code}`));
  await waitPort(4222, '127.0.0.1', 15000);
  console.log('[bootstrap] NATS ready on 4222');
  return proc;
}

function initDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const Database = require('../server/sqlite-compat');
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  const schema = fs.readFileSync(path.join(ROOT, 'server', 'schema.sql'), 'utf8');
  db.exec(schema);
  db.close();
  console.log(`[bootstrap] SQLite ready: ${DB_PATH}`);
}

function getPythonCmd() {
  if (process.platform !== 'win32') return 'python3';
  try { execSync('python3 --version', { stdio: 'ignore' }); return 'python3'; } catch (_) {}
  return 'python';
}

function installPythonDeps() {
  const req = path.join(ROOT, 'requirements.txt');
  if (!fs.existsSync(req)) return;
  console.log('[bootstrap] installing Python deps (pip)...');
  const r = spawnSync(getPythonCmd(), ['-m', 'pip', 'install', '-q', '-r', req], {
    stdio: 'inherit',
  });
  if (r.status !== 0) {
    console.warn('[bootstrap] pip install failed — install manually: pip install -r requirements.txt');
  } else {
    console.log('[bootstrap] Python deps OK');
  }
}

async function bootstrap({ withPip = true } = {}) {
  initDb();
  if (withPip) installPythonDeps();
  const natsProc = await startNats();
  return { natsProc, DB_PATH };
}

module.exports = { bootstrap, startNats, initDb, findNatsServer, waitPort };

if (require.main === module) {
  bootstrap().catch((e) => { console.error(e); process.exit(1); });
}

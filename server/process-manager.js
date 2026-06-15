const { spawn } = require('child_process');
const path = require('path');
const { broadcast } = require('./ws-broadcaster');

const ROOT = path.join(__dirname, '..');
const processes = new Map(); // agentId -> ChildProcess

function startAgent(agentId, agentPath, systemId) {
  if (processes.has(agentId)) return;
  const abs = path.isAbsolute(agentPath) ? agentPath : path.join(ROOT, agentPath);

  const proc = spawn('python3', [path.join(ROOT, 'core', 'daemon.py'), '--agent', abs], {
    cwd: ROOT,
    env: {
      ...process.env,
      SYSTEM_ID: systemId,
      NATS_URL: process.env.NATS_URL || 'nats://localhost:4222',
      SQLITE_PATH: process.env.SQLITE_PATH || path.join(ROOT, 'data', 'studio.db'),
      PYTHONUNBUFFERED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let buf = '';
  proc.stdout.on('data', (data) => {
    buf += data.toString();
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      if (line.startsWith('@@JSON@@')) {
        try { broadcast(JSON.parse(line.slice(8))); } catch (_) {}
      } else {
        console.log(`[${agentId}] ${line}`);
        if (line.includes('READY')) {
          broadcast({ type: 'agent_status', agentId, status: 'running' });
        }
      }
    }
  });

  proc.stderr.on('data', (data) => {
    console.error(`[${agentId}] ERR: ${data.toString().trim()}`);
  });

  proc.on('exit', (code) => {
    processes.delete(agentId);
    broadcast({ type: 'agent_status', agentId, status: 'stopped', code });
  });

  processes.set(agentId, proc);
}

function stopAgent(agentId) {
  const proc = processes.get(agentId);
  if (proc) { proc.kill('SIGTERM'); processes.delete(agentId); }
}

function stopAll() {
  for (const [id] of processes) stopAgent(id);
}

function getStatus() {
  const status = {};
  for (const [id] of processes) status[id] = 'running';
  return status;
}

module.exports = { startAgent, stopAgent, stopAll, getStatus };

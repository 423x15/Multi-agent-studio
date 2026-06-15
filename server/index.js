const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');

const { db, q } = require('./db');
const { initWebSocket, bus } = require('./ws-broadcaster');
const { connectNATS } = require('./nats');
const pm = require('./process-manager');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 3001;
const DEV = process.env.MODE === 'dev';

const app = express();
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, mode: DEV ? 'dev' : 'prod' }));
app.use('/api/systems', require('./routes/systems'));
app.use('/api/agents', require('./routes/agents'));
app.use('/api/runs', require('./routes/runs'));
app.use('/api/export', require('./routes/export'));

// Frontend
if (DEV) {
  const { createProxyMiddleware } = require('http-proxy-middleware');
  const proxy = createProxyMiddleware({ target: 'http://localhost:5173', changeOrigin: true, ws: true });
  app.use((req, res, next) => (req.path.startsWith('/api') ? next() : proxy(req, res, next)));
} else {
  const dist = path.join(ROOT, 'client', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
  } else {
    app.get('*', (req, res) =>
      res.status(200).send('<h1>Multi-Agent Studio</h1><p>Run <code>npm run build</code> to build the client, or <code>npm run dev</code>.</p>'));
  }
}

const server = http.createServer(app);
initWebSocket(server);

// Mark runs complete/failed from daemon events
bus.on('agent_final', (e) => {
  q.completeRun.run('completed', e.output, e.run_id);
});
bus.on('agent_error', (e) => {
  q.completeRun.run('failed', e.error, e.run_id);
});

// Timeout sweeper: runs stuck >5min -> failed
setInterval(() => {
  try {
    const stale = q.staleRuns.all('-5 minutes');
    for (const r of stale) q.completeRun.run('failed', 'timeout', r.id);
  } catch (_) {}
}, 30000);

server.listen(PORT, async () => {
  console.log(`[server] http://localhost:${PORT} (${DEV ? 'dev' : 'prod'})`);
  try {
    await connectNATS();
  } catch (e) {
    console.error('[server] NATS connect failed:', e.message);
  }
});

process.on('SIGINT', () => { pm.stopAll(); process.exit(0); });
process.on('SIGTERM', () => { pm.stopAll(); process.exit(0); });

module.exports = { app, server };

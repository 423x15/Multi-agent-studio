const express = require('express');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const { q } = require('../db');

const router = express.Router();
const ROOT = path.join(__dirname, '..', '..');

const MINIMAL_PKG = {
  name: 'multi-agent-studio-export',
  version: '1.0.0',
  scripts: { start: 'node scripts/start-all.js' },
  dependencies: {
    express: '^4.18.0', ws: '^8.16.0', 'better-sqlite3': '^11.8.0',
    nats: '^2.28.0', uuid: '^9.0.0', 'http-proxy-middleware': '^3.0.0',
    'js-yaml': '^4.1.0', archiver: '^7.0.0',
  },
};

const README = (name) => `# Exported System — ${name}

## Requirements
- Node.js 20+
- Python 3.11+
- nats-server on PATH (brew install nats-server)

## Install
1. cp .env.example .env  (fill in your API keys)
2. npm install
3. pip install -r requirements.txt

## Run
npm start

UI: http://localhost:3001

## Layout
- agents/ : the agents of this system
- core/   : shared Python SDK (do not edit)
- data/studio.db : logs of previous runs
`;

router.post('/:systemId', async (req, res) => {
  const row = q.getSystem.get(req.params.systemId);
  if (!row) return res.status(404).json({ error: 'not found' });
  const config = JSON.parse(row.config);
  const agentIds = (config.nodes || []).map((n) => n.id);

  res.attachment(`${row.name.replace(/\s+/g, '_')}.zip`);
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (e) => res.status(500).end(String(e)));
  archive.pipe(res);

  archive.directory(path.join(ROOT, 'core'), 'core');
  archive.directory(path.join(ROOT, 'server'), 'server');
  archive.directory(path.join(ROOT, 'scripts'), 'scripts');
  const dist = path.join(ROOT, 'client', 'dist');
  if (fs.existsSync(dist)) archive.directory(dist, 'client/dist');

  for (const id of agentIds) {
    const dir = path.join(ROOT, 'agents', id);
    if (fs.existsSync(dir)) archive.directory(dir, `agents/${id}`);
  }

  archive.file(path.join(ROOT, 'systems', `${row.id}.json`), {
    name: `systems/${row.id}.json`,
  });
  const db = path.join(ROOT, 'data', 'studio.db');
  if (fs.existsSync(db)) archive.file(db, { name: 'data/studio.db' });
  archive.file(path.join(ROOT, 'requirements.txt'), { name: 'requirements.txt' });
  archive.file(path.join(ROOT, '.env.example'), { name: '.env.example' });

  archive.append(JSON.stringify(MINIMAL_PKG, null, 2), { name: 'package.json' });
  archive.append(README(row.name), { name: 'README_EXPORT.md' });
  archive.append('node scripts/start-all.js\n', { name: 'start.sh' });

  await archive.finalize();
});

module.exports = router;

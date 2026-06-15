const express = require('express');
const { v4: uuid } = require('uuid');
const fs = require('fs');
const path = require('path');
const { db, q } = require('../db');
const { compileSystem } = require('../agent-files');
const pm = require('../process-manager');

const router = express.Router();
const ROOT = path.join(__dirname, '..', '..');
const SYS_DIR = path.join(ROOT, 'systems');

function persist(system) {
  fs.mkdirSync(SYS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(SYS_DIR, `${system.id}.json`),
    JSON.stringify(system, null, 2)
  );
}

router.get('/', (req, res) => res.json(q.listSystems.all()));

router.get('/:id', (req, res) => {
  const row = q.getSystem.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
});

router.post('/', (req, res) => {
  const id = uuid();
  const name = req.body.name || 'Untitled System';
  const config = { nodes: [], edges: [] };
  q.insertSystem.run(id, name, JSON.stringify(config));
  const system = { id, name, config };
  persist(system);
  res.json(system);
});

// Full graph save: nodes + edges -> recompile agents + sync agents table
router.patch('/:id', (req, res) => {
  const id = req.params.id;
  const row = q.getSystem.get(id);
  if (!row) return res.status(404).json({ error: 'not found' });
  const name = req.body.name || row.name;
  const config = req.body.config || JSON.parse(row.config);

  q.updateSystem.run(name, JSON.stringify(config), id);

  // sync agents table from nodes
  q.deleteAgentsBySystem.run(id);
  for (const node of config.nodes || []) {
    q.upsertAgent.run({
      id: node.id,
      system_id: id,
      name: (node.data && node.data.name) || node.id,
      type: (node.data && node.data.agentType) || 'llm_worker',
      config: JSON.stringify(node.data || {}),
      pos_x: node.position ? node.position.x : 0,
      pos_y: node.position ? node.position.y : 0,
    });
  }

  const topo = compileSystem(config);
  const system = { id, name, config };
  persist(system);
  res.json({ ...system, topo });
});

router.delete('/:id', (req, res) => {
  const id = req.params.id;
  q.deleteSystem.run(id);
  try { fs.unlinkSync(path.join(SYS_DIR, `${id}.json`)); } catch (_) {}
  res.json({ ok: true });
});

// Start all agents of a system
router.post('/:id/start', (req, res) => {
  const row = q.getSystem.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  const config = JSON.parse(row.config);
  compileSystem(config);
  for (const node of config.nodes || []) {
    pm.startAgent(node.id, path.join('agents', node.id), row.id);
  }
  res.json({ ok: true, started: (config.nodes || []).map((n) => n.id) });
});

router.post('/:id/stop', (req, res) => {
  const row = q.getSystem.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  const config = JSON.parse(row.config);
  for (const node of config.nodes || []) pm.stopAgent(node.id);
  res.json({ ok: true });
});

router.get('/:id/status', (req, res) => res.json(pm.getStatus()));

module.exports = router;

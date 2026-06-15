const express = require('express');
const fs = require('fs');
const path = require('path');
const { q } = require('../db');
const { agentDir } = require('../agent-files');

const router = express.Router();

router.get('/:systemId', (req, res) => {
  res.json(q.listAgents.all(req.params.systemId));
});

// Read raw runner.py code for the python editor
router.get('/:systemId/:agentId/code', (req, res) => {
  const file = path.join(agentDir(req.params.agentId), 'runner.py');
  if (!fs.existsSync(file)) return res.json({ code: '' });
  res.json({ code: fs.readFileSync(file, 'utf8') });
});

// Write raw runner.py code (python type)
router.put('/:systemId/:agentId/code', (req, res) => {
  const dir = agentDir(req.params.agentId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runner.py'), req.body.code || '');
  res.json({ ok: true });
});

router.delete('/:systemId/:agentId', (req, res) => {
  q.deleteAgent.run(req.params.agentId);
  try {
    fs.rmSync(agentDir(req.params.agentId), { recursive: true, force: true });
  } catch (_) {}
  res.json({ ok: true });
});

module.exports = router;

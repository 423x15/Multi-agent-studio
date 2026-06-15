const express = require('express');
const { v4: uuid } = require('uuid');
const { q } = require('../db');
const { deriveTopology, inSubject } = require('../agent-files');
const { publishRunInput } = require('../nats');

const router = express.Router();

// POST /api/runs  { system_id, input }
router.post('/', async (req, res) => {
  const { system_id, input } = req.body;
  const row = q.getSystem.get(system_id);
  if (!row) return res.status(404).json({ error: 'system not found' });
  const config = JSON.parse(row.config);
  const nodes = config.nodes || [];
  const edges = config.edges || [];
  if (!nodes.length) return res.status(400).json({ error: 'empty system' });

  const topo = deriveTopology(nodes, edges);
  const entries = nodes.filter((n) => topo[n.id].entry);
  if (!entries.length) return res.status(400).json({ error: 'no entry point (cycle?)' });

  const run_id = uuid();
  q.insertRun.run(run_id, system_id, input);

  const envelope = {
    run_id,
    system_id,
    from_agent: '__user__',
    payload: input,
    timestamp: new Date().toISOString(),
    metadata: {},
  };

  try {
    for (const entry of entries) {
      await publishRunInput(inSubject(entry.id), envelope);
    }
  } catch (e) {
    q.completeRun.run('failed', String(e), run_id);
    return res.status(500).json({ error: String(e) });
  }

  res.json({ run_id, entries: entries.map((e) => e.id) });
});

router.get('/:systemId/list', (req, res) => {
  res.json(q.listRuns.all(req.params.systemId));
});

router.get('/:runId/events', (req, res) => {
  res.json(q.eventsByRun.all(req.params.runId));
});

router.get('/:runId/logs', (req, res) => {
  res.json(q.logsByRun.all(req.params.runId));
});

router.put('/:runId/complete', (req, res) => {
  const { status = 'completed', result = null } = req.body;
  q.completeRun.run(status, result, req.params.runId);
  res.json({ ok: true });
});

module.exports = router;

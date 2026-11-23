const express = require('express');
const { v4: uuid } = require('uuid');
const { q } = require('../db');

const router = express.Router();

router.get('/:systemId', (req, res) => {
  res.json(q.listTests.all(req.params.systemId));
});

router.post('/:systemId', (req, res) => {
  const { name, input, expected } = req.body;
  if (!name || !input || !expected)
    return res.status(400).json({ error: 'name, input, expected required' });
  const id = uuid();
  q.insertTest.run(id, req.params.systemId, name, input, expected);
  res.json({ id, name, input, expected });
});

router.delete('/:systemId/:testId', (req, res) => {
  q.deleteTest.run(req.params.testId);
  res.json({ ok: true });
});

module.exports = router;

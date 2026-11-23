const express = require('express');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const router = express.Router();
const TOOLS_DIR = path.join(__dirname, '..', '..', 'tools');

const SYSTEM_PROMPT = `You generate Python tool functions for LangChain/LangGraph agents.
Output ONLY valid Python code — no markdown fences, no explanation.
Rules:
- Import @tool from langchain_core.tools
- One function decorated with @tool
- Single string parameter named "input", returns string
- Clear one-line docstring describing what it does
- Use only: standard library, requests, json, re, datetime, math
- Keep it under 40 lines
- The function name must be a valid Python identifier (snake_case)`;

router.get('/', (req, res) => {
  const files = fs.readdirSync(TOOLS_DIR)
    .filter((f) => f.endsWith('.py'))
    .map((f) => f.replace('.py', ''));
  res.json(files);
});

router.get('/:name/code', (req, res) => {
  const p = path.join(TOOLS_DIR, `${req.params.name}.py`);
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'not found' });
  res.json({ code: fs.readFileSync(p, 'utf8') });
});

router.post('/generate', async (req, res) => {
  const { description } = req.body;
  if (!description) return res.status(400).json({ error: 'description required' });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not set' });

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.3,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Create a tool that: ${description}` },
        ],
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: data.error?.message || 'OpenAI error' });
    res.json({ code: data.choices[0].message.content.trim() });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post('/save', (req, res) => {
  const { name, code } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'name and code required' });
  if (!/^[a-z][a-z0-9_]*$/.test(name)) return res.status(400).json({ error: 'name must be snake_case' });
  fs.writeFileSync(path.join(TOOLS_DIR, `${name}.py`), code);
  res.json({ ok: true, name });
});

router.delete('/:name', (req, res) => {
  const p = path.join(TOOLS_DIR, `${req.params.name}.py`);
  if (fs.existsSync(p)) fs.unlinkSync(p);
  res.json({ ok: true });
});

module.exports = router;

// End-to-end smoke check. Boots bootstrap + server in-process, creates a
// 3-agent pipeline, starts agents, fires a run, asserts a final result.
// Requires OPENAI_API_KEY for a real LLM result; otherwise validates plumbing
// (system create, compile, agent spawn, NATS delivery) and reports gracefully.
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
process.env.MODE = 'prod';
process.env.PORT = process.env.PORT || '3019';
const BASE = `http://localhost:${process.env.PORT}`;

function req(method, url, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(BASE + url, {
      method,
      headers: { 'Content-Type': 'application/json' },
    }, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: b ? JSON.parse(b) : null }); }
        catch { resolve({ status: res.statusCode, json: null, raw: b }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function pipelineConfig() {
  const mk = (id, x, prompt) => ({
    id, type: 'agent', position: { x, y: 100 },
    data: {
      name: id, agentType: 'llm_worker', description: '', timeout_seconds: 60, fan_in: false,
      llm: { provider: 'openai', model: 'gpt-4o-mini', temperature: 0.3, system_prompt: prompt },
      tools: [],
    },
  });
  return {
    nodes: [
      mk('researcher', 0, 'Research the topic. List 3 short facts.'),
      mk('fact_checker', 300, 'Check the facts you receive. Keep the verified ones.'),
      mk('summarizer', 600, 'Summarize the verified facts in 2 sentences.'),
    ],
    edges: [
      { id: 'e1', source: 'researcher', target: 'fact_checker' },
      { id: 'e2', source: 'fact_checker', target: 'summarizer' },
    ],
  };
}

async function main() {
  const hasKey = !!process.env.OPENAI_API_KEY;
  console.log(`[e2e] OPENAI_API_KEY present: ${hasKey}`);

  const { bootstrap } = require('./bootstrap');
  const boot = await bootstrap({ withPip: false });
  global.__natsProc = boot.natsProc;
  require('../server/index.js');
  await sleep(2000);

  let fail = 0;
  const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}`); if (!ok) fail++; };

  const health = await req('GET', '/api/health');
  check('server health', health.status === 200 && health.json.ok);

  const sys = await req('POST', '/api/systems', { name: 'e2e-pipeline' });
  check('create system', sys.status === 200 && sys.json.id);
  const sysId = sys.json.id;

  const patch = await req('PATCH', `/api/systems/${sysId}`, { config: pipelineConfig() });
  const topo = patch.json.topo || {};
  check('compile graph', patch.status === 200);
  check('entry = researcher', topo.researcher && topo.researcher.entry === true);
  check('terminal = summarizer', topo.summarizer && topo.summarizer.terminal === true);
  check('chain subjects', topo.fact_checker &&
    topo.fact_checker.subscribes.includes('agent.researcher.output'));

  const start = await req('POST', `/api/systems/${sysId}/start`);
  check('start agents', start.status === 200 && start.json.started.length === 3);
  await sleep(4000);

  const status = await req('GET', `/api/systems/${sysId}/status`);
  const running = Object.values(status.json).filter((s) => s === 'running').length;
  check('3 agents running', running === 3);

  const run = await req('POST', '/api/runs', { system_id: sysId, input: 'The planet Mars.' });
  check('start run', run.status === 200 && run.json.run_id);
  const runId = run.json.run_id;

  // wait for completion (or timeout)
  let result = null;
  for (let i = 0; i < (hasKey ? 60 : 6); i++) {
    await sleep(1000);
    const r = await req('GET', `/api/runs/${sysId}/list`);
    const row = (r.json || []).find((x) => x.id === runId);
    if (row && row.status !== 'running') { result = row; break; }
  }

  const events = await req('GET', `/api/runs/${runId}/events`);
  check('events recorded on bus', (events.json || []).length >= 1);

  if (hasKey) {
    check('run completed', result && result.status === 'completed');
    check('final result non-empty', result && result.result && result.result.length > 0);
    if (result) console.log('\n--- FINAL RESULT ---\n' + result.result + '\n');
  } else {
    console.log('[e2e] No API key — skipped LLM assertions (plumbing verified).');
  }

  console.log(`\n[e2e] ${fail === 0 ? 'ALL CHECKS PASSED' : fail + ' CHECK(S) FAILED'}`);
  try { require('../server/process-manager').stopAll(); } catch (_) {}
  try { global.__natsProc && global.__natsProc.kill('SIGTERM'); } catch (_) {}
  setTimeout(() => process.exit(fail === 0 ? 0 : 1), 500);
}

main().catch((e) => { console.error('[e2e] crashed:', e); process.exit(1); });

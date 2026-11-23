import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useStudio } from '../../store/useStudio';

const POLL_MS = 600;
const TIMEOUT_MS = 90_000;

async function waitForRun(runId) {
  const start = Date.now();
  while (Date.now() - start < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const r = await fetch(`/api/runs/run/${runId}`);
    const run = await r.json();
    if (run.status !== 'running') return run;
  }
  return { status: 'failed', result: 'timeout' };
}

function passes(result, expected) {
  if (!result) return false;
  return result.toLowerCase().includes(expected.toLowerCase());
}

export default function TestPanel() {
  const activeSystemId = useStudio((s) => s.activeSystemId);
  const agentStatuses = useStudio((s) => s.agentStatuses);
  const startRun = useStudio((s) => s.startRun);

  const [tests, setTests] = useState([]);
  const [results, setResults] = useState({});   // testId -> { status, output, duration_ms }
  const [running, setRunning] = useState(false);
  const [form, setForm] = useState({ name: '', input: '', expected: '' });
  const abortRef = useRef(false);

  const anyAgentRunning = Object.values(agentStatuses).some((s) => s === 'running');

  const loadTests = useCallback(() => {
    if (!activeSystemId) return;
    fetch(`/api/tests/${activeSystemId}`).then((r) => r.json()).then(setTests);
  }, [activeSystemId]);

  useEffect(() => { loadTests(); setResults({}); }, [loadTests]);

  const addTest = async (e) => {
    e.preventDefault();
    await fetch(`/api/tests/${activeSystemId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ name: '', input: '', expected: '' });
    loadTests();
  };

  const deleteTest = async (id) => {
    await fetch(`/api/tests/${activeSystemId}/${id}`, { method: 'DELETE' });
    loadTests();
  };

  const runAll = async () => {
    if (!anyAgentRunning || running) return;
    setRunning(true);
    setResults({});
    abortRef.current = false;

    for (const test of tests) {
      if (abortRef.current) break;
      setResults((r) => ({ ...r, [test.id]: { status: 'running' } }));
      const t0 = Date.now();
      try {
        const { run_id } = await startRun(test.input);
        const run = await waitForRun(run_id);
        const duration_ms = Date.now() - t0;
        const ok = run.status === 'completed' && passes(run.result, test.expected);
        setResults((r) => ({
          ...r,
          [test.id]: { status: ok ? 'pass' : 'fail', output: run.result, duration_ms },
        }));
      } catch (err) {
        setResults((r) => ({ ...r, [test.id]: { status: 'fail', output: String(err) } }));
      }
    }
    setRunning(false);
  };

  const passed = Object.values(results).filter((r) => r.status === 'pass').length;
  const total  = Object.values(results).filter((r) => r.status !== 'running').length;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between p-2 border-b">
        <span className="text-xs font-bold text-gray-500">Tests</span>
        {total > 0 && (
          <span className={`text-xs font-semibold ${passed === total ? 'text-green-600' : 'text-red-500'}`}>
            {passed}/{total} passed
          </span>
        )}
      </div>

      {/* Add test form */}
      <form onSubmit={addTest} className="p-3 border-b flex flex-col gap-1.5">
        <input
          className="border rounded px-2 py-1 text-xs w-full"
          placeholder="Test name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />
        <textarea
          className="border rounded px-2 py-1 text-xs w-full font-mono resize-none"
          placeholder="Input to send to the agent"
          rows={2}
          value={form.input}
          onChange={(e) => setForm((f) => ({ ...f, input: e.target.value }))}
          required
        />
        <input
          className="border rounded px-2 py-1 text-xs w-full"
          placeholder="Expected keyword in output (contains check)"
          value={form.expected}
          onChange={(e) => setForm((f) => ({ ...f, expected: e.target.value }))}
          required
        />
        <button type="submit" className="self-end px-3 py-1 rounded bg-gray-800 text-white text-xs">
          + Add test
        </button>
      </form>

      {/* Run button */}
      <div className="px-3 py-2 border-b">
        {!anyAgentRunning && (
          <p className="text-[10px] text-yellow-600 mb-1.5">Start agents before running tests.</p>
        )}
        <button
          onClick={runAll}
          disabled={!anyAgentRunning || running || tests.length === 0}
          className="w-full px-3 py-1.5 rounded text-xs font-semibold bg-orange-500 text-white disabled:opacity-40"
        >
          {running ? 'Running…' : `▶ Run all tests (${tests.length})`}
        </button>
        {running && (
          <button
            onClick={() => { abortRef.current = true; }}
            className="w-full mt-1 px-3 py-1 rounded text-xs text-gray-500 border"
          >
            Stop
          </button>
        )}
      </div>

      {/* Test cases list */}
      <div className="flex flex-col gap-2 p-3">
        {tests.length === 0 && (
          <p className="text-xs text-gray-400 text-center pt-4">No tests yet. Add one above.</p>
        )}
        {tests.map((t) => {
          const res = results[t.id];
          const icon = !res ? '' : res.status === 'running' ? '⏳' : res.status === 'pass' ? '✓' : '✗';
          const bg   = !res ? 'bg-white' : res.status === 'pass' ? 'bg-green-50 border-green-200'
                     : res.status === 'fail' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200';

          return (
            <div key={t.id} className={`border rounded p-2.5 text-xs ${bg}`}>
              <div className="flex items-start justify-between gap-1">
                <span className="font-semibold flex gap-1 items-center">
                  {icon && <span>{icon}</span>}
                  {t.name}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {res?.duration_ms && (
                    <span className="text-[10px] text-gray-400">{(res.duration_ms / 1000).toFixed(1)}s</span>
                  )}
                  <button onClick={() => deleteTest(t.id)} className="text-gray-300 hover:text-red-400 text-sm leading-none">✕</button>
                </div>
              </div>
              <div className="text-gray-500 truncate mt-0.5">↳ {t.input}</div>
              <div className="text-gray-400 truncate">expect: <em>{t.expected}</em></div>
              {res?.status === 'fail' && res.output && (
                <details className="mt-1">
                  <summary className="text-red-400 text-[10px] cursor-pointer">got →</summary>
                  <pre className="text-[10px] text-gray-600 whitespace-pre-wrap mt-1 max-h-24 overflow-y-auto">
                    {res.output}
                  </pre>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

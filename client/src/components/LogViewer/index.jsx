import React, { useEffect, useState } from 'react';
import { useStudio } from '../../store/useStudio';

export default function LogViewer() {
  const runs = useStudio((s) => s.runs);
  const activeRunId = useStudio((s) => s.activeRunId);
  const [runId, setRunId] = useState('');
  const [logs, setLogs] = useState([]);

  const sel = runId || activeRunId || '';

  useEffect(() => {
    if (!sel) return;
    fetch(`/api/runs/${sel}/logs`).then((r) => r.json()).then(setLogs);
  }, [sel]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-2 border-b">
        <span className="text-xs font-bold text-gray-500">Logs</span>
        <select className="border rounded text-xs px-1 py-0.5" value={sel}
          onChange={(e) => setRunId(e.target.value)}>
          <option value="">— select run —</option>
          {runs.map((r) => (
            <option key={r.id} value={r.id}>{r.id.slice(0, 8)} · {r.status}</option>
          ))}
        </select>
      </div>
      <div className="flex-1 overflow-y-auto text-xs font-mono">
        <table className="w-full">
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b">
                <td className="px-2 py-0.5 text-gray-400">{l.ts}</td>
                <td className="px-2 py-0.5 text-blue-600">{l.agent_id}</td>
                <td className={`px-2 py-0.5 ${l.level === 'error' ? 'text-red-600' : 'text-gray-600'}`}>{l.level}</td>
                <td className="px-2 py-0.5">{l.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

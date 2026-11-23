import React, { useCallback, useEffect, useState } from 'react';
import { useStudio } from '../../store/useStudio';

function fmt(ms) {
  if (ms == null) return '—';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function StatusBadge({ status }) {
  const styles = {
    completed: 'bg-green-100 text-green-700',
    failed:    'bg-red-100 text-red-600',
    running:   'bg-yellow-100 text-yellow-700',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${styles[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  );
}

function Card({ label, value, sub }) {
  return (
    <div className="bg-gray-50 border rounded p-3">
      <div className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</div>
      <div className="text-xl font-bold text-gray-800 mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function StatsPanel() {
  const activeSystemId = useStudio((s) => s.activeSystemId);
  const runs = useStudio((s) => s.runs);
  const [data, setData] = useState(null);

  const refresh = useCallback(() => {
    if (!activeSystemId) return;
    fetch(`/api/runs/${activeSystemId}/stats`)
      .then((r) => r.json())
      .then(setData);
  }, [activeSystemId]);

  useEffect(() => { refresh(); }, [refresh, runs.length]);

  if (!data) return (
    <div className="flex items-center justify-center h-full text-xs text-gray-400">
      No data yet — run an agent first.
    </div>
  );

  const s = data.summary;
  const rate = s.total > 0 ? Math.round((s.success / s.total) * 100) : 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between p-2 border-b">
        <span className="text-xs font-bold text-gray-500">Stats</span>
        <button onClick={refresh} className="text-[10px] text-gray-400 hover:text-gray-600">↻ refresh</button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 p-3">
        <Card label="Total runs"    value={s.total} />
        <Card label="Success rate"  value={`${rate}%`}   sub={`${s.success} ok · ${s.failed} failed`} />
        <Card label="Avg duration"  value={fmt(s.avg_duration_ms)} sub="completed runs" />
        <Card label="Errors"        value={s.errors}     sub="in agent logs" />
      </div>

      {/* Agent activity */}
      {data.agentActivity.length > 0 && (
        <div className="px-3 pb-3">
          <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Messages per agent</div>
          <div className="flex flex-col gap-1">
            {data.agentActivity.map((a) => {
              const max = data.agentActivity[0].msg_count;
              const pct = Math.round((a.msg_count / max) * 100);
              return (
                <div key={a.from_agent}>
                  <div className="flex justify-between text-[10px] text-gray-600 mb-0.5">
                    <span className="truncate max-w-[70%]">{a.from_agent}</span>
                    <span>{a.msg_count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full">
                    <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent runs */}
      <div className="px-3 pb-3">
        <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Recent runs</div>
        <div className="flex flex-col gap-1">
          {data.recentRuns.map((r) => (
            <div key={r.id} className="border rounded p-2 text-xs bg-white">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <StatusBadge status={r.status} />
                <span className="text-gray-400 text-[10px]">{fmt(r.duration_ms)}</span>
                <span className="text-gray-400 text-[10px] ml-auto">
                  {new Date(r.started_at).toLocaleTimeString()}
                </span>
              </div>
              <div className="text-gray-600 truncate">{r.input}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

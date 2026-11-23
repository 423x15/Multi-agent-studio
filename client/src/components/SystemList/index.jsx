import React, { useEffect, useState } from 'react';
import { useStudio } from '../../store/useStudio';

export default function SystemList() {
  const { systems, activeSystemId, loadSystems, createSystem, openSystem, deleteSystem, loadExample } = useStudio();
  const [name, setName] = useState('');

  useEffect(() => { loadSystems(); }, []);

  const handleCreate = () => {
    if (name.trim()) { createSystem(name.trim()); setName(''); }
  };

  return (
    <div className="w-56 border-r bg-white h-full flex flex-col shrink-0">
      {/* New system */}
      <div className="p-3 border-b">
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Systems</div>
        <div className="flex gap-1">
          <input
            className="flex-1 border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="New system name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
          />
          <button
            className="px-2.5 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700"
            onClick={handleCreate}
          >+</button>
        </div>
        <button
          className="w-full mt-2 px-2 py-1.5 rounded-lg border border-dashed border-gray-300 text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
          onClick={loadExample}
        >
          ✦ Load example
        </button>
      </div>

      {/* System list */}
      <div className="flex-1 overflow-y-auto py-1">
        {systems.length === 0 && (
          <p className="text-xs text-gray-400 px-3 py-4 text-center">No systems yet.</p>
        )}
        {systems.map((s) => {
          const cfg = (() => { try { return JSON.parse(s.config); } catch { return {}; } })();
          const count = (cfg.nodes || []).filter(n => n.data?.agentType !== 'user').length;
          const active = activeSystemId === s.id;
          return (
            <div
              key={s.id}
              onClick={() => openSystem(s.id)}
              className={`mx-2 my-0.5 px-3 py-2 rounded-lg text-sm cursor-pointer flex justify-between items-start transition-colors ${
                active ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate leading-tight">{s.name}</div>
                {count > 0 && <div className="text-[10px] text-gray-400 mt-0.5">{count} agent{count > 1 ? 's' : ''}</div>}
              </div>
              <button
                className="text-gray-300 hover:text-red-400 ml-1 mt-0.5 shrink-0"
                onClick={(e) => { e.stopPropagation(); deleteSystem(s.id); }}
              >✕</button>
            </div>
          );
        })}
      </div>

      {/* Export */}
      {activeSystemId && (
        <div className="p-3 border-t">
          <button
            className="w-full px-3 py-2 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 transition-colors"
            onClick={() => {
              fetch(`/api/export/${activeSystemId}`, { method: 'POST' })
                .then((r) => r.blob())
                .then((b) => {
                  const url = URL.createObjectURL(b);
                  const a = document.createElement('a');
                  a.href = url; a.download = 'system.zip'; a.click();
                });
            }}
          >⬇ Export ZIP</button>
        </div>
      )}
    </div>
  );
}

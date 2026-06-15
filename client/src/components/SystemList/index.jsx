import React, { useEffect, useState } from 'react';
import { useStudio } from '../../store/useStudio';

export default function SystemList() {
  const { systems, activeSystemId, loadSystems, createSystem, openSystem, deleteSystem } = useStudio();
  const [name, setName] = useState('');

  useEffect(() => { loadSystems(); }, []);

  return (
    <div className="w-56 border-r bg-gray-100 h-full flex flex-col">
      <div className="p-2 border-b">
        <div className="text-xs font-bold text-gray-500 uppercase mb-1">Systems</div>
        <div className="flex gap-1">
          <input className="flex-1 border rounded px-2 py-1 text-sm" placeholder="New system"
            value={name} onChange={(e) => setName(e.target.value)} />
          <button className="px-2 rounded bg-blue-600 text-white text-sm"
            onClick={() => { if (name.trim()) { createSystem(name); setName(''); } }}>+</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {systems.map((s) => (
          <div key={s.id}
            className={`px-3 py-2 text-sm cursor-pointer flex justify-between items-center hover:bg-gray-200 ${activeSystemId === s.id ? 'bg-blue-100' : ''}`}
            onClick={() => openSystem(s.id)}>
            <span className="truncate">{s.name}</span>
            <button className="text-gray-400 hover:text-red-600"
              onClick={(e) => { e.stopPropagation(); deleteSystem(s.id); }}>✕</button>
          </div>
        ))}
      </div>
      {activeSystemId && (
        <a className="m-2 px-3 py-2 rounded bg-gray-700 text-white text-sm text-center"
          href={`/api/export/${activeSystemId}`}
          onClick={(e) => {
            e.preventDefault();
            fetch(`/api/export/${activeSystemId}`, { method: 'POST' })
              .then((r) => r.blob())
              .then((b) => {
                const url = URL.createObjectURL(b);
                const a = document.createElement('a');
                a.href = url; a.download = 'system.zip'; a.click();
              });
          }}>⬇ Export ZIP</a>
      )}
    </div>
  );
}

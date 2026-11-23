import React from 'react';
import { useStudio } from '../../store/useStudio';

const SECTIONS = [
  {
    label: 'Entry',
    types: [{ type: 'user', label: '👤 You', color: '#6b7280', desc: 'Your input & output' }],
  },
  {
    label: 'Manager',
    types: [{ type: 'orchestrator', label: '👑 Manager', color: '#1d4ed8', desc: 'Delegates to workers, responds to You' }],
  },
  {
    label: 'Workers',
    types: [
      { type: 'llm_worker', label: '🧠 Specialist', color: '#3b82f6', desc: 'Expert LLM for one domain' },
      { type: 'langgraph',  label: '🔎 Smart Agent', color: '#8b5cf6', desc: 'Uses tools to get real data' },
      { type: 'python',     label: '⚙️ Function',    color: '#22c55e', desc: 'Custom Python processing' },
    ],
  },
];

export default function Toolbar({ onOpenTools }) {
  const { startAgents, stopAgents, agentStatuses } = useStudio();
  const anyRunning = Object.values(agentStatuses).some((s) => s === 'running');

  const onDragStart = (e, type) => {
    e.dataTransfer.setData('application/agent-type', type);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="p-3 border-r bg-gray-50 w-52 flex flex-col gap-3 overflow-y-auto">
      {SECTIONS.map((section) => (
        <div key={section.label}>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{section.label}</div>
          <div className="flex flex-col gap-1.5">
            {section.types.map((t) => (
              <div
                key={t.type}
                draggable
                onDragStart={(e) => onDragStart(e, t.type)}
                className="px-2.5 py-2 rounded-lg border bg-white cursor-grab hover:shadow-sm active:shadow-inner select-none transition-shadow"
                style={{ borderColor: t.color, borderLeftWidth: 3 }}
                title={t.desc}
              >
                <div className="text-sm font-semibold" style={{ color: t.color }}>{t.label}</div>
                <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Tool builder */}
      <div>
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Tools</div>
        <button
          onClick={onOpenTools}
          className="w-full px-2.5 py-2 rounded-lg border border-dashed border-orange-300 bg-orange-50 text-sm text-orange-600 font-medium hover:bg-orange-100 transition-colors text-left"
        >
          🔧 Tool Builder
          <div className="text-[10px] text-orange-400 mt-0.5 font-normal">Create AI-generated tools</div>
        </button>
      </div>

      {/* Controls */}
      <div className="mt-auto pt-2 border-t flex flex-col gap-2">
        <button
          onClick={startAgents}
          className={`px-3 py-2 rounded-lg text-white text-sm font-semibold transition-colors ${anyRunning ? 'bg-green-700' : 'bg-green-600 hover:bg-green-700'}`}
        >
          {anyRunning ? '● Agents running' : '▶ Start agents'}
        </button>
        <button onClick={stopAgents} className="px-3 py-2 rounded-lg bg-gray-200 text-gray-700 text-sm hover:bg-gray-300 transition-colors">
          ■ Stop
        </button>
      </div>
    </div>
  );
}

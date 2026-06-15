import React from 'react';
import { useStudio } from '../../store/useStudio';

const TYPES = [
  { type: 'llm_worker', label: '🧠 LLM Worker', color: '#3b82f6' },
  { type: 'langgraph', label: '🕸️ LangGraph', color: '#8b5cf6' },
  { type: 'python', label: '🐍 Python', color: '#22c55e' },
];

export default function Toolbar() {
  const { startAgents, stopAgents } = useStudio();
  const onDragStart = (e, type) => {
    e.dataTransfer.setData('application/agent-type', type);
    e.dataTransfer.effectAllowed = 'move';
  };
  return (
    <div className="p-3 border-r bg-gray-50 w-44 flex flex-col gap-2">
      <div className="text-xs font-bold text-gray-500 uppercase">Agents</div>
      {TYPES.map((t) => (
        <div
          key={t.type}
          draggable
          onDragStart={(e) => onDragStart(e, t.type)}
          className="px-3 py-2 rounded border bg-white text-sm cursor-grab hover:shadow"
          style={{ borderColor: t.color }}
        >
          {t.label}
        </div>
      ))}
      <div className="mt-auto flex flex-col gap-2">
        <button onClick={startAgents} className="px-3 py-2 rounded bg-green-600 text-white text-sm">
          ▶ Start agents
        </button>
        <button onClick={stopAgents} className="px-3 py-2 rounded bg-gray-600 text-white text-sm">
          ■ Stop agents
        </button>
      </div>
    </div>
  );
}

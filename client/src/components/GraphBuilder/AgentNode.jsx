import React from 'react';
import { Handle, Position } from 'reactflow';
import { useStudio } from '../../store/useStudio';

const STYLE = {
  llm_worker: { color: '#3b82f6', label: 'LLM', icon: '🧠' },
  langgraph: { color: '#8b5cf6', label: 'LangGraph', icon: '🕸️' },
  python: { color: '#22c55e', label: 'Python', icon: '🐍' },
};

export default function AgentNode({ id, data }) {
  const status = useStudio((s) => s.agentStatuses[id]);
  const pulse = useStudio((s) => !!s.activePulses[id]);
  const s = STYLE[data.agentType] || STYLE.llm_worker;
  const running = status === 'running';

  return (
    <div
      className={`rounded-lg shadow-md border-2 bg-white min-w-[160px] ${pulse ? 'node-active' : ''}`}
      style={{ borderColor: s.color }}
    >
      <Handle type="target" position={Position.Left} />
      <div className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span>{s.icon}</span>
          <span className="font-semibold text-sm truncate">{data.name}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded text-white" style={{ background: s.color }}>
            {s.label}
          </span>
          <span className={`w-2.5 h-2.5 rounded-full ${running ? 'bg-green-500' : 'bg-gray-300'}`} />
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

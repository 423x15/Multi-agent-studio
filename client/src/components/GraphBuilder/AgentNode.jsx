import React from 'react';
import { Handle, Position } from 'reactflow';
import { useStudio } from '../../store/useStudio';

const STYLE = {
  user:        { color: '#6b7280', bg: '#f9fafb', label: 'You',          icon: '👤' },
  orchestrator:{ color: '#1d4ed8', bg: '#eff6ff', label: 'Manager',      icon: '👑' },
  llm_worker:  { color: '#3b82f6', bg: '#ffffff', label: 'Specialist',   icon: '🧠' },
  langgraph:   { color: '#8b5cf6', bg: '#ffffff', label: 'Smart Agent',  icon: '🔎' },
  python:      { color: '#22c55e', bg: '#ffffff', label: 'Function',     icon: '⚙️' },
};

export default function AgentNode({ id, data }) {
  const status  = useStudio((s) => s.agentStatuses[id]);
  const pulse   = useStudio((s) => !!s.activePulses[id]);
  const type    = data.agentType || 'llm_worker';
  const s       = STYLE[type] || STYLE.llm_worker;
  const running = status === 'running';
  const isOrch  = type === 'orchestrator';
  const isUser  = type === 'user';

  return (
    <div
      className={`rounded-xl shadow-sm min-w-[164px] transition-shadow ${pulse ? 'node-active shadow-lg' : ''}`}
      style={{
        background: s.bg,
        border: `${isOrch ? 3 : 2}px solid ${s.color}`,
        boxShadow: isOrch && !pulse ? `0 0 0 3px ${s.color}22` : undefined,
      }}
    >
      {!isUser && <Handle type="target" position={Position.Left} style={{ background: s.color }} />}

      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">{s.icon}</span>
          <span className="font-semibold text-sm text-gray-800 truncate leading-tight">{data.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: `${s.color}18`, color: s.color }}
          >
            {s.label}
          </span>
          {!isUser && (
            <div className="flex items-center gap-1.5">
              {data.fan_in && <span className="text-[9px] text-purple-400 font-semibold">fan-in</span>}
              <span
                className={`w-2 h-2 rounded-full border ${running ? 'bg-green-400 border-green-500' : 'bg-gray-200 border-gray-300'}`}
                title={running ? 'Running' : 'Stopped'}
              />
            </div>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Right} style={{ background: s.color }} />
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useStudio } from '../../store/useStudio';

const PROVIDER_MODELS = {
  openai:    ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-mini'],
  anthropic: ['claude-opus-4-5-20251001', 'claude-sonnet-4-5', 'claude-haiku-4-5-20251001'],
  mistral:   ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest', 'open-mixtral-8x22b'],
};

const AGENT_LABELS = {
  orchestrator: { icon: '👑', label: 'Manager' },
  llm_worker:   { icon: '🧠', label: 'Specialist' },
  langgraph:    { icon: '🔎', label: 'Smart Agent' },
  python:       { icon: '⚙️', label: 'Function' },
};

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}

function ToolSelector({ selected, onChange, onOpenBuilder }) {
  const [available, setAvailable] = useState([]);
  useEffect(() => {
    fetch('/api/tools').then((r) => r.json()).then(setAvailable);
  }, []);

  if (available.length === 0) {
    return (
      <div className="bg-gray-50 border rounded-lg p-3 text-xs text-gray-400">
        No tools yet.{' '}
        <button onClick={onOpenBuilder} className="text-blue-500 underline">Create a tool →</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {available.map((t) => (
        <label key={t} className="flex items-center gap-2 text-xs bg-gray-50 border rounded px-2 py-1.5 cursor-pointer hover:bg-gray-100">
          <input
            type="checkbox"
            checked={(selected || []).includes(t)}
            onChange={(e) => {
              const cur = new Set(selected || []);
              e.target.checked ? cur.add(t) : cur.delete(t);
              onChange([...cur]);
            }}
          />
          <span className="font-mono">{t}</span>
        </label>
      ))}
      <button onClick={onOpenBuilder} className="text-[10px] text-blue-500 text-left mt-1 hover:underline">
        + Create a new tool
      </button>
    </div>
  );
}

export default function AgentPanel({ onOpenTools }) {
  const id = useStudio((s) => s.selectedNodeId);
  const node = useStudio((s) => s.nodes.find((n) => n.id === id));
  const { updateNodeData, deleteNode, selectNode, activeSystemId } = useStudio();
  const [code, setCode] = useState('');

  useEffect(() => {
    if (node && node.data.agentType === 'python') {
      fetch(`/api/agents/${activeSystemId}/${id}/code`)
        .then((r) => r.json())
        .then((d) => setCode(d.code || ''));
    }
  }, [id]);

  if (!node) return null;
  const d = node.data;
  const type = d.agentType || 'llm_worker';
  const isLLM = ['llm_worker', 'langgraph', 'orchestrator'].includes(type);
  const meta = AGENT_LABELS[type] || { icon: '🧠', label: type };

  const set    = (patch) => updateNodeData(id, patch);
  const setLLM = (patch) => updateNodeData(id, { llm: { ...d.llm, ...patch } });

  const saveCode = () =>
    fetch(`/api/agents/${activeSystemId}/${id}/code`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

  if (type === 'user') {
    return (
      <div className="bg-white h-full overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-bold text-gray-700">👤 You</span>
          <button onClick={() => selectNode(null)} className="text-gray-300 hover:text-gray-500 text-lg">✕</button>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <p className="text-sm text-gray-500 leading-relaxed">
            This represents <strong>you</strong>. Connect it to a <strong>Manager</strong> — your input will be forwarded when you click Run.
          </p>
          <Field label="Label">
            <input className="border rounded-lg px-3 py-1.5 text-sm" value={d.name}
              onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <button onClick={() => deleteNode(id)} className="mt-auto px-3 py-1.5 rounded-lg border border-red-200 text-red-500 text-sm hover:bg-red-50">
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white h-full overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-lg">{meta.icon}</span>
          <div>
            <div className="font-bold text-sm text-gray-800">{d.name || meta.label}</div>
            <div className="text-[10px] text-gray-400">{meta.label}</div>
          </div>
        </div>
        <button onClick={() => selectNode(null)} className="text-gray-300 hover:text-gray-500 text-lg">✕</button>
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1">
        <Field label="Name">
          <input className="border rounded-lg px-3 py-1.5 text-sm" value={d.name}
            onChange={(e) => set({ name: e.target.value })} />
        </Field>

        <Field label="Description">
          <textarea className="border rounded-lg px-3 py-1.5 text-sm resize-none" rows={2}
            value={d.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>

        {type === 'orchestrator' && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-2.5 text-xs text-blue-600">
            Connected workers are called in <strong>parallel</strong> as tool calls. Results are passed to the LLM below for synthesis.
          </div>
        )}

        {isLLM && (
          <>
            <div className="border-t pt-3">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Model</div>
              <div className="flex flex-col gap-2">
                <Field label="Provider">
                  <select className="border rounded-lg px-3 py-1.5 text-sm" value={d.llm?.provider || 'openai'}
                    onChange={(e) => {
                      const provider = e.target.value;
                      setLLM({ provider, model: PROVIDER_MODELS[provider]?.[0] ?? '' });
                    }}>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="mistral">Mistral</option>
                  </select>
                </Field>
                <Field label="Model">
                  <select className="border rounded-lg px-3 py-1.5 text-sm" value={d.llm?.model || ''}
                    onChange={(e) => setLLM({ model: e.target.value })}>
                    {(PROVIDER_MODELS[d.llm?.provider] ?? []).map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </Field>
                <Field label={`Temperature — ${d.llm?.temperature ?? 0.7}`}>
                  <input type="range" min="0" max="2" step="0.1" className="w-full accent-blue-500"
                    value={d.llm?.temperature ?? 0.7}
                    onChange={(e) => setLLM({ temperature: +e.target.value })} />
                </Field>
              </div>
            </div>

            <Field label="System prompt">
              <textarea
                className="border rounded-lg px-3 py-1.5 text-xs font-mono resize-none leading-relaxed"
                rows={type === 'orchestrator' ? 5 : 4}
                value={d.llm?.system_prompt || ''}
                onChange={(e) => setLLM({ system_prompt: e.target.value })}
              />
            </Field>
          </>
        )}

        {type === 'langgraph' && (
          <div className="border-t pt-3">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Tools available to this agent</div>
            <ToolSelector
              selected={d.tools || []}
              onChange={(tools) => set({ tools })}
              onOpenBuilder={onOpenTools}
            />
          </div>
        )}

        {type === 'python' && (
          <div className="border-t pt-3 flex flex-col gap-2">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">runner.py</div>
            <div className="border rounded-lg overflow-hidden">
              <Editor height="240px" defaultLanguage="python" value={code}
                onChange={(v) => setCode(v || '')} options={{ minimap: { enabled: false }, fontSize: 11 }} />
            </div>
            <button onClick={saveCode} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium">
              Save code
            </button>
          </div>
        )}

        <div className="border-t pt-3 flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
            <input type="checkbox" checked={!!d.fan_in} onChange={(e) => set({ fan_in: e.target.checked })} />
            Wait for <em>all</em> upstream agents before processing (fan-in)
          </label>
          <Field label="Timeout (s)">
            <input type="number" className="border rounded-lg px-3 py-1.5 text-sm w-24"
              value={d.timeout_seconds || 120}
              onChange={(e) => set({ timeout_seconds: +e.target.value })} />
          </Field>
        </div>

        <button onClick={() => deleteNode(id)}
          className="mt-auto px-3 py-1.5 rounded-lg border border-red-200 text-red-500 text-sm hover:bg-red-50">
          Remove agent
        </button>
      </div>
    </div>
  );
}

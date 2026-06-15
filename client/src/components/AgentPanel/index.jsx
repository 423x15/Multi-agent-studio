import React, { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useStudio } from '../../store/useStudio';

const TOOLS = ['web_search', 'calculator', 'code_interpreter', 'custom'];

export default function AgentPanel() {
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
  const isLLM = d.agentType === 'llm_worker' || d.agentType === 'langgraph';

  const set = (patch) => updateNodeData(id, patch);
  const setLLM = (patch) => updateNodeData(id, { llm: { ...d.llm, ...patch } });

  const saveCode = async () => {
    await fetch(`/api/agents/${activeSystemId}/${id}/code`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
  };

  return (
    <div className="w-96 border-l bg-white h-full overflow-y-auto p-4 flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <h2 className="font-bold">{d.agentType}</h2>
        <button onClick={() => selectNode(null)} className="text-gray-400">✕</button>
      </div>

      <label className="text-xs text-gray-500">Name
        <input className="w-full border rounded px-2 py-1 mt-0.5" value={d.name}
          onChange={(e) => set({ name: e.target.value })} />
      </label>

      <label className="text-xs text-gray-500">Description
        <textarea className="w-full border rounded px-2 py-1 mt-0.5" rows={2} value={d.description}
          onChange={(e) => set({ description: e.target.value })} />
      </label>

      <label className="text-xs text-gray-500">Timeout (s)
        <input type="number" className="w-full border rounded px-2 py-1 mt-0.5" value={d.timeout_seconds}
          onChange={(e) => set({ timeout_seconds: +e.target.value })} />
      </label>

      {isLLM && (
        <>
          <label className="text-xs text-gray-500">Provider
            <select className="w-full border rounded px-2 py-1 mt-0.5" value={d.llm.provider}
              onChange={(e) => setLLM({ provider: e.target.value })}>
              <option value="openai">openai</option>
              <option value="anthropic">anthropic</option>
            </select>
          </label>
          <label className="text-xs text-gray-500">Model
            <input className="w-full border rounded px-2 py-1 mt-0.5" value={d.llm.model}
              onChange={(e) => setLLM({ model: e.target.value })} />
          </label>
          <label className="text-xs text-gray-500">Temperature: {d.llm.temperature}
            <input type="range" min="0" max="2" step="0.1" className="w-full" value={d.llm.temperature}
              onChange={(e) => setLLM({ temperature: +e.target.value })} />
          </label>
          <label className="text-xs text-gray-500">System prompt
            <textarea className="w-full border rounded px-2 py-1 mt-0.5 font-mono text-xs" rows={6}
              value={d.llm.system_prompt} onChange={(e) => setLLM({ system_prompt: e.target.value })} />
          </label>
        </>
      )}

      {d.agentType === 'langgraph' && (
        <div className="text-xs text-gray-500">
          <div className="mb-1">Tools</div>
          {TOOLS.map((t) => (
            <label key={t} className="flex items-center gap-1">
              <input type="checkbox" checked={(d.tools || []).includes(t)}
                onChange={(e) => {
                  const cur = new Set(d.tools || []);
                  e.target.checked ? cur.add(t) : cur.delete(t);
                  set({ tools: [...cur] });
                }} />
              {t}
            </label>
          ))}
        </div>
      )}

      {d.agentType === 'python' && (
        <div className="flex flex-col gap-1">
          <div className="text-xs text-gray-500">runner.py</div>
          <div className="border rounded overflow-hidden">
            <Editor height="260px" defaultLanguage="python" value={code}
              onChange={(v) => setCode(v || '')} options={{ minimap: { enabled: false }, fontSize: 12 }} />
          </div>
          <button onClick={saveCode} className="px-3 py-1 rounded bg-blue-600 text-white text-sm">Save code</button>
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-gray-600">
        <input type="checkbox" checked={!!d.fan_in} onChange={(e) => set({ fan_in: e.target.checked })} />
        Fan-in: wait for all source agents
      </label>

      <button onClick={() => deleteNode(id)} className="mt-2 px-3 py-1 rounded bg-red-600 text-white text-sm">
        Delete agent
      </button>
    </div>
  );
}

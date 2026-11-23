import React, { useCallback, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';

export default function ToolBuilder({ onClose }) {
  const [tools, setTools]       = useState([]);
  const [name, setName]         = useState('');
  const [desc, setDesc]         = useState('');
  const [code, setCode]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const loadTools = useCallback(() =>
    fetch('/api/tools').then((r) => r.json()).then(setTools), []);

  useEffect(() => { loadTools(); }, [loadTools]);

  const generate = async () => {
    if (!desc.trim()) return;
    setLoading(true); setError(''); setCode('');
    try {
      const r = await fetch('/api/tools/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc }),
      });
      const d = await r.json();
      if (d.error) { setError(d.error); } else { setCode(d.code); }
    } catch (e) { setError(String(e)); }
    setLoading(false);
  };

  const save = async () => {
    if (!name || !code) return;
    setSaving(true); setError(''); setSuccess('');
    const r = await fetch('/api/tools/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, code }),
    });
    const d = await r.json();
    if (d.error) { setError(d.error); } else { setSuccess(`✓ "${name}" saved`); loadTools(); }
    setSaving(false);
  };

  const deleteTool = async (t) => {
    await fetch(`/api/tools/${t}`, { method: 'DELETE' });
    loadTools();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-[860px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="font-bold text-lg">🔧 Tool Builder</h2>
            <p className="text-xs text-gray-400 mt-0.5">Describe a tool → AI generates the Python code → Save → Use in Smart Agents</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left — saved tools */}
          <div className="w-52 border-r p-4 flex flex-col gap-2 overflow-y-auto shrink-0">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">My Tools</div>
            {tools.length === 0 && <p className="text-xs text-gray-400">No tools yet.</p>}
            {tools.map((t) => (
              <div key={t} className="flex items-center justify-between bg-gray-50 border rounded px-2 py-1.5 text-xs">
                <span className="font-mono truncate">{t}</span>
                <button onClick={() => deleteTool(t)} className="text-gray-300 hover:text-red-400 ml-1">✕</button>
              </div>
            ))}
          </div>

          {/* Right — create tool */}
          <div className="flex-1 p-5 flex flex-col gap-3 overflow-y-auto">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500 font-medium">Tool name <span className="text-gray-300">(snake_case)</span></label>
                <input
                  className="w-full border rounded px-3 py-1.5 text-sm font-mono mt-1"
                  placeholder="e.g. word_counter"
                  value={name}
                  onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))}
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 font-medium">Describe what this tool should do</label>
              <div className="flex gap-2 mt-1">
                <textarea
                  className="flex-1 border rounded px-3 py-2 text-sm resize-none"
                  rows={2}
                  placeholder="e.g. Count the number of words in a text and return the count"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) generate(); }}
                />
                <button
                  onClick={generate}
                  disabled={loading || !desc.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-40 self-start whitespace-nowrap"
                >
                  {loading ? '⏳ Generating…' : '✨ Generate'}
                </button>
              </div>
            </div>

            {error && <p className="text-red-500 text-xs bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

            {(code || loading) && (
              <div className="flex flex-col gap-1 flex-1 min-h-0">
                <label className="text-xs text-gray-500 font-medium">Generated code — review &amp; edit before saving</label>
                <div className="border rounded overflow-hidden" style={{ height: 260 }}>
                  <Editor
                    language="python"
                    value={loading ? '# Generating…' : code}
                    onChange={(v) => setCode(v || '')}
                    options={{ minimap: { enabled: false }, fontSize: 12, readOnly: loading }}
                  />
                </div>
              </div>
            )}

            {success && <p className="text-green-600 text-xs font-medium">{success}</p>}

            <div className="flex justify-end mt-auto pt-2">
              <button
                onClick={save}
                disabled={saving || !name || !code}
                className="px-5 py-2 bg-green-600 text-white rounded text-sm font-medium disabled:opacity-40"
              >
                {saving ? 'Saving…' : '💾 Save tool'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

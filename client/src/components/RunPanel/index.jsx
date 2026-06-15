import React, { useState } from 'react';
import { useStudio } from '../../store/useStudio';

export default function RunPanel() {
  const { startRun, finalResult, agentStatuses } = useStudio();
  const [input, setInput] = useState('');
  const anyRunning = Object.values(agentStatuses).some((s) => s === 'running');

  return (
    <div className="border-t bg-white p-3 flex flex-col gap-2" style={{ height: 260 }}>
      <div className="flex gap-2 h-full">
        <div className="flex flex-col gap-2 w-1/2">
          <textarea className="flex-1 border rounded p-2 text-sm"
            placeholder="Paste your question or input text..."
            value={input} onChange={(e) => setInput(e.target.value)} />
          <button disabled={!anyRunning || !input.trim()}
            onClick={() => startRun(input)}
            className="px-3 py-2 rounded bg-orange-600 text-white text-sm disabled:opacity-40">
            {anyRunning ? '▶ Run' : 'Start agents first'}
          </button>
        </div>
        <div className="w-1/2 border rounded p-2 overflow-y-auto bg-gray-50">
          <div className="text-xs font-bold text-gray-500 mb-1">Final result</div>
          <pre className="text-xs whitespace-pre-wrap">{finalResult || '—'}</pre>
        </div>
      </div>
    </div>
  );
}

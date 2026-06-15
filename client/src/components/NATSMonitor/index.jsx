import React, { useEffect, useRef, useState } from 'react';
import { useStudio } from '../../store/useStudio';

export default function NATSMonitor() {
  const msgs = useStudio((s) => s.natsMessages);
  const ref = useRef(null);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [msgs]);

  return (
    <div className="flex flex-col h-full">
      <div className="text-xs font-bold text-gray-500 p-2 border-b">NATS Monitor</div>
      <div ref={ref} className="flex-1 overflow-y-auto text-xs font-mono">
        <table className="w-full">
          <tbody>
            {msgs.map((m, i) => {
              const e = m.envelope || {};
              const p = String(e.payload || '');
              return (
                <tr key={i} className="border-b hover:bg-gray-50 cursor-pointer"
                  onClick={() => setOpen(open === i ? null : i)}>
                  <td className="px-2 py-0.5 text-gray-400">{new Date(m.ts).toLocaleTimeString()}</td>
                  <td className="px-2 py-0.5 text-blue-600">{e.from_agent}</td>
                  <td className="px-2 py-0.5 text-purple-600">{m.subject}</td>
                  <td className="px-2 py-0.5">{open === i ? p : p.slice(0, 100)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

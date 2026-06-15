import React, { useEffect, useState } from 'react';
import { useStudio } from './store/useStudio';
import SystemList from './components/SystemList';
import GraphBuilder from './components/GraphBuilder';
import AgentPanel from './components/AgentPanel';
import RunPanel from './components/RunPanel';
import NATSMonitor from './components/NATSMonitor';
import LogViewer from './components/LogViewer';

export default function App() {
  const { activeSystemId, selectedNodeId, connectWs } = useStudio();
  const [tab, setTab] = useState('nats');

  useEffect(() => { connectWs(); }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="h-10 bg-gray-900 text-white flex items-center px-4 font-bold text-sm">
        Multi-Agent Studio
      </div>
      <div className="flex flex-1 min-h-0">
        <SystemList />
        {activeSystemId ? (
          <div className="flex flex-1 min-h-0">
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex-1 min-h-0"><GraphBuilder /></div>
              <RunPanel />
            </div>
            <div className="w-[28rem] border-l flex flex-col min-h-0">
              <div className="flex border-b text-xs">
                <button className={`px-3 py-2 ${tab === 'nats' ? 'bg-gray-100 font-bold' : ''}`}
                  onClick={() => setTab('nats')}>NATS</button>
                <button className={`px-3 py-2 ${tab === 'logs' ? 'bg-gray-100 font-bold' : ''}`}
                  onClick={() => setTab('logs')}>Logs</button>
              </div>
              <div className="flex-1 min-h-0">
                {tab === 'nats' ? <NATSMonitor /> : <LogViewer />}
              </div>
            </div>
            {selectedNodeId && <AgentPanel />}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Create or select a system to begin.
          </div>
        )}
      </div>
    </div>
  );
}

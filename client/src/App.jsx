import React, { useEffect, useState } from 'react';
import { useStudio } from './store/useStudio';
import SystemList from './components/SystemList';
import GraphBuilder from './components/GraphBuilder';
import AgentPanel from './components/AgentPanel';
import RunPanel from './components/RunPanel';
import NATSMonitor from './components/NATSMonitor';
import LogViewer from './components/LogViewer';
import StatsPanel from './components/StatsPanel';
import TestPanel from './components/TestPanel';
import ToolBuilder from './components/ToolBuilder';
import Demo from './components/Demo';

export default function App() {
  const { activeSystemId, selectedNodeId, connectWs } = useStudio();
  const [tab, setTab] = useState('stats');
  const [toolBuilderOpen, setToolBuilderOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  useEffect(() => { connectWs(); }, []);

  const tabs = [
    { id: 'stats', label: 'Stats' },
    { id: 'tests', label: 'Tests' },
    { id: 'logs',  label: 'Logs'  },
    { id: 'nats',  label: 'NATS'  },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="h-12 bg-slate-900 text-white flex items-center px-5 gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">🕸️</span>
          <span className="font-bold text-sm tracking-tight">Multi-Agent Studio</span>
        </div>
        <span className="text-slate-600 text-xs select-none">|</span>
        <span className="text-slate-400 text-xs hidden sm:block">
          Build · Run · Monitor multi-agent AI pipelines
        </span>
        <div className="ml-auto">
          <button
            onClick={() => setDemoOpen(true)}
            className="text-xs px-3 py-1 rounded-full border border-slate-600 text-slate-400 hover:border-blue-500 hover:text-blue-400 transition-colors"
          >
            ▶ Demo
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        <SystemList />

        {activeSystemId ? (
          <div className="flex flex-1 min-h-0">
            {/* Canvas + run panel */}
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex-1 min-h-0">
                <GraphBuilder onOpenTools={() => setToolBuilderOpen(true)} />
              </div>
              <RunPanel />
            </div>

            {/* Right panel — agent config OR monitoring */}
            <div className="w-[26rem] border-l bg-white flex flex-col min-h-0 shrink-0">
              {selectedNodeId ? (
                <AgentPanel onOpenTools={() => setToolBuilderOpen(true)} />
              ) : (
                <>
                  <div className="flex border-b bg-gray-50 shrink-0">
                    {tabs.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                          tab === t.id
                            ? 'text-blue-600 border-b-2 border-blue-500 bg-white'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 min-h-0 overflow-hidden">
                    {tab === 'stats' && <StatsPanel />}
                    {tab === 'tests' && <TestPanel />}
                    {tab === 'logs'  && <LogViewer />}
                    {tab === 'nats'  && <NATSMonitor />}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            <div className="text-5xl opacity-20">🕸️</div>
            <div className="text-gray-500 font-medium">Create or select a system to begin</div>
            <div className="text-gray-400 text-sm max-w-sm">
              Build a pipeline of AI agents that communicate via NATS JetStream.
              Each agent runs as an isolated process — crash-safe and observable.
            </div>
          </div>
        )}
      </div>

      {toolBuilderOpen && <ToolBuilder onClose={() => setToolBuilderOpen(false)} />}
      {demoOpen && <Demo onExit={() => setDemoOpen(false)} />}
    </div>
  );
}

import React, { useCallback, useRef } from 'react';
import ReactFlow, { Background, Controls, MiniMap, ReactFlowProvider } from 'reactflow';
import { useStudio } from '../../store/useStudio';
import AgentNode from './AgentNode';
import Toolbar from './Toolbar';

const nodeTypes = { agent: AgentNode };

function EdgeLegend() {
  return (
    <div className="absolute bottom-10 left-3 z-10 bg-white/90 backdrop-blur-sm border rounded-lg px-3 py-2 text-[10px] text-gray-500 shadow-sm pointer-events-none select-none">
      <div className="font-bold text-gray-400 uppercase tracking-wide mb-1.5">Edge types</div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="w-8 h-0.5 bg-blue-500 inline-block rounded" />
          <span>request — You → Manager</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-8 inline-block" style={{ borderTop: '2px dashed #f97316', marginTop: 1 }} />
          <span>tool call — Manager → Worker</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-8 h-0.5 bg-gray-300 inline-block rounded" />
          <span>NATS message — Agent → Agent</span>
        </div>
      </div>
    </div>
  );
}

function Canvas({ onOpenTools }) {
  const wrapper = useRef(null);
  const rfRef = useRef(null);
  const { nodes, edges, activePulses, onNodesChange, onEdgesChange, onConnect, addNode, selectNode } = useStudio();

  const styledEdges = edges.map((e) => {
    const srcNode = nodes.find((n) => n.id === e.source);
    const srcType = srcNode?.data?.agentType;
    const isRequest  = srcType === 'user';
    const isToolCall = srcType === 'orchestrator';
    const active = !!activePulses[e.source];

    return {
      ...e,
      animated: active,
      style: isToolCall
        ? { strokeDasharray: '6 3', stroke: '#f97316', strokeWidth: 2 }
        : isRequest
        ? { stroke: '#3b82f6', strokeWidth: 2 }
        : { stroke: '#94a3b8', strokeWidth: 1.5 },
      label: isToolCall ? 'tool call' : isRequest ? 'request' : undefined,
      labelStyle: {
        fontSize: 9,
        fill: isToolCall ? '#f97316' : '#3b82f6',
        fontFamily: 'monospace',
        fontWeight: 600,
      },
      labelBgStyle: { fill: '#ffffff', fillOpacity: 0.85 },
      labelBgPadding: [3, 2],
      labelBgBorderRadius: 3,
    };
  });

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/agent-type');
    if (!type || !rfRef.current) return;
    const pos = rfRef.current.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    addNode(type, pos);
  }, [addNode]);

  return (
    <div
      className="flex-1 h-full relative"
      ref={wrapper}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
      onDrop={onDrop}
    >
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="text-center select-none">
            <div className="text-5xl mb-3 opacity-30">🕸️</div>
            <div className="font-semibold text-gray-400">Drag blocks from the left panel</div>
            <div className="text-sm text-gray-300 mt-1">Start with <strong>You</strong> → <strong>Manager</strong> → Workers</div>
            <div className="text-sm text-gray-300 mt-0.5">or click <strong>✦ Load example</strong></div>
          </div>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, n) => selectNode(n.id)}
        onInit={(inst) => (rfRef.current = inst)}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <Background color="#e2e8f0" gap={20} />
        <Controls />
        <MiniMap nodeColor={(n) => {
          const t = n.data?.agentType;
          return t === 'orchestrator' ? '#1d4ed8' : t === 'user' ? '#6b7280'
               : t === 'langgraph' ? '#8b5cf6' : t === 'python' ? '#22c55e' : '#3b82f6';
        }} />
      </ReactFlow>
      <EdgeLegend />
    </div>
  );
}

export default function GraphBuilder({ onOpenTools }) {
  return (
    <ReactFlowProvider>
      <div className="flex flex-1 h-full">
        <Toolbar onOpenTools={onOpenTools} />
        <Canvas onOpenTools={onOpenTools} />
      </div>
    </ReactFlowProvider>
  );
}

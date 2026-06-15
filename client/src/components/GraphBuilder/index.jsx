import React, { useCallback, useRef } from 'react';
import ReactFlow, { Background, Controls, MiniMap, ReactFlowProvider } from 'reactflow';
import { useStudio } from '../../store/useStudio';
import AgentNode from './AgentNode';
import Toolbar from './Toolbar';

const nodeTypes = { agent: AgentNode };

function Canvas() {
  const wrapper = useRef(null);
  const rfRef = useRef(null);
  const {
    nodes, edges, activePulses,
    onNodesChange, onEdgesChange, onConnect, addNode, selectNode,
  } = useStudio();

  // mark edges active when source pulsing
  const styledEdges = edges.map((e) => ({
    ...e,
    className: activePulses[e.source] ? 'active' : '',
    animated: !!activePulses[e.source],
  }));

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/agent-type');
    if (!type || !rfRef.current) return;
    const pos = rfRef.current.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    addNode(type, pos);
  }, [addNode]);

  return (
    <div className="flex-1 h-full" ref={wrapper}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
      onDrop={onDrop}>
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
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}

export default function GraphBuilder() {
  return (
    <ReactFlowProvider>
      <div className="flex flex-1 h-full">
        <Toolbar />
        <Canvas />
      </div>
    </ReactFlowProvider>
  );
}

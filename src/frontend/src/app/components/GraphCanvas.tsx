import { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { graphNodeTypes } from '../graph/nodeTypes';
import type { GraphEdge, GraphNode, SelectedElement } from '../graph/types';

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  onElementSelect: (element: SelectedElement) => void;
  onPaneClick: () => void;
}

export function GraphCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onElementSelect,
  onPaneClick,
}: GraphCanvasProps) {
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: GraphNode) => {
      onElementSelect({ type: 'node', id: node.id });
    },
    [onElementSelect]
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: GraphEdge) => {
      onElementSelect({ type: 'edge', id: edge.id });
    },
    [onElementSelect]
  );

  return (
    <div className="absolute inset-0 size-full">
      {nodes.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="rounded-lg border border-border bg-background/90 px-5 py-4 text-center shadow-2xl backdrop-blur-sm">
            <h3 className="mb-1">No nodes yet</h3>
            <p className="text-sm text-muted-foreground">This roadmap is ready for its first node.</p>
          </div>
        </div>
      ) : null}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodeTypes={graphNodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        minZoom={0.5}
        maxZoom={1.5}
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            switch (node.type) {
              case 'objective': return '#3b82f6';
              case 'milestone': return '#8b5cf6';
              case 'event': return '#ec4899';
              case 'artifact': return '#10b981';
              default: return '#94a3b8';
            }
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>
    </div>
  );
}

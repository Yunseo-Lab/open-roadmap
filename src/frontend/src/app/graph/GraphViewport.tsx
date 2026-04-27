import {
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { graphNodeTypes } from './nodeTypes';
import type { GraphEdge, GraphNode } from './types';

interface GraphViewportProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodesChange?: (changes: NodeChange[]) => void;
  onEdgesChange?: (changes: EdgeChange[]) => void;
  onConnect?: (connection: Connection) => void;
  onNodeClick?: (event: React.MouseEvent, node: GraphNode) => void;
  onEdgeClick?: (event: React.MouseEvent, edge: GraphEdge) => void;
  onPaneClick?: () => void;
  nodesDraggable?: boolean;
  nodesConnectable?: boolean;
  elementsSelectable?: boolean;
  panOnDrag?: boolean | number[];
  zoomOnScroll?: boolean;
  controlsInteractive?: boolean;
}

export function GraphViewport({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onEdgeClick,
  onPaneClick,
  nodesDraggable,
  nodesConnectable,
  elementsSelectable,
  panOnDrag,
  zoomOnScroll,
  controlsInteractive = true,
}: GraphViewportProps) {
  return (
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
      nodesDraggable={nodesDraggable}
      nodesConnectable={nodesConnectable}
      elementsSelectable={elementsSelectable}
      panOnDrag={panOnDrag}
      zoomOnScroll={zoomOnScroll}
    >
      <Background />
      <Controls showInteractive={controlsInteractive} />
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
  );
}

import type { NodeProps } from '@xyflow/react';

export type NodeType = 'objective' | 'milestone' | 'event' | 'artifact';
export type EdgeType = 'supports' | 'depends_on' | 'evidences' | 'next';
export type NodeHandleId = 'top' | 'right' | 'bottom' | 'left';

export type NodeAttachment = {
  type: string;
  name: string;
  url: string;
};

export interface GraphNode {
  id: string;
  type: NodeType;
  data: {
    label: string;
    description?: string;
    status?: string;
    date?: string;
    attachments?: NodeAttachment[];
    metadata?: Record<string, unknown>;
  };
  position: { x: number; y: number };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: 'smoothstep';
  label?: string;
  data?: {
    kind?: EdgeType;
    label?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  };
}

export type SelectedElement =
  | { type: 'node'; id: string }
  | { type: 'edge'; id: string }
  | null;

export type SelectedElementData =
  | { type: 'node'; data: GraphNode }
  | { type: 'edge'; data: GraphEdge }
  | null;

export type ElementUpdates = Partial<GraphNode['data']> & {
  kind?: EdgeType;
  label?: string;
  description?: string;
};

export type CreateNodeData = Partial<GraphNode['data']>;
export type NodeViewProps = NodeProps<GraphNode>;

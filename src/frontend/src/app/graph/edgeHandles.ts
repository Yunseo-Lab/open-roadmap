import type { GraphEdge, GraphNode, NodeHandleId } from './types';

const handleIds = new Set<NodeHandleId>(['top', 'right', 'bottom', 'left']);
const defaultNodeSize = {
  objective: { width: 240, height: 140 },
  milestone: { width: 220, height: 130 },
  event: { width: 200, height: 110 },
  artifact: { width: 200, height: 110 },
};

export function withAutoEdgeHandles(nodes: GraphNode[], edges: GraphEdge[]): GraphEdge[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  return edges.map((edge) => {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) {
      return edge;
    }

    const autoHandles = inferEdgeHandles(source, target);
    const sourceHandle = explicitHandle(edge.sourceHandle) ?? metadataHandle(edge, 'sourceHandle') ?? autoHandles.sourceHandle;
    const targetHandle = explicitHandle(edge.targetHandle) ?? metadataHandle(edge, 'targetHandle') ?? autoHandles.targetHandle;

    if (sourceHandle === edge.sourceHandle && targetHandle === edge.targetHandle) {
      return edge;
    }

    return {
      ...edge,
      sourceHandle,
      targetHandle,
    };
  });
}

function inferEdgeHandles(source: GraphNode, target: GraphNode): {
  sourceHandle: NodeHandleId;
  targetHandle: NodeHandleId;
} {
  const sourceCenter = nodeCenter(source);
  const targetCenter = nodeCenter(target);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: 'right', targetHandle: 'left' }
      : { sourceHandle: 'left', targetHandle: 'right' };
  }

  return dy >= 0
    ? { sourceHandle: 'bottom', targetHandle: 'top' }
    : { sourceHandle: 'top', targetHandle: 'bottom' };
}

function explicitHandle(value: string | null | undefined): NodeHandleId | undefined {
  return typeof value === 'string' && handleIds.has(value as NodeHandleId)
    ? (value as NodeHandleId)
    : undefined;
}

function metadataHandle(edge: GraphEdge, key: 'sourceHandle' | 'targetHandle'): NodeHandleId | undefined {
  const value = edge.data?.metadata?.[key];
  return explicitHandle(typeof value === 'string' ? value : undefined);
}

function nodeCenter(node: GraphNode): { x: number; y: number } {
  const measured = (node as GraphNode & {
    measured?: { width?: number; height?: number };
    width?: number;
    height?: number;
  });
  const fallbackSize = defaultNodeSize[node.type];
  const width = measured.measured?.width ?? measured.width ?? fallbackSize.width;
  const height = measured.measured?.height ?? measured.height ?? fallbackSize.height;

  return {
    x: node.position.x + width / 2,
    y: node.position.y + height / 2,
  };
}

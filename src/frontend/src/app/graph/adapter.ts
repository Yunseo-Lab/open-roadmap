import type { RoadmapGraph, SaveRoadmapGraphInput } from '../../types';
import type { EdgeType, GraphEdge, GraphNode, NodeAttachment, NodeType } from './types';

export function toApiGraph(nodes: GraphNode[], edges: GraphEdge[]): SaveRoadmapGraphInput {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: {
        title: node.data.label,
        description: node.data.description || '',
        status: node.data.status || 'planned',
        metadata: toApiNodeMetadata(node),
      },
    })),
    edges: edges.map((edge) => {
      const kind = edge.data?.kind || 'supports';
      const label = edge.data?.label || edge.label || '';
      const sourceHandle = edge.sourceHandle ?? getMetadataString(edge.data?.metadata, 'sourceHandle');
      const targetHandle = edge.targetHandle ?? getMetadataString(edge.data?.metadata, 'targetHandle');

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        ...(sourceHandle ? { sourceHandle } : {}),
        ...(targetHandle ? { targetHandle } : {}),
        type: 'smoothstep' as const,
        label,
        data: {
          kind,
          label,
          metadata: toApiEdgeMetadata(edge),
        },
      };
    }),
  };
}

export function toWorkspaceNode(node: RoadmapGraph['nodes'][number]): GraphNode {
  const metadata = { ...(node.data.metadata ?? {}) };
  const type = isNodeType(node.type) ? node.type : 'objective';
  const date = typeof metadata.date === 'string' ? metadata.date : undefined;
  const attachments = getAttachments(metadata.attachments);
  delete metadata.date;
  delete metadata.attachments;

  const data: GraphNode['data'] = {
    label: node.data.title,
    metadata,
  };

  if (node.data.description) {
    data.description = node.data.description;
  }

  if (node.data.status) {
    data.status = node.data.status;
  }

  if (date) {
    data.date = date;
  }

  if (attachments) {
    data.attachments = attachments;
  }

  return {
    id: node.id,
    type,
    data,
    position: node.position,
  };
}

export function toWorkspaceEdge(edge: RoadmapGraph['edges'][number]): GraphEdge {
  const metadata = { ...(edge.data.metadata ?? {}) };
  const label = edge.data.label || edge.label || edge.data.kind;
  const sourceHandle = edge.sourceHandle ?? getMetadataString(metadata, 'sourceHandle');
  const targetHandle = edge.targetHandle ?? getMetadataString(metadata, 'targetHandle');
  const description = getMetadataString(metadata, 'description');

  delete metadata.sourceHandle;
  delete metadata.targetHandle;
  delete metadata.description;

  const data: NonNullable<GraphEdge['data']> = {
    kind: isEdgeType(edge.data.kind) ? edge.data.kind : 'supports',
    label,
    metadata,
  };

  if (description) {
    data.description = description;
  }

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    ...(sourceHandle ? { sourceHandle } : {}),
    ...(targetHandle ? { targetHandle } : {}),
    type: edge.type,
    label,
    data,
  };
}

function toApiNodeMetadata(node: GraphNode): Record<string, unknown> {
  const metadata = { ...node.data.metadata };

  if (node.data.date) {
    metadata.date = node.data.date;
  } else {
    delete metadata.date;
  }

  if (node.data.attachments && node.data.attachments.length > 0) {
    metadata.attachments = node.data.attachments;
  } else {
    delete metadata.attachments;
  }

  return metadata;
}

function toApiEdgeMetadata(edge: GraphEdge): Record<string, unknown> {
  const metadata = { ...edge.data?.metadata };
  const sourceHandle = edge.sourceHandle ?? getMetadataString(metadata, 'sourceHandle');
  const targetHandle = edge.targetHandle ?? getMetadataString(metadata, 'targetHandle');

  if (sourceHandle) {
    metadata.sourceHandle = sourceHandle;
  } else {
    delete metadata.sourceHandle;
  }

  if (targetHandle) {
    metadata.targetHandle = targetHandle;
  } else {
    delete metadata.targetHandle;
  }

  if (edge.data?.description) {
    metadata.description = edge.data.description;
  } else {
    delete metadata.description;
  }

  return metadata;
}

function getMetadataString(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' ? value : undefined;
}

function isNodeType(value: string): value is NodeType {
  return value === 'objective' || value === 'milestone' || value === 'event' || value === 'artifact';
}

function isEdgeType(value: string): value is EdgeType {
  return value === 'supports' || value === 'depends_on' || value === 'evidences' || value === 'next';
}

function getAttachments(value: unknown): NodeAttachment[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter(isAttachment);
}

function isAttachment(value: unknown): value is NodeAttachment {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const attachment = value as Record<string, unknown>;
  return (
    typeof attachment.type === 'string' &&
    typeof attachment.name === 'string' &&
    typeof attachment.url === 'string'
  );
}

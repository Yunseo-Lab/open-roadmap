import { describe, expect, it } from 'vitest';
import { normalizeGraph } from '../../../../shared/graph';
import { toApiGraph, toWorkspaceEdge, toWorkspaceNode } from './adapter';
import type { GraphEdge, GraphNode } from './types';

describe('workspace graph adapter', () => {
  it('preserves editable node and edge fields through save and restore', () => {
    const nodes: GraphNode[] = [
      {
        id: 'objective-main',
        type: 'objective',
        position: { x: 120, y: 80 },
        data: {
          label: 'Become senior engineer',
          description: 'Career objective',
          status: 'active',
          metadata: { priority: 'high' },
        },
      },
      {
        id: 'milestone-beta',
        type: 'milestone',
        position: { x: 420, y: 140 },
        data: {
          label: 'Ship beta',
          description: 'Release the first beta',
          status: 'in-progress',
          date: '2026-04-27',
          attachments: [
            {
              type: 'link',
              name: 'Release plan',
              url: 'https://example.com/release-plan',
            },
          ],
          metadata: { owner: 'product' },
        },
      },
    ];
    const edges: GraphEdge[] = [
      {
        id: 'milestone-supports-objective',
        source: 'milestone-beta',
        target: 'objective-main',
        sourceHandle: 'right',
        targetHandle: 'left',
        type: 'smoothstep',
        label: 'Supports',
        data: {
          kind: 'supports',
          label: 'Supports',
          description: 'This milestone moves the objective forward.',
          metadata: { confidence: 0.9 },
        },
      },
    ];

    const savedGraph = normalizeGraph(toApiGraph(nodes, edges));
    const restoredNodes = savedGraph.nodes.map(toWorkspaceNode);
    const restoredEdges = savedGraph.edges.map(toWorkspaceEdge);

    expect(restoredNodes).toEqual(nodes);
    expect(restoredEdges).toEqual(edges);
  });

  it('keeps a restored edge label when older graph data has only a top-level label', () => {
    const edge = toWorkspaceEdge({
      id: 'legacy-edge',
      source: 'source',
      target: 'target',
      type: 'smoothstep',
      label: 'Legacy label',
      data: {
        kind: 'depends_on',
        label: '',
        metadata: {},
      },
    });

    expect(edge.label).toBe('Legacy label');
    expect(edge.data?.label).toBe('Legacy label');
    expect(toApiGraph([], [edge]).edges[0].data.label).toBe('Legacy label');
  });
});

import { describe, expect, it } from 'vitest';
import { withAutoEdgeHandles } from './edgeHandles';
import type { GraphEdge, GraphNode } from './types';

describe('workspace graph edge handles', () => {
  it('adds side handles for horizontal edges without mutating stored edges', () => {
    const nodes = [
      node('left-node', 0, 0),
      node('right-node', 360, 40),
    ];
    const edges: GraphEdge[] = [edge('left-node', 'right-node')];

    const displayEdges = withAutoEdgeHandles(nodes, edges);

    expect(displayEdges[0].sourceHandle).toBe('right');
    expect(displayEdges[0].targetHandle).toBe('left');
    expect(edges[0].sourceHandle).toBeUndefined();
    expect(edges[0].targetHandle).toBeUndefined();
  });

  it('adds top and bottom handles for vertical edges', () => {
    const nodes = [
      node('top-node', 0, 0),
      node('bottom-node', 40, 320),
    ];
    const displayEdges = withAutoEdgeHandles(nodes, [edge('top-node', 'bottom-node')]);

    expect(displayEdges[0].sourceHandle).toBe('bottom');
    expect(displayEdges[0].targetHandle).toBe('top');
  });

  it('preserves explicit handles from user-created edges', () => {
    const nodes = [
      node('a', 0, 0),
      node('b', 360, 0),
    ];
    const explicitEdge: GraphEdge = {
      ...edge('a', 'b'),
      sourceHandle: 'top',
      targetHandle: 'bottom',
    };

    const displayEdges = withAutoEdgeHandles(nodes, [explicitEdge]);

    expect(displayEdges[0]).toBe(explicitEdge);
    expect(displayEdges[0].sourceHandle).toBe('top');
    expect(displayEdges[0].targetHandle).toBe('bottom');
  });
});

function node(id: string, x: number, y: number): GraphNode {
  return {
    id,
    type: 'objective',
    position: { x, y },
    data: { label: id },
  };
}

function edge(source: string, target: string): GraphEdge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    type: 'smoothstep',
    data: {
      kind: 'supports',
      label: 'supports',
      metadata: {},
    },
  };
}

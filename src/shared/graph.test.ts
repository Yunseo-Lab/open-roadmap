import { describe, expect, it } from "vitest";
import { normalizeGraph } from "./graph";

describe("normalizeGraph", () => {
  it("accepts allowed node and edge types", () => {
    const graph = normalizeGraph({
      nodes: [
        {
          id: "goal",
          type: "objective",
          position: { x: 0, y: 0 },
          data: { title: "Goal", description: "", status: "active", metadata: {} },
        },
        {
          id: "event",
          type: "event",
          position: { x: 200, y: 0 },
          data: { title: "Record", description: "", status: "done", metadata: {} },
        },
      ],
      edges: [
        {
          id: "event-supports-goal",
          source: "event",
          target: "goal",
          data: { kind: "supports", label: "Supports", metadata: {} },
        },
      ],
    });

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges[0].data.kind).toBe("supports");
  });

  it("rejects invalid node types", () => {
    expect(() =>
      normalizeGraph({
        nodes: [
          {
            id: "bad",
            type: "unknown",
            position: { x: 0, y: 0 },
            data: { title: "bad", description: "", status: "planned", metadata: {} },
          },
        ],
        edges: [],
      }),
    ).toThrow(/node type/);
  });

  it("rejects dangling edges", () => {
    expect(() =>
      normalizeGraph({
        nodes: [
          {
            id: "goal",
            type: "objective",
            position: { x: 0, y: 0 },
            data: { title: "Goal", description: "", status: "planned", metadata: {} },
          },
        ],
        edges: [
          {
            id: "dangling",
            source: "missing",
            target: "goal",
            data: { kind: "supports", label: "", metadata: {} },
          },
        ],
      }),
    ).toThrow(/node that does not exist/);
  });

  it("preserves edge handle ids in metadata", () => {
    const graph = normalizeGraph({
      nodes: [
        {
          id: "source",
          type: "objective",
          position: { x: 0, y: 0 },
          data: { title: "Source", description: "", status: "planned", metadata: {} },
        },
        {
          id: "target",
          type: "objective",
          position: { x: 200, y: 0 },
          data: { title: "Target", description: "", status: "planned", metadata: {} },
        },
      ],
      edges: [
        {
          id: "source-target",
          source: "source",
          target: "target",
          sourceHandle: "right",
          targetHandle: "left",
          data: { kind: "supports", label: "", metadata: {} },
        },
      ],
    });

    expect(graph.edges[0].sourceHandle).toBe("right");
    expect(graph.edges[0].targetHandle).toBe("left");
    expect(graph.edges[0].data.metadata.sourceHandle).toBe("right");
    expect(graph.edges[0].data.metadata.targetHandle).toBe("left");
  });
});

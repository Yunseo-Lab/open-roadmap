import { normalizeGraph, safeText } from "../../shared/graph";
import type { RoadmapGraph } from "../types";
import type { ArtifactPromptPart } from "./artifact-prompts";
import { attachArtifact } from "./graph-tools";
import type { AgentOperation, AgentResult } from "./types";

// Development fallback keeps the app usable without an OpenRouter key.
export function createFallbackGraph(
  startingGraph: RoadmapGraph,
  message: string,
  artifacts: ArtifactPromptPart[],
): Omit<AgentResult, "model"> {
  const graph = structuredClone(startingGraph);
  const operations: AgentOperation[] = [];

  if (graph.nodes.length === 0) {
    const objectiveId = "objective-main";
    const milestoneId = "milestone-first";
    const eventId = "event-log";
    graph.nodes.push(
      {
        id: objectiveId,
        type: "objective",
        position: { x: 80, y: 140 },
        data: {
          title: safeText(message, "My core goal", 72),
          description: "This first objective was created from the AI conversation. Edit it with the details you need.",
          status: "active",
          metadata: {},
        },
      },
      {
        id: milestoneId,
        type: "milestone",
        position: { x: 420, y: 80 },
        data: {
          title: "Plan the first milestone",
          description: "Clarify the key steps needed to reach the objective.",
          status: "planned",
          metadata: {},
        },
      },
      {
        id: eventId,
        type: "event",
        position: { x: 420, y: 260 },
        data: {
          title: "Log progress",
          description: "Track completed work, lessons learned, and outputs as events.",
          status: "planned",
          metadata: {},
        },
      },
    );
    graph.edges.push(
      {
        id: "milestone-first-supports-objective-main",
        source: milestoneId,
        target: objectiveId,
        type: "smoothstep",
        label: "Supports",
        data: { kind: "supports", label: "Supports", metadata: {} },
      },
      {
        id: "event-log-next-milestone-first",
        source: eventId,
        target: milestoneId,
        type: "smoothstep",
        label: "Progress",
        data: { kind: "next", label: "Progress", metadata: {} },
      },
    );
    operations.push({
      tool: "local_fallback_seed",
      args: { message },
      result: { ok: true, nodes: 3, edges: 2 },
    });
  }

  for (const part of artifacts.slice(0, 3)) {
    const targetNode = graph.nodes.find((node) => node.type === "event") ?? graph.nodes[0];
    if (!targetNode) {
      continue;
    }
    attachArtifact(graph, artifacts, {
      artifactId: part.artifact.id,
      nodeId: targetNode.id,
      x: 760,
      y: 120 + operations.length * 150,
    });
  }

  return {
    graph: normalizeGraph(graph),
    summary: "Created a roadmap draft with the development fallback. Configure an OpenRouter key to let the agent build the graph through tool calls.",
    operations,
  };
}

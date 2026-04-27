import { getGraph, listArtifacts, replaceGraph, toPublicArtifact } from "../db/queries";
import { normalizeGraph } from "../../shared/graph";
import type { AgentInput, AgentOperation, AgentResult } from "./local-agent";

type PythonAgentResponse = {
  graph?: unknown;
  summary?: unknown;
  operations?: unknown;
  model?: unknown;
};

export async function runPythonRoadmapAgent(input: AgentInput): Promise<AgentResult> {
  const currentGraph = await getGraph(input.db, input.roadmapId);
  const artifacts = await listArtifacts(input.db, input.userId, input.roadmapId);
  const selectedArtifactIds = new Set(input.artifactIds);
  const selectedArtifacts = artifacts.filter((artifact) => selectedArtifactIds.has(artifact.id));
  const serviceUrl = input.env.AI_SERVICE_URL?.replace(/\/+$/, "");

  if (!serviceUrl) {
    throw new Error("AI_SERVICE_URL is not configured.");
  }

  const response = await fetch(`${serviceUrl}/roadmap-agent/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: input.userId,
      roadmapId: input.roadmapId,
      message: input.message,
      artifactIds: input.artifactIds,
      artifacts: selectedArtifacts.map(toPublicArtifact),
      graph: currentGraph,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Python AI service failed: ${response.status} ${errorText.slice(0, 300)}`);
  }

  const payload = (await response.json()) as PythonAgentResponse;
  const graph = normalizeGraph(payload.graph, {
    nodeTypes: currentGraph.nodeTypes,
    edgeTypes: currentGraph.edgeTypes,
  });
  const savedGraph = await replaceGraph(input.db, input.roadmapId, graph);

  return {
    graph: savedGraph,
    summary: typeof payload.summary === "string" ? payload.summary : "AI service updated the roadmap.",
    operations: normalizeOperations(payload.operations),
    model: typeof payload.model === "string" ? payload.model : "python-ai-service",
  };
}

function normalizeOperations(value: unknown): AgentOperation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((operation): operation is AgentOperation => {
    if (!operation || typeof operation !== "object") {
      return false;
    }

    const candidate = operation as Partial<AgentOperation>;
    return typeof candidate.tool === "string";
  });
}

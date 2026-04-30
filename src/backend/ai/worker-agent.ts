import { getGraph, replaceGraph } from "../db/graphs";
import { loadArtifacts } from "./artifact-prompts";
import { createFallbackGraph } from "./fallback-agent";
import { callOpenRouterAgent } from "./openrouter-client";
import type { AgentInput, AgentResult } from "./types";

// Worker-side agent path: OpenRouter in production, deterministic fallback in development.
export async function runRoadmapAgent(input: AgentInput): Promise<AgentResult> {
  const graph = await getGraph(input.db, input.roadmapId);
  const artifacts = await loadArtifacts(input);

  if (!input.env.OPENROUTER_API_KEY) {
    if (input.env.APP_ENV === "production") {
      throw new Error("OPENROUTER_API_KEY is not configured.");
    }

    return persistAgentResult(input.db, input.roadmapId, {
      ...createFallbackGraph(graph, input.message, artifacts),
      model: "local-fallback",
    });
  }

  try {
    const result = await callOpenRouterAgent(input.env, graph, input.message, artifacts);
    return persistAgentResult(input.db, input.roadmapId, result);
  } catch (error) {
    if (input.env.APP_ENV === "production") {
      throw error;
    }

    return persistAgentResult(input.db, input.roadmapId, {
      ...createFallbackGraph(graph, input.message, artifacts),
      model: "local-fallback-after-error",
    });
  }
}

// Agent results are persisted through the same graph replacement path as manual edits.
async function persistAgentResult(
  db: D1Database,
  roadmapId: string,
  result: AgentResult,
): Promise<AgentResult> {
  const graph = await replaceGraph(db, roadmapId, result.graph);
  return {
    ...result,
    graph,
  };
}

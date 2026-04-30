import { runRoadmapAgent as runWorkerRoadmapAgent } from "./worker-agent";
import { runRemoteRoadmapAgent, streamRemoteRoadmapAgent, type AgentStreamEvent } from "./remote-agent";
import type { AgentInput, AgentResult } from "./types";

export type { AgentInput, AgentResult, AgentStreamEvent };

// Selects the remote agent service when configured; otherwise runs the Worker-side agent.
export async function runRoadmapAgent(input: AgentInput): Promise<AgentResult> {
  if (input.env.AI_SERVICE_URL?.trim()) {
    return runRemoteRoadmapAgent(input);
  }

  return runWorkerRoadmapAgent(input);
}

// Streaming follows the same routing, but Worker mode replays completed operations as events.
export async function runRoadmapAgentStream(
  input: AgentInput,
  emit: (event: AgentStreamEvent) => void | Promise<void>,
): Promise<AgentResult> {
  if (input.env.AI_SERVICE_URL?.trim()) {
    return streamRemoteRoadmapAgent(input, emit);
  }

  await emit({ type: "status", message: "Running Worker-side agent." });
  const result = await runWorkerRoadmapAgent(input);
  for (const operation of result.operations) {
    await emit({ type: "operation", operation });
  }
  return result;
}

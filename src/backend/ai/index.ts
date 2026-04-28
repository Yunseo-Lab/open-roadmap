import { runRoadmapAgent as runLocalRoadmapAgent, type AgentInput, type AgentResult } from "./local-agent";
import { runPythonRoadmapAgent, streamPythonRoadmapAgent, type AgentStreamEvent } from "./python-client";

export type { AgentInput, AgentResult, AgentStreamEvent };

export async function runRoadmapAgent(input: AgentInput): Promise<AgentResult> {
  if (input.env.AI_SERVICE_URL?.trim()) {
    return runPythonRoadmapAgent(input);
  }

  return runLocalRoadmapAgent(input);
}

export async function runRoadmapAgentStream(
  input: AgentInput,
  emit: (event: AgentStreamEvent) => void | Promise<void>,
): Promise<AgentResult> {
  if (input.env.AI_SERVICE_URL?.trim()) {
    return streamPythonRoadmapAgent(input, emit);
  }

  await emit({ type: "status", message: "Running Worker-side local agent." });
  const result = await runLocalRoadmapAgent(input);
  for (const operation of result.operations) {
    await emit({ type: "operation", operation });
  }
  return result;
}

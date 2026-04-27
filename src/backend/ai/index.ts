import { runRoadmapAgent as runLocalRoadmapAgent, type AgentInput, type AgentResult } from "./local-agent";
import { runPythonRoadmapAgent } from "./python-client";

export type { AgentInput, AgentResult };

export async function runRoadmapAgent(input: AgentInput): Promise<AgentResult> {
  if (input.env.AI_SERVICE_URL?.trim()) {
    return runPythonRoadmapAgent(input);
  }

  return runLocalRoadmapAgent(input);
}

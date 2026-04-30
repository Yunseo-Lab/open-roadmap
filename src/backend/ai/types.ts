import type { AppEnv, JsonRecord, RoadmapGraph } from "../types";

export type AgentResult = {
  graph: RoadmapGraph;
  summary: string;
  operations: AgentOperation[];
  model: string;
  responseType?: "answer" | "graph_update" | "answer_and_graph_update" | "clarification" | "approval_required" | "error";
  committed?: boolean;
  citations?: JsonRecord[];
  riskFlags?: JsonRecord[];
  validationReport?: JsonRecord | null;
  approvalRequest?: JsonRecord | null;
};

export type AgentOperation = {
  id?: string;
  tool: string;
  args: JsonRecord;
  result: JsonRecord;
  status?: "success" | "error" | "skipped" | "approval_required";
  startedAt?: number | null;
  completedAt?: number | null;
};

export type AgentInput = {
  env: AppEnv;
  db: D1Database;
  userId: string;
  roadmapId: string;
  message: string;
  artifactIds: string[];
};

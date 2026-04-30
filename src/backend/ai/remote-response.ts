import { normalizeGraph } from "../../shared/graph";
import { replaceGraph } from "../db/graphs";
import type { RoadmapGraph } from "../types";
import type { AgentOperation, AgentResult } from "./types";

export type RemoteAgentResponse = {
  graph?: unknown;
  summary?: unknown;
  operations?: unknown;
  model?: unknown;
  responseType?: unknown;
  committed?: unknown;
  citations?: unknown;
  riskFlags?: unknown;
  validationReport?: unknown;
  approvalRequest?: unknown;
};

type RemoteErrorResponse = {
  detail?: unknown;
  error?: unknown;
};

const responseTypes = new Set([
  "answer",
  "graph_update",
  "answer_and_graph_update",
  "clarification",
  "approval_required",
  "error",
]);

// Saves committed graph updates; answer-only responses keep the current graph unchanged.
export async function remotePayloadToAgentResult(
  db: D1Database,
  roadmapId: string,
  currentGraph: RoadmapGraph,
  payload: RemoteAgentResponse,
): Promise<AgentResult> {
  const committed = normalizeCommitted(payload.committed);
  const savedGraph = committed
    ? await replaceGraph(
        db,
        roadmapId,
        normalizeGraph(payload.graph, {
          nodeTypes: currentGraph.nodeTypes,
          edgeTypes: currentGraph.edgeTypes,
        }),
      )
    : currentGraph;

  return {
    graph: savedGraph,
    summary: typeof payload.summary === "string" ? payload.summary : "AI service updated the roadmap.",
    operations: normalizeRemoteOperations(payload.operations),
    model: typeof payload.model === "string" ? payload.model : "remote-ai-service",
    responseType: normalizeResponseType(payload.responseType),
    committed,
    citations: normalizeRecordArray(payload.citations),
    riskFlags: normalizeRecordArray(payload.riskFlags),
    validationReport: normalizeRecord(payload.validationReport),
    approvalRequest: normalizeRecord(payload.approvalRequest),
  };
}

// Supports both FastAPI-style detail objects and simpler error payloads.
export function parseRemoteAgentError(body: string): { message: string; code?: string } {
  try {
    const payload = JSON.parse(body) as RemoteErrorResponse;
    const detail = payload.detail;
    if (isRecord(detail)) {
      const error = detail.error;
      if (isRecord(error)) {
        const message = remoteStringField(error, "message");
        if (message) {
          return {
            message,
            code: remoteStringField(error, "code") || undefined,
          };
        }
      }

      const message = remoteStringField(detail, "message");
      if (message) {
        return { message };
      }
    }

    if (typeof payload.error === "string" && payload.error.trim()) {
      return { message: payload.error };
    }
    if (isRecord(payload.error)) {
      const message = remoteStringField(payload.error, "message");
      if (message) {
        return {
          message,
          code: remoteStringField(payload.error, "code") || undefined,
        };
      }
    }
  } catch {
    // Fall through to the raw body preview.
  }

  const fallback = body.trim().slice(0, 300);
  return { message: fallback || "Unknown remote AI service error." };
}

// Normalizes operation events before forwarding them to the frontend stream.
export function normalizeRemoteOperation(value: unknown): AgentOperation | null {
  if (!isRecord(value)) {
    return null;
  }

  const candidate = value as Partial<AgentOperation>;
  if (typeof candidate.tool !== "string") {
    return null;
  }

  return {
    id: typeof candidate.id === "string" ? candidate.id : undefined,
    tool: candidate.tool,
    args: isRecord(candidate.args) ? candidate.args : {},
    result: isRecord(candidate.result) ? candidate.result : {},
    status: candidate.status,
    startedAt: typeof candidate.startedAt === "number" ? candidate.startedAt : null,
    completedAt: typeof candidate.completedAt === "number" ? candidate.completedAt : null,
  };
}

// Tiny field readers keep response normalization explicit and type-safe.
export function remoteStringField(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  return typeof field === "string" ? field.trim() : "";
}

export function remoteNumberField(value: Record<string, unknown>, key: string): number | null {
  const field = value[key];
  return typeof field === "number" ? field : null;
}

// The service may include extra fields; only operation-shaped records are retained.
function normalizeRemoteOperations(value: unknown): AgentOperation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeRemoteOperation)
    .filter((operation): operation is AgentOperation => Boolean(operation));
}

// Response metadata is optional, so invalid values are dropped rather than surfaced.
function normalizeResponseType(value: unknown): AgentResult["responseType"] {
  return typeof value === "string" && responseTypes.has(value) ? (value as AgentResult["responseType"]) : undefined;
}

function normalizeCommitted(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

function normalizeRecordArray(value: unknown): AgentResult["citations"] {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const records = value.filter(isRecord);
  return records.length ? records : undefined;
}

function normalizeRecord(value: unknown): Record<string, unknown> | null | undefined {
  if (value === null) {
    return null;
  }
  if (!isRecord(value)) {
    return undefined;
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

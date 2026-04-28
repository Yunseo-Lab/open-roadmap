import { getGraph, listArtifacts, replaceGraph, toPublicArtifact } from "../db/queries";
import { normalizeGraph } from "../../shared/graph";
import type { AgentInput, AgentOperation, AgentResult } from "./local-agent";
import type { RoadmapGraph } from "../types";

type PythonAgentResponse = {
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

type PythonErrorResponse = {
  detail?: unknown;
  error?: unknown;
};

export type AgentStreamEvent =
  | {
      type: "status";
      message: string;
    }
  | {
      type: "operation";
      operation: AgentOperation;
    };

type PythonRequestContext = {
  serviceUrl: string;
  currentGraph: RoadmapGraph;
  body: Record<string, unknown>;
};

export class PythonAgentServiceError extends Error {
  statusCode: number;
  code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.name = "PythonAgentServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const responseTypes = new Set([
  "answer",
  "graph_update",
  "answer_and_graph_update",
  "clarification",
  "approval_required",
  "error",
]);

export async function runPythonRoadmapAgent(input: AgentInput): Promise<AgentResult> {
  const request = await buildPythonRequest(input);
  const response = await fetch(`${request.serviceUrl}/roadmap-agent/runs`, {
    method: "POST",
    headers: pythonServiceHeaders(input, false),
    body: JSON.stringify(request.body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const parsedError = parsePythonError(errorBody);
    throw new PythonAgentServiceError(
      `Python AI service failed: ${parsedError.message}`,
      response.status,
      parsedError.code,
    );
  }

  const payload = (await response.json()) as PythonAgentResponse;
  return resultFromPythonPayload(input, request.currentGraph, payload);
}

export async function streamPythonRoadmapAgent(
  input: AgentInput,
  emit: (event: AgentStreamEvent) => void | Promise<void>,
): Promise<AgentResult> {
  const request = await buildPythonRequest(input);
  const response = await fetch(`${request.serviceUrl}/roadmap-agent/runs/stream`, {
    method: "POST",
    headers: pythonServiceHeaders(input, true),
    body: JSON.stringify(request.body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const parsedError = parsePythonError(errorBody);
    throw new PythonAgentServiceError(
      `Python AI service failed: ${parsedError.message}`,
      response.status,
      parsedError.code,
    );
  }
  if (!response.body) {
    throw new PythonAgentServiceError("Python AI service did not return a stream.", 502, "stream_missing");
  }

  let finalPayload: PythonAgentResponse | null = null;
  let streamError: { message: string; statusCode: number; code?: string } | null = null;
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = popSseEvents(buffer);
    buffer = events.remaining;

    for (const event of events.messages) {
      const data = parseSseData(event.data);
      if (event.event === "status") {
        const message = stringField(data, "message");
        if (message) {
          await emit({ type: "status", message });
        }
      }
      if (event.event === "operation") {
        const operation = normalizeOperation((data as { operation?: unknown }).operation);
        if (operation) {
          await emit({ type: "operation", operation });
        }
      }
      if (event.event === "final") {
        finalPayload = data as PythonAgentResponse;
      }
      if (event.event === "error") {
        streamError = {
          message: stringField(data, "message") || "Python AI service stream failed.",
          statusCode: numberField(data, "statusCode") || 500,
          code: stringField(data, "code") || undefined,
        };
      }
    }
  }

  if (buffer.trim()) {
    const event = parseSseBlock(buffer);
    if (event) {
      const data = parseSseData(event.data);
      if (event.event === "final") {
        finalPayload = data as PythonAgentResponse;
      }
      if (event.event === "error") {
        streamError = {
          message: stringField(data, "message") || "Python AI service stream failed.",
          statusCode: numberField(data, "statusCode") || 500,
          code: stringField(data, "code") || undefined,
        };
      }
    }
  }

  if (streamError) {
    throw new PythonAgentServiceError(
      `Python AI service failed: ${streamError.message}`,
      streamError.statusCode,
      streamError.code,
    );
  }
  if (!finalPayload) {
    throw new PythonAgentServiceError("Python AI service stream ended without a final result.", 502, "final_missing");
  }

  return resultFromPythonPayload(input, request.currentGraph, finalPayload);
}

async function buildPythonRequest(input: AgentInput): Promise<PythonRequestContext> {
  const currentGraph = await getGraph(input.db, input.roadmapId);
  const artifacts = await listArtifacts(input.db, input.userId, input.roadmapId);
  const selectedArtifactIds = new Set(input.artifactIds);
  const selectedArtifacts = artifacts.filter((artifact) => selectedArtifactIds.has(artifact.id));
  const serviceUrl = input.env.AI_SERVICE_URL?.replace(/\/+$/, "");

  if (!serviceUrl) {
    throw new Error("AI_SERVICE_URL is not configured.");
  }

  return {
    serviceUrl,
    currentGraph,
    body: {
      userId: input.userId,
      roadmapId: input.roadmapId,
      message: input.message,
      artifactIds: input.artifactIds,
      artifacts: selectedArtifacts.map(toPublicArtifact),
      graph: currentGraph,
    },
  };
}

async function resultFromPythonPayload(
  input: AgentInput,
  currentGraph: RoadmapGraph,
  payload: PythonAgentResponse,
): Promise<AgentResult> {
  const committed = normalizeCommitted(payload.committed);
  const savedGraph = committed
    ? await replaceGraph(
        input.db,
        input.roadmapId,
        normalizeGraph(payload.graph, {
          nodeTypes: currentGraph.nodeTypes,
          edgeTypes: currentGraph.edgeTypes,
        }),
      )
    : currentGraph;

  return {
    graph: savedGraph,
    summary: typeof payload.summary === "string" ? payload.summary : "AI service updated the roadmap.",
    operations: normalizeOperations(payload.operations),
    model: typeof payload.model === "string" ? payload.model : "python-ai-service",
    responseType: normalizeResponseType(payload.responseType),
    committed,
    citations: normalizeRecordArray(payload.citations),
    riskFlags: normalizeRecordArray(payload.riskFlags),
    validationReport: normalizeRecord(payload.validationReport),
    approvalRequest: normalizeRecord(payload.approvalRequest),
  };
}

function popSseEvents(buffer: string): { messages: Array<{ event: string; data: string }>; remaining: string } {
  const messages: Array<{ event: string; data: string }> = [];
  let remaining = buffer;

  while (true) {
    const separator = remaining.search(/\r?\n\r?\n/);
    if (separator === -1) {
      return { messages, remaining };
    }

    const block = remaining.slice(0, separator);
    remaining = remaining.slice(separator + (remaining[separator] === "\r" ? 4 : 2));
    const event = parseSseBlock(block);
    if (event) {
      messages.push(event);
    }
  }
}

function parseSseBlock(block: string): { event: string; data: string } | null {
  let event = "message";
  const data: string[] = [];

  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    }
    if (line.startsWith("data:")) {
      data.push(line.slice("data:".length).trimStart());
    }
  }

  if (!data.length) {
    return null;
  }

  return { event, data: data.join("\n") };
}

function parseSseData(data: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(data) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }
  return {};
}

function normalizeOperation(value: unknown): AgentOperation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
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

function pythonServiceHeaders(input: AgentInput, acceptsStream: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (acceptsStream) {
    headers.Accept = "text/event-stream";
  }

  const token = input.env.AI_SERVICE_TOKEN?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function stringField(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  return typeof field === "string" ? field.trim() : "";
}

function numberField(value: Record<string, unknown>, key: string): number | null {
  const field = value[key];
  return typeof field === "number" ? field : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parsePythonError(body: string): { message: string; code?: string } {
  try {
    const payload = JSON.parse(body) as PythonErrorResponse;
    const detail = payload.detail;
    if (detail && typeof detail === "object" && !Array.isArray(detail)) {
      const error = (detail as { error?: unknown }).error;
      if (error && typeof error === "object" && !Array.isArray(error)) {
        const candidate = error as { message?: unknown; code?: unknown };
        if (typeof candidate.message === "string" && candidate.message.trim()) {
          return {
            message: candidate.message,
            code: typeof candidate.code === "string" ? candidate.code : undefined,
          };
        }
      }
      const message = (detail as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) {
        return { message };
      }
    }

    if (typeof payload.error === "string" && payload.error.trim()) {
      return { message: payload.error };
    }
    if (payload.error && typeof payload.error === "object" && !Array.isArray(payload.error)) {
      const candidate = payload.error as { message?: unknown; code?: unknown };
      if (typeof candidate.message === "string" && candidate.message.trim()) {
        return {
          message: candidate.message,
          code: typeof candidate.code === "string" ? candidate.code : undefined,
        };
      }
    }
  } catch {
    // Fall through to the raw body preview.
  }

  const fallback = body.trim().slice(0, 300);
  return { message: fallback || "Unknown Python AI service error." };
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

function normalizeResponseType(value: unknown): AgentResult["responseType"] {
  return typeof value === "string" && responseTypes.has(value) ? (value as AgentResult["responseType"]) : undefined;
}

function normalizeCommitted(value: unknown): boolean {
  return typeof value === "boolean" ? value : true;
}

function normalizeRecordArray(value: unknown): AgentResult["citations"] {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const records = value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
  return records.length ? records : undefined;
}

function normalizeRecord(value: unknown): Record<string, unknown> | null | undefined {
  if (value === null) {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

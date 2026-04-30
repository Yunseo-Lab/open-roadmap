import { listArtifacts } from "../db/artifacts";
import { getGraph } from "../db/graphs";
import { toPublicArtifact } from "../db/public-mappers";
import {
  normalizeRemoteOperation,
  parseRemoteAgentError,
  remoteNumberField,
  remotePayloadToAgentResult,
  remoteStringField,
  type RemoteAgentResponse,
} from "./remote-response";
import { parseSseBlock, parseSseData, popSseEvents, type SseEvent } from "./remote-sse";
import { readResponsePreview } from "./response-preview";
import type { AgentInput, AgentOperation, AgentResult } from "./types";
import type { RoadmapGraph } from "../types";

export type AgentStreamEvent =
  | {
      type: "status";
      message: string;
    }
  | {
      type: "operation";
      operation: AgentOperation;
    };

type RemoteAgentRequestContext = {
  serviceUrl: string;
  currentGraph: RoadmapGraph;
  body: Record<string, unknown>;
};

type RemoteStreamState = {
  finalPayload: RemoteAgentResponse | null;
  error: {
    message: string;
    statusCode: number;
    code?: string;
  } | null;
};

// Carries upstream service status codes back to API routes without losing context.
class RemoteAgentServiceError extends Error {
  statusCode: number;
  code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.name = "RemoteAgentServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

// Calls the remote agent service and normalizes its response into the shared AgentResult shape.
export async function runRemoteRoadmapAgent(input: AgentInput): Promise<AgentResult> {
  const request = await buildRemoteAgentRequest(input);
  const response = await fetch(`${request.serviceUrl}/roadmap-agent/runs`, {
    method: "POST",
    headers: remoteAgentHeaders(input, false),
    body: JSON.stringify(request.body),
  });

  if (!response.ok) {
    const errorBody = await readResponsePreview(response);
    const parsedError = parseRemoteAgentError(errorBody);
    throw new RemoteAgentServiceError(
      `Remote AI service failed: ${parsedError.message}`,
      response.status,
      parsedError.code,
    );
  }

  const payload = (await response.json()) as RemoteAgentResponse;
  return remotePayloadToAgentResult(input.db, input.roadmapId, request.currentGraph, payload);
}

// Streams status/operation events from the remote agent service and waits for a final payload.
export async function streamRemoteRoadmapAgent(
  input: AgentInput,
  emit: (event: AgentStreamEvent) => void | Promise<void>,
): Promise<AgentResult> {
  const request = await buildRemoteAgentRequest(input);
  const response = await fetch(`${request.serviceUrl}/roadmap-agent/runs/stream`, {
    method: "POST",
    headers: remoteAgentHeaders(input, true),
    body: JSON.stringify(request.body),
  });

  if (!response.ok) {
    const errorBody = await readResponsePreview(response);
    const parsedError = parseRemoteAgentError(errorBody);
    throw new RemoteAgentServiceError(
      `Remote AI service failed: ${parsedError.message}`,
      response.status,
      parsedError.code,
    );
  }
  if (!response.body) {
    throw new RemoteAgentServiceError("Remote AI service did not return a stream.", 502, "stream_missing");
  }

  const streamState: RemoteStreamState = {
    finalPayload: null,
    error: null,
  };
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = "";
  const handleRemoteEvent = async (event: SseEvent) => {
    const data = parseSseData(event.data);
    if (event.event === "status") {
      const message = remoteStringField(data, "message");
      if (message) {
        await emit({ type: "status", message });
      }
    }
    if (event.event === "operation") {
      const operation = normalizeRemoteOperation(data.operation);
      if (operation) {
        await emit({ type: "operation", operation });
      }
    }
    if (event.event === "final") {
      streamState.finalPayload = data as RemoteAgentResponse;
    }
    if (event.event === "error") {
      streamState.error = {
        message: remoteStringField(data, "message") || "Remote AI service stream failed.",
        statusCode: remoteNumberField(data, "statusCode") || 500,
        code: remoteStringField(data, "code") || undefined,
      };
    }
  };

  // SSE chunks may split events, so keep a buffer between reads.
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = popSseEvents(buffer);
    buffer = events.remaining;

    for (const event of events.messages) {
      await handleRemoteEvent(event);
    }
  }

  if (buffer.trim()) {
    const events = popSseEvents(buffer);
    buffer = events.remaining;
    for (const event of events.messages) {
      await handleRemoteEvent(event);
    }
  }

  if (buffer.trim()) {
    const event = parseSseBlock(buffer);
    if (event) {
      await handleRemoteEvent(event);
    }
  }

  if (streamState.error) {
    throw new RemoteAgentServiceError(
      `Remote AI service failed: ${streamState.error.message}`,
      streamState.error.statusCode,
      streamState.error.code,
    );
  }
  if (!streamState.finalPayload) {
    throw new RemoteAgentServiceError("Remote AI service stream ended without a final result.", 502, "final_missing");
  }

  return remotePayloadToAgentResult(input.db, input.roadmapId, request.currentGraph, streamState.finalPayload);
}

// Builds the request body from the current graph and selected artifacts only.
async function buildRemoteAgentRequest(input: AgentInput): Promise<RemoteAgentRequestContext> {
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
      conversationId: input.conversationId,
      message: input.message,
      history: input.history,
      conversationSummary: input.conversationSummary,
      artifactIds: input.artifactIds,
      artifacts: selectedArtifacts.map(toPublicArtifact),
      graph: currentGraph,
    },
  };
}

// Adds optional bearer auth when the remote service token is configured.
function remoteAgentHeaders(input: AgentInput, acceptsStream: boolean): Record<string, string> {
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

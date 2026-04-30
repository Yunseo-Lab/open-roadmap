import type {
  Artifact,
  AgentConversation,
  AgentConversationMessage,
  AgentOperation,
  AgentResponse,
  CreateRoadmapInput,
  CurrentUser,
  PublicProfile,
  PublishRoadmapInput,
  Roadmap,
  RoadmapGraph,
  SaveRoadmapGraphInput,
  UpdateArtifactInput,
  UpdateProfileInput,
  UpdateRoadmapInput,
  UserProfile,
} from "../types";

type ApiResponse<T> = T & {
  error?: string;
};

export type AgentStreamHandlers = {
  onStatus?: (message: string) => void;
  onOperation?: (operation: AgentOperation) => void;
  onFinal?: (response: AgentResponse) => void;
  onError?: (message: string) => void;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResponse<T>> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init.headers,
    },
  });
  const data = (await response.json().catch(() => ({}))) as ApiResponse<T>;
  if (!response.ok) {
    throw new ApiError(data.error || "Request failed.", response.status);
  }

  return data;
}

export const api = {
  me: () => apiRequest<{ user: CurrentUser }>("/api/me"),
  updateProfile: (body: UpdateProfileInput) =>
    apiRequest<{ profile: UserProfile }>("/api/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  listRoadmaps: () => apiRequest<{ roadmaps: Roadmap[] }>("/api/roadmaps"),
  createRoadmap: (body: CreateRoadmapInput) =>
    apiRequest<{ roadmap: Roadmap | null }>("/api/roadmaps", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateRoadmap: (id: string, body: UpdateRoadmapInput) =>
    apiRequest<{ roadmap: Roadmap | null }>(`/api/roadmaps/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteRoadmap: (id: string) =>
    apiRequest<{ ok: boolean }>(`/api/roadmaps/${id}`, {
      method: "DELETE",
    }),
  getRoadmap: (id: string) =>
    apiRequest<{ roadmap: Roadmap; artifacts: Artifact[] }>(`/api/roadmaps/${id}`),
  getGraph: (id: string) => apiRequest<{ graph: RoadmapGraph }>(`/api/roadmaps/${id}/graph`),
  saveGraph: (id: string, graph: SaveRoadmapGraphInput) =>
    apiRequest<{ graph: RoadmapGraph }>(`/api/roadmaps/${id}/graph`, {
      method: "PATCH",
      body: JSON.stringify({ graph }),
    }),
  listAgentConversations: (id: string) =>
    apiRequest<{ conversations: AgentConversation[] }>(`/api/roadmaps/${id}/agent/conversations`),
  createAgentConversation: (id: string, body: { title?: string } = {}) =>
    apiRequest<{ conversation: AgentConversation }>(`/api/roadmaps/${id}/agent/conversations`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getAgentConversationMessages: (id: string, conversationId: string) =>
    apiRequest<{ conversation: AgentConversation; messages: AgentConversationMessage[] }>(
      `/api/roadmaps/${id}/agent/conversations/${conversationId}/messages`,
    ),
  runAgent: (id: string, body: { content: string; artifactIds?: string[]; conversationId?: string }) =>
    apiRequest<AgentResponse>(`/api/roadmaps/${id}/agent/messages`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  runAgentStream: (
    id: string,
    conversationId: string,
    body: { content: string; artifactIds?: string[] },
    handlers: AgentStreamHandlers = {},
  ) =>
    streamAgentResponse(
      `/api/roadmaps/${id}/agent/conversations/${conversationId}/messages/stream`,
      body,
      handlers,
    ),
  publishRoadmap: (id: string, body: PublishRoadmapInput) =>
    apiRequest<{ roadmap: Roadmap | null }>(`/api/roadmaps/${id}/publish`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  uploadArtifact: (body: FormData) =>
    apiRequest<{ artifact: Artifact | null }>("/api/uploads", {
      method: "POST",
      body,
    }),
  updateArtifact: (id: string, body: UpdateArtifactInput) =>
    apiRequest<{ artifact: Artifact | null }>(`/api/artifacts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteArtifact: (id: string) =>
    apiRequest<{ ok: boolean }>(`/api/artifacts/${id}`, {
      method: "DELETE",
    }),
  getPublicProfile: (handle: string) =>
    apiRequest<{ profile: PublicProfile; roadmaps: Roadmap[] }>(
      `/api/public/users/${encodeURIComponent(handle)}`,
    ),
  getPublicRoadmap: (handle: string, slug: string) =>
    apiRequest<{
      profile: PublicProfile | null;
      roadmap: Roadmap;
      graph: RoadmapGraph;
      artifacts: Artifact[];
    }>(`/api/public/users/${encodeURIComponent(handle)}/roadmaps/${encodeURIComponent(slug)}`),
};

async function streamAgentResponse(
  path: string,
  body: { content: string; artifactIds?: string[] },
  handlers: AgentStreamHandlers,
): Promise<AgentResponse> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as ApiResponse<unknown>;
    throw new ApiError(data.error || "Request failed.", response.status);
  }
  if (!response.body) {
    throw new ApiError("Agent stream is unavailable.", 502);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResponse: AgentResponse | null = null;
  let streamError: { message: string; status: number } | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parsed = popSseEvents(buffer);
    buffer = parsed.remaining;

    for (const event of parsed.messages) {
      const data = parseEventData(event.data);
      if (event.event === "status") {
        const message = stringField(data, "message");
        if (message) handlers.onStatus?.(message);
      }
      if (event.event === "operation") {
        const operation = parseOperation(data.operation);
        if (operation) handlers.onOperation?.(operation);
      }
      if (event.event === "final") {
        finalResponse = data as AgentResponse;
        handlers.onFinal?.(finalResponse);
      }
      if (event.event === "error") {
        const message = stringField(data, "message") || "AI generation failed.";
        streamError = {
          message,
          status: numberField(data, "statusCode") || 500,
        };
        handlers.onError?.(message);
      }
    }
  }

  if (streamError) {
    throw new ApiError(streamError.message, streamError.status);
  }
  if (!finalResponse && buffer.trim()) {
    const event = parseSseBlock(buffer);
    if (event?.event === "final") {
      finalResponse = parseEventData(event.data) as AgentResponse;
    }
  }
  if (!finalResponse) {
    throw new ApiError("Agent stream ended without a final response.", 502);
  }

  return finalResponse;
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

  return data.length ? { event, data: data.join("\n") } : null;
}

function parseEventData(data: string): Record<string, unknown> {
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

function parseOperation(value: unknown): AgentOperation | null {
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

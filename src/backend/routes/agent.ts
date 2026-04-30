import { Hono } from "hono";
import { runRoadmapAgent, runRoadmapAgentStream, type AgentInput, type AgentResult } from "../ai";
import {
  getOwnedRoadmap,
  notFound,
  readJson,
  requiredCleanText,
  requireUser,
  stringArray,
  type AppBindings,
  type AppContext,
} from "../http";

export const agentRoutes = new Hono<AppBindings>();

// Non-streaming agent endpoint: save the user message, run the agent, then persist the run.
agentRoutes.post("/roadmaps/:id/agent/messages", async (c) => {
  const prepared = await prepareAgentRequest(c);

  try {
    const result = await runRoadmapAgent(prepared.agentInput);

    await recordAgentSuccess(c.env.DB, prepared.conversationId, prepared.roadmapId, result);

    return c.json(agentResultPayload(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI generation failed.";
    const statusCode = errorStatusCode(error);
    await recordAgentFailure(c.env.DB, prepared.conversationId, prepared.roadmapId, c.env.OPENROUTER_MODEL, message);
    return c.json({ error: message }, statusCode);
  }
});

// Streaming endpoint mirrors the non-streaming route, but forwards agent progress as SSE.
agentRoutes.post("/roadmaps/:id/agent/messages/stream", async (c) => {
  const prepared = await prepareAgentRequest(c);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(sse(event, payload)));
      };

      try {
        send("status", { message: "Preparing agent run." });
        const result = await runRoadmapAgentStream(
          prepared.agentInput,
          (event) => {
            if (event.type === "status") {
              send("status", { message: event.message });
            }
            if (event.type === "operation") {
              send("operation", { operation: event.operation });
            }
          },
        );

        await recordAgentSuccess(c.env.DB, prepared.conversationId, prepared.roadmapId, result);
        send("final", agentResultPayload(result));
      } catch (error) {
        const message = error instanceof Error ? error.message : "AI generation failed.";
        const statusCode = errorStatusCode(error);
        await recordAgentFailure(c.env.DB, prepared.conversationId, prepared.roadmapId, c.env.OPENROUTER_MODEL, message);
        send("error", {
          message,
          statusCode,
          code: error && typeof error === "object" ? (error as { code?: unknown }).code : undefined,
        });
      } finally {
        send("done", {});
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
});

type PreparedAgentRequest = {
  agentInput: AgentInput;
  conversationId: string;
  roadmapId: string;
};

// Shared preparation for both agent endpoints: auth, ownership, body parsing, and message persistence.
async function prepareAgentRequest(c: AppContext): Promise<PreparedAgentRequest> {
  const user = await requireUser(c);
  const roadmap = await getOwnedRoadmap(c, user);
  if (!roadmap) {
    notFound();
  }

  const body = await readJson(c.req.raw);
  const content = requiredCleanText(body.content, "Message content is required.", 4000);
  const artifactIds = stringArray(body.artifactIds);

  // The conversation and user message are recorded before the agent call so failures are auditable.
  const conversationId = await getOrCreateConversation(c.env.DB, roadmap.id, user.id);
  await recordUserMessage(c.env.DB, conversationId, content, artifactIds);

  return {
    agentInput: {
      env: c.env,
      db: c.env.DB,
      userId: user.id,
      roadmapId: roadmap.id,
      message: content,
      artifactIds,
    },
    conversationId,
    roadmapId: roadmap.id,
  };
}

async function recordUserMessage(
  db: D1Database,
  conversationId: string,
  content: string,
  artifactIds: string[],
) {
  const now = Date.now();
  await db.prepare(
    `INSERT INTO ai_messages (id, conversation_id, role, content, metadata, created_at)
     VALUES (?, ?, 'user', ?, ?, ?)`,
  )
    .bind(crypto.randomUUID(), conversationId, content, JSON.stringify({ artifactIds }), now)
    .run();
}

// Preserve explicit upstream retry/service statuses while treating unknown failures as 500.
function errorStatusCode(error: unknown): 400 | 401 | 403 | 404 | 429 | 500 | 502 | 503 {
  if (error && typeof error === "object") {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    if (statusCode === 429) {
      return 429;
    }
    if (statusCode === 502) {
      return 502;
    }
    if (statusCode === 503) {
      return 503;
    }
  }
  return 500;
}

// One conversation per user/roadmap keeps the chat history grouped with the roadmap.
async function getOrCreateConversation(
  db: D1Database,
  roadmapId: string,
  userId: string,
): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();
  await db
    .prepare(
      `INSERT OR IGNORE INTO ai_conversations (id, roadmap_id, user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(id, roadmapId, userId, now, now)
    .run();

  const conversation = await db
    .prepare(
      `SELECT id
       FROM ai_conversations
       WHERE roadmap_id = ? AND user_id = ?
       ORDER BY created_at ASC, id ASC`,
    )
    .bind(roadmapId, userId)
    .first<{ id: string }>();

  if (!conversation) {
    throw new Error("Failed to create or load the AI conversation.");
  }

  return conversation.id;
}

// Stores the assistant reply and the operation trace atomically.
async function recordAgentSuccess(
  db: D1Database,
  conversationId: string,
  roadmapId: string,
  result: AgentResult,
) {
  await db.batch([
    db.prepare(
      `INSERT INTO ai_messages (id, conversation_id, role, content, metadata, created_at)
       VALUES (?, ?, 'assistant', ?, ?, ?)`,
    ).bind(crypto.randomUUID(), conversationId, result.summary, JSON.stringify({ model: result.model }), Date.now()),
    db.prepare(
      `INSERT INTO ai_runs
         (id, conversation_id, roadmap_id, status, model, operations_json, created_at)
       VALUES (?, ?, ?, 'completed', ?, ?, ?)`,
    ).bind(crypto.randomUUID(), conversationId, roadmapId, result.model, JSON.stringify(result.operations), Date.now()),
    db.prepare("UPDATE ai_conversations SET updated_at = ? WHERE id = ?").bind(Date.now(), conversationId),
  ]);
}

// Failed runs keep enough detail for the UI/history to show what happened.
async function recordAgentFailure(
  db: D1Database,
  conversationId: string,
  roadmapId: string,
  model: string | undefined,
  message: string,
) {
  await db.prepare(
    `INSERT INTO ai_runs
       (id, conversation_id, roadmap_id, status, model, operations_json, error, created_at)
     VALUES (?, ?, ?, 'failed', ?, '[]', ?, ?)`,
  )
    .bind(crypto.randomUUID(), conversationId, roadmapId, model || "openai/gpt-4.1-mini", message, Date.now())
    .run();
}

// Keeps route responses stable even as AgentResult grows new internal fields.
function agentResultPayload(result: AgentResult) {
  return {
    summary: result.summary,
    operations: result.operations,
    graph: result.graph,
    responseType: result.responseType,
    committed: result.committed,
    citations: result.citations,
    riskFlags: result.riskFlags,
    validationReport: result.validationReport,
    approvalRequest: result.approvalRequest,
  };
}

// Minimal server-sent event formatter used by the streaming route.
function sse(event: string, payload: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

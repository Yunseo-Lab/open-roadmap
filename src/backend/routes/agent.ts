import { Hono } from "hono";
import { runRoadmapAgent, runRoadmapAgentStream, type AgentResult } from "../ai";
import {
  cleanText,
  getOwnedRoadmap,
  notFound,
  readJson,
  requireUser,
  unauthorized,
  type AppBindings,
} from "../http";

export const agentRoutes = new Hono<AppBindings>();

agentRoutes.post("/roadmaps/:id/agent/messages", async (c) => {
  const user = await requireUser(c);
  if (!user) {
    return unauthorized(c);
  }

  const roadmap = await getOwnedRoadmap(c, user);
  if (!roadmap) {
    return notFound(c);
  }

  const body = await readJson(c.req.raw);
  const content = cleanText(body.content, "", 4000);
  if (!content) {
    return c.json({ error: "Message content is required." }, 400);
  }

  const artifactIds = Array.isArray(body.artifactIds)
    ? body.artifactIds.filter((id): id is string => typeof id === "string")
    : [];

  const conversationId = await getOrCreateConversation(c.env.DB, roadmap.id, user.id);
  const userMessageId = crypto.randomUUID();
  const now = Date.now();
  await c.env.DB.prepare(
    `INSERT INTO ai_messages (id, conversation_id, role, content, metadata, created_at)
     VALUES (?, ?, 'user', ?, ?, ?)`,
  )
    .bind(userMessageId, conversationId, content, JSON.stringify({ artifactIds }), now)
    .run();

  try {
    const result = await runRoadmapAgent({
      env: c.env,
      db: c.env.DB,
      userId: user.id,
      roadmapId: roadmap.id,
      message: content,
      artifactIds,
    });

    await recordAgentSuccess(c.env.DB, conversationId, roadmap.id, result);

    return c.json(agentResultPayload(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI generation failed.";
    const statusCode = errorStatusCode(error);
    await recordAgentFailure(c.env.DB, conversationId, roadmap.id, c.env.OPENROUTER_MODEL, message);
    return c.json({ error: message }, statusCode);
  }
});

agentRoutes.post("/roadmaps/:id/agent/messages/stream", async (c) => {
  const user = await requireUser(c);
  if (!user) {
    return unauthorized(c);
  }

  const roadmap = await getOwnedRoadmap(c, user);
  if (!roadmap) {
    return notFound(c);
  }

  const body = await readJson(c.req.raw);
  const content = cleanText(body.content, "", 4000);
  if (!content) {
    return c.json({ error: "Message content is required." }, 400);
  }

  const artifactIds = Array.isArray(body.artifactIds)
    ? body.artifactIds.filter((id): id is string => typeof id === "string")
    : [];

  const conversationId = await getOrCreateConversation(c.env.DB, roadmap.id, user.id);
  const userMessageId = crypto.randomUUID();
  const now = Date.now();
  await c.env.DB.prepare(
    `INSERT INTO ai_messages (id, conversation_id, role, content, metadata, created_at)
     VALUES (?, ?, 'user', ?, ?, ?)`,
  )
    .bind(userMessageId, conversationId, content, JSON.stringify({ artifactIds }), now)
    .run();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(sse(event, payload)));
      };

      try {
        send("status", { message: "Preparing agent run." });
        const result = await runRoadmapAgentStream(
          {
            env: c.env,
            db: c.env.DB,
            userId: user.id,
            roadmapId: roadmap.id,
            message: content,
            artifactIds,
          },
          (event) => {
            if (event.type === "status") {
              send("status", { message: event.message });
            }
            if (event.type === "operation") {
              send("operation", { operation: event.operation });
            }
          },
        );

        await recordAgentSuccess(c.env.DB, conversationId, roadmap.id, result);
        send("final", agentResultPayload(result));
      } catch (error) {
        const message = error instanceof Error ? error.message : "AI generation failed.";
        const statusCode = errorStatusCode(error);
        await recordAgentFailure(c.env.DB, conversationId, roadmap.id, c.env.OPENROUTER_MODEL, message);
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

async function getOrCreateConversation(
  db: D1Database,
  roadmapId: string,
  userId: string,
): Promise<string> {
  const existing = await db
    .prepare("SELECT id FROM ai_conversations WHERE roadmap_id = ? AND user_id = ? ORDER BY created_at ASC")
    .bind(roadmapId, userId)
    .first<{ id: string }>();

  if (existing) {
    return existing.id;
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO ai_conversations (id, roadmap_id, user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(id, roadmapId, userId, now, now)
    .run();

  return id;
}

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

function sse(event: string, payload: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

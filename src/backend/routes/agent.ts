import { Hono } from "hono";
import { runRoadmapAgent } from "../ai";
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

    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO ai_messages (id, conversation_id, role, content, metadata, created_at)
         VALUES (?, ?, 'assistant', ?, ?, ?)`,
      )
        .bind(crypto.randomUUID(), conversationId, result.summary, JSON.stringify({ model: result.model }), Date.now()),
      c.env.DB.prepare(
        `INSERT INTO ai_runs
           (id, conversation_id, roadmap_id, status, model, operations_json, created_at)
         VALUES (?, ?, ?, 'completed', ?, ?, ?)`,
      )
        .bind(
          crypto.randomUUID(),
          conversationId,
          roadmap.id,
          result.model,
          JSON.stringify(result.operations),
          Date.now(),
        ),
      c.env.DB.prepare("UPDATE ai_conversations SET updated_at = ? WHERE id = ?").bind(Date.now(), conversationId),
    ]);

    return c.json({
      summary: result.summary,
      operations: result.operations,
      graph: result.graph,
    });
  } catch (error) {
    await c.env.DB.prepare(
      `INSERT INTO ai_runs
         (id, conversation_id, roadmap_id, status, model, operations_json, error, created_at)
       VALUES (?, ?, ?, 'failed', ?, '[]', ?, ?)`,
    )
      .bind(
        crypto.randomUUID(),
        conversationId,
        roadmap.id,
        c.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini",
        error instanceof Error ? error.message : String(error),
        Date.now(),
      )
      .run();
    return c.json({ error: error instanceof Error ? error.message : "AI generation failed." }, 500);
  }
});

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

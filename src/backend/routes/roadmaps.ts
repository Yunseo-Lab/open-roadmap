import { Hono } from "hono";
import {
  createGraphType,
  createRoadmap,
  getGraph,
  getRoadmapForUser,
  listArtifacts,
  listGraphTypes,
  listRoadmaps,
  replaceGraph,
  toPublicArtifact,
  toPublicRoadmap,
} from "../db/queries";
import {
  cleanHandle,
  cleanText,
  getOwnedRoadmap,
  notFound,
  readJson,
  requireUser,
  unauthorized,
  type AppBindings,
} from "../http";
import { deleteArtifactFilesForRoadmap } from "../services/artifacts";

export const roadmapRoutes = new Hono<AppBindings>();

roadmapRoutes.get("/roadmaps", async (c) => {
  const user = await requireUser(c);
  if (!user) {
    return unauthorized(c);
  }

  return c.json({ roadmaps: await listRoadmaps(c.env.DB, user.id) });
});

roadmapRoutes.post("/roadmaps", async (c) => {
  const user = await requireUser(c);
  if (!user) {
    return unauthorized(c);
  }

  const body = await readJson(c.req.raw);
  const title = cleanText(body.title, "New Roadmap", 120);
  const summary = cleanText(body.summary, "", 1000);
  const roadmap = await createRoadmap(c.env.DB, user, { title, summary });

  return c.json({ roadmap: roadmap ? toPublicRoadmap(roadmap) : null }, 201);
});

roadmapRoutes.get("/roadmaps/:id", async (c) => {
  const user = await requireUser(c);
  if (!user) {
    return unauthorized(c);
  }

  const roadmap = await getOwnedRoadmap(c, user);
  if (!roadmap) {
    return notFound(c);
  }

  const artifacts = await listArtifacts(c.env.DB, user.id, roadmap.id);
  return c.json({
    roadmap: toPublicRoadmap(roadmap),
    artifacts: artifacts.map(toPublicArtifact),
  });
});

roadmapRoutes.patch("/roadmaps/:id", async (c) => {
  const user = await requireUser(c);
  if (!user) {
    return unauthorized(c);
  }

  const roadmap = await getOwnedRoadmap(c, user);
  if (!roadmap) {
    return notFound(c);
  }

  const body = await readJson(c.req.raw);
  const title = cleanText(body.title, roadmap.title, 120);
  const summary = cleanText(body.summary, roadmap.summary, 1000);
  const now = Date.now();
  await c.env.DB.prepare(
    `UPDATE roadmaps
     SET title = ?, summary = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
  )
    .bind(title, summary, now, roadmap.id, user.id)
    .run();

  const updated = await getRoadmapForUser(c.env.DB, roadmap.id, user.id);
  return c.json({ roadmap: updated ? toPublicRoadmap(updated) : null });
});

roadmapRoutes.delete("/roadmaps/:id", async (c) => {
  const user = await requireUser(c);
  if (!user) {
    return unauthorized(c);
  }

  const roadmap = await getOwnedRoadmap(c, user);
  if (!roadmap) {
    return notFound(c);
  }

  await deleteArtifactFilesForRoadmap(c.env, roadmap.id, user.id);
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM ai_messages WHERE conversation_id IN (SELECT id FROM ai_conversations WHERE roadmap_id = ?)").bind(
      roadmap.id,
    ),
    c.env.DB.prepare("DELETE FROM ai_runs WHERE roadmap_id = ?").bind(roadmap.id),
    c.env.DB.prepare("DELETE FROM ai_conversations WHERE roadmap_id = ?").bind(roadmap.id),
    c.env.DB.prepare("DELETE FROM roadmap_edges WHERE roadmap_id = ?").bind(roadmap.id),
    c.env.DB.prepare("DELETE FROM roadmap_nodes WHERE roadmap_id = ?").bind(roadmap.id),
    c.env.DB.prepare("DELETE FROM artifacts WHERE roadmap_id = ?").bind(roadmap.id),
    c.env.DB.prepare("DELETE FROM roadmaps WHERE id = ? AND user_id = ?").bind(roadmap.id, user.id),
  ]);

  return c.json({ ok: true });
});

roadmapRoutes.get("/roadmaps/:id/graph", async (c) => {
  const user = await requireUser(c);
  if (!user) {
    return unauthorized(c);
  }

  const roadmap = await getOwnedRoadmap(c, user);
  if (!roadmap) {
    return notFound(c);
  }

  return c.json({ graph: await getGraph(c.env.DB, roadmap.id) });
});

roadmapRoutes.patch("/roadmaps/:id/graph", async (c) => {
  const user = await requireUser(c);
  if (!user) {
    return unauthorized(c);
  }

  const roadmap = await getOwnedRoadmap(c, user);
  if (!roadmap) {
    return notFound(c);
  }

  const body = await readJson(c.req.raw);
  try {
    const graph = await replaceGraph(c.env.DB, roadmap.id, body.graph ?? body);
    return c.json({ graph });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed to save graph." }, 400);
  }
});

roadmapRoutes.get("/roadmaps/:id/types", async (c) => {
  const user = await requireUser(c);
  if (!user) {
    return unauthorized(c);
  }

  const roadmap = await getOwnedRoadmap(c, user);
  if (!roadmap) {
    return notFound(c);
  }

  const [nodeTypes, edgeTypes] = await Promise.all([
    listGraphTypes(c.env.DB, roadmap.id, "node"),
    listGraphTypes(c.env.DB, roadmap.id, "edge"),
  ]);

  return c.json({ nodeTypes, edgeTypes });
});

roadmapRoutes.post("/roadmaps/:id/types", async (c) => {
  const user = await requireUser(c);
  if (!user) {
    return unauthorized(c);
  }

  const roadmap = await getOwnedRoadmap(c, user);
  if (!roadmap) {
    return notFound(c);
  }

  const body = await readJson(c.req.raw);
  const scope = body.scope === "edge" ? "edge" : "node";
  const name = cleanText(body.name, "", 40);
  if (!name) {
    return c.json({ error: "Type name is required." }, 400);
  }

  const type = await createGraphType(c.env.DB, roadmap.id, scope, {
    id: typeof body.id === "string" ? body.id : undefined,
    name,
    description: typeof body.description === "string" ? body.description : "",
    color: typeof body.color === "string" ? body.color : undefined,
    icon: typeof body.icon === "string" ? body.icon : undefined,
  });

  return c.json({ type }, 201);
});

roadmapRoutes.post("/roadmaps/:id/publish", async (c) => {
  const user = await requireUser(c);
  if (!user) {
    return unauthorized(c);
  }

  const roadmap = await getOwnedRoadmap(c, user);
  if (!roadmap) {
    return notFound(c);
  }

  const body = await readJson(c.req.raw);
  const publicTitle = cleanText(body.publicTitle, roadmap.title, 120);
  const publicSummary = cleanText(body.publicSummary, roadmap.summary, 1000);
  const slug = await createUniqueRoadmapSlug(c.env.DB, roadmap.id, cleanText(body.slug, publicTitle, 120));
  const publicArtifactIds = Array.isArray(body.artifactIds)
    ? body.artifactIds.filter((id): id is string => typeof id === "string")
    : [];

  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare(
      `UPDATE roadmaps
       SET status = 'published', public_title = ?, public_summary = ?, slug = ?, published_at = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    ).bind(publicTitle, publicSummary, slug, Date.now(), Date.now(), roadmap.id, user.id),
    c.env.DB.prepare("UPDATE artifacts SET is_public = 0 WHERE roadmap_id = ? AND user_id = ?").bind(
      roadmap.id,
      user.id,
    ),
  ];

  for (const artifactId of publicArtifactIds) {
    statements.push(
      c.env.DB.prepare(
        "UPDATE artifacts SET is_public = 1 WHERE id = ? AND roadmap_id = ? AND user_id = ?",
      ).bind(artifactId, roadmap.id, user.id),
    );
  }

  await c.env.DB.batch(statements);
  const updated = await getRoadmapForUser(c.env.DB, roadmap.id, user.id);
  return c.json({ roadmap: updated ? toPublicRoadmap(updated) : null });
});

async function createUniqueRoadmapSlug(
  db: D1Database,
  roadmapId: string,
  source: string,
): Promise<string> {
  const base = cleanHandle(source) || `roadmap-${roadmapId.slice(0, 8)}`;

  for (let index = 0; index < 40; index += 1) {
    const slug = index === 0 ? base : `${base}-${index + 1}`;
    const existing = await db
      .prepare("SELECT id FROM roadmaps WHERE slug = ? AND id != ?")
      .bind(slug, roadmapId)
      .first<{ id: string }>();

    if (!existing) {
      return slug;
    }
  }

  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

import { Hono } from "hono";
import { listArtifacts } from "../db/artifacts";
import { createGraphType, listGraphTypes } from "../db/graph-types";
import { getGraph, replaceGraph } from "../db/graphs";
import { toPublicArtifact, toPublicRoadmap } from "../db/public-mappers";
import { createRoadmap, getRoadmapForUser, listRoadmaps } from "../db/roadmaps";
import {
  badRequest,
  cleanHandle,
  cleanText,
  getOwnedRoadmap,
  notFound,
  optionalString,
  readJson,
  requiredCleanText,
  requireUser,
  stringArray,
  type AppBindings,
} from "../http";
import { deleteArtifactFiles, listArtifactFileKeysForRoadmap } from "../services/artifacts";

export const roadmapRoutes = new Hono<AppBindings>();

// Lists the current user's roadmaps, already shaped for the frontend API.
roadmapRoutes.get("/roadmaps", async (c) => {
  const user = await requireUser(c);

  return c.json({ roadmaps: await listRoadmaps(c.env.DB, user.id) });
});

// Creates the roadmap shell and seeds default graph type definitions.
roadmapRoutes.post("/roadmaps", async (c) => {
  const user = await requireUser(c);

  const body = await readJson(c.req.raw);
  const title = cleanText(body.title, "New Roadmap", 120);
  const summary = cleanText(body.summary, "", 1000);
  const roadmap = await createRoadmap(c.env.DB, user, { title, summary });

  return c.json({ roadmap: roadmap ? toPublicRoadmap(roadmap) : null }, 201);
});

// Returns one owned roadmap with its artifact sidebar data.
roadmapRoutes.get("/roadmaps/:id", async (c) => {
  const user = await requireUser(c);

  const roadmap = await getOwnedRoadmap(c, user);
  if (!roadmap) {
    return notFound();
  }

  const artifacts = await listArtifacts(c.env.DB, user.id, roadmap.id);
  return c.json({
    roadmap: toPublicRoadmap(roadmap),
    artifacts: artifacts.map(toPublicArtifact),
  });
});

// Updates only user-editable roadmap summary fields.
roadmapRoutes.patch("/roadmaps/:id", async (c) => {
  const user = await requireUser(c);

  const roadmap = await getOwnedRoadmap(c, user);
  if (!roadmap) {
    return notFound();
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

// Deletes dependent data explicitly before removing the roadmap row.
roadmapRoutes.delete("/roadmaps/:id", async (c) => {
  const user = await requireUser(c);

  const roadmap = await getOwnedRoadmap(c, user);
  if (!roadmap) {
    return notFound();
  }

  const artifactFileKeys = await listArtifactFileKeysForRoadmap(c.env.DB, roadmap.id, user.id);

  // D1 is the source of truth; R2 cleanup runs after rows are removed.
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
  await deleteArtifactFiles(c.env, artifactFileKeys, { roadmapId: roadmap.id, userId: user.id });

  return c.json({ ok: true });
});

// Graph loading is ownership-gated by the roadmap lookup above.
roadmapRoutes.get("/roadmaps/:id/graph", async (c) => {
  const user = await requireUser(c);

  const roadmap = await getOwnedRoadmap(c, user);
  if (!roadmap) {
    return notFound();
  }

  return c.json({ graph: await getGraph(c.env.DB, roadmap.id) });
});

// Replaces the whole graph snapshot after shared graph validation/normalization.
roadmapRoutes.patch("/roadmaps/:id/graph", async (c) => {
  const user = await requireUser(c);

  const roadmap = await getOwnedRoadmap(c, user);
  if (!roadmap) {
    return notFound();
  }

  const body = await readJson(c.req.raw);
  try {
    const graph = await replaceGraph(c.env.DB, roadmap.id, body.graph ?? body);
    return c.json({ graph });
  } catch (error) {
    badRequest(error instanceof Error ? error.message : "Failed to save graph.");
  }
});

// Node and edge type definitions are listed together for the graph editor.
roadmapRoutes.get("/roadmaps/:id/types", async (c) => {
  const user = await requireUser(c);

  const roadmap = await getOwnedRoadmap(c, user);
  if (!roadmap) {
    return notFound();
  }

  const [nodeTypes, edgeTypes] = await Promise.all([
    listGraphTypes(c.env.DB, roadmap.id, "node"),
    listGraphTypes(c.env.DB, roadmap.id, "edge"),
  ]);

  return c.json({ nodeTypes, edgeTypes });
});

// Adds a custom node or edge type scoped to this roadmap.
roadmapRoutes.post("/roadmaps/:id/types", async (c) => {
  const user = await requireUser(c);

  const roadmap = await getOwnedRoadmap(c, user);
  if (!roadmap) {
    return notFound();
  }

  const body = await readJson(c.req.raw);
  const scope = optionalString(body.scope) === "edge" ? "edge" : "node";
  const name = requiredCleanText(body.name, "Type name is required.", 40);

  const type = await createGraphType(c.env.DB, roadmap.id, scope, {
    id: optionalString(body.id),
    name,
    description: optionalString(body.description) ?? "",
    color: optionalString(body.color),
    icon: optionalString(body.icon),
  });

  return c.json({ type }, 201);
});

// Publishes a snapshot by setting public metadata and public artifact visibility.
roadmapRoutes.post("/roadmaps/:id/publish", async (c) => {
  const user = await requireUser(c);

  const roadmap = await getOwnedRoadmap(c, user);
  if (!roadmap) {
    return notFound();
  }

  const body = await readJson(c.req.raw);
  const publicTitle = cleanText(body.publicTitle, roadmap.title, 120);
  const publicSummary = cleanText(body.publicSummary, roadmap.summary, 1000);
  const slugSource = optionalString(body.slug) ?? publicTitle;
  const slug = await createUniqueRoadmapSlug(c.env.DB, roadmap.id, user.id, slugSource);
  const publicArtifactIds = stringArray(body.artifactIds);

  // Reset all artifact visibility first, then opt selected artifacts back in.
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

// Slugs only need to be unique within one user's public roadmap namespace.
async function createUniqueRoadmapSlug(
  db: D1Database,
  roadmapId: string,
  userId: string,
  source: string,
): Promise<string> {
  const base = cleanHandle(source) || `roadmap-${roadmapId.slice(0, 8)}`;

  for (let index = 0; index < 40; index += 1) {
    const slug = index === 0 ? base : `${base}-${index + 1}`;
    const existing = await db
      .prepare("SELECT id FROM roadmaps WHERE slug = ? AND user_id = ? AND id != ?")
      .bind(slug, userId, roadmapId)
      .first<{ id: string }>();

    if (!existing) {
      return slug;
    }
  }

  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

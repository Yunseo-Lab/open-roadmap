import { Hono } from "hono";
import { listArtifacts } from "../db/artifacts";
import { createGraphType, listGraphTypes } from "../db/graph-types";
import { getGraph, replaceGraph } from "../db/graphs";
import { toPublicArtifact, toPublicRoadmap } from "../db/public-mappers";
import {
  createRoadmap,
  createUniqueRoadmapSlug,
  deleteRoadmapRecords,
  listRoadmaps,
  publishRoadmap,
  updateRoadmapDetails,
} from "../db/roadmaps";
import {
  badRequest,
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

  const updated = await updateRoadmapDetails(c.env.DB, roadmap.id, user.id, { title, summary });
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
  await deleteRoadmapRecords(c.env.DB, roadmap.id, user.id);
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

  const updated = await publishRoadmap(c.env.DB, roadmap.id, user.id, {
    publicTitle,
    publicSummary,
    slug,
    artifactIds: publicArtifactIds,
  });
  return c.json({ roadmap: updated ? toPublicRoadmap(updated) : null });
});

import { Hono } from "hono";
import { getArtifactForUser, getPublicArtifact, getRoadmapForUser, toPublicArtifact } from "../db/queries";
import {
  cleanText,
  getOwnedArtifact,
  nodeBelongsToRoadmap,
  notFound,
  optionalFormText,
  readJson,
  requireUser,
  unauthorized,
  type AppBindings,
} from "../http";
import { createFileArtifact, deleteArtifact, validateUploadFile } from "../services/artifacts";

export const artifactRoutes = new Hono<AppBindings>();

artifactRoutes.post("/uploads", async (c) => {
  const user = await requireUser(c);
  if (!user) {
    return unauthorized(c);
  }

  const form = await c.req.raw.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return c.json({ error: "The file field is required." }, 400);
  }

  const validationError = validateUploadFile(file);
  if (validationError) {
    return c.json({ error: validationError }, 400);
  }

  const roadmapId = optionalFormText(form.get("roadmapId"));
  const nodeId = optionalFormText(form.get("nodeId"));
  if (roadmapId) {
    const roadmap = await getRoadmapForUser(c.env.DB, roadmapId, user.id);
    if (!roadmap) {
      return c.json({ error: "Roadmap not found." }, 404);
    }
  }
  if (nodeId) {
    if (!roadmapId) {
      return c.json({ error: "Roadmap is required when attaching to a node." }, 400);
    }
    if (!(await nodeBelongsToRoadmap(c.env.DB, nodeId, roadmapId))) {
      return c.json({ error: "Node not found for this roadmap." }, 404);
    }
  }

  const artifact = await createFileArtifact(c.env, user, {
    file,
    roadmapId,
    nodeId,
    title: cleanText(form.get("title"), file.name || "Attached file", 120),
  });

  return c.json({ artifact: artifact ? toPublicArtifact(artifact) : null }, 201);
});

artifactRoutes.patch("/artifacts/:id", async (c) => {
  const user = await requireUser(c);
  if (!user) {
    return unauthorized(c);
  }

  const artifact = await getOwnedArtifact(c, user);
  if (!artifact) {
    return notFound(c);
  }

  const body = await readJson(c.req.raw);
  const nodeId = body.nodeId === null
    ? null
    : typeof body.nodeId === "string"
      ? cleanText(body.nodeId, "", 80)
      : undefined;

  if (nodeId === undefined || nodeId === "") {
    return c.json({ error: "Node is required, or pass null to detach." }, 400);
  }

  if (nodeId) {
    if (!artifact.roadmap_id) {
      return c.json({ error: "Artifact must belong to a roadmap before it can be attached." }, 400);
    }
    if (!(await nodeBelongsToRoadmap(c.env.DB, nodeId, artifact.roadmap_id))) {
      return c.json({ error: "Node not found for this roadmap." }, 404);
    }
  }

  await c.env.DB.prepare(
    `UPDATE artifacts
     SET node_id = ?
     WHERE id = ? AND user_id = ?`,
  )
    .bind(nodeId, artifact.id, user.id)
    .run();

  const updated = await getArtifactForUser(c.env.DB, artifact.id, user.id);
  return c.json({ artifact: updated ? toPublicArtifact(updated) : null });
});

artifactRoutes.delete("/artifacts/:id", async (c) => {
  const user = await requireUser(c);
  if (!user) {
    return unauthorized(c);
  }

  const artifact = await getOwnedArtifact(c, user);
  if (!artifact) {
    return notFound(c);
  }

  await deleteArtifact(c.env, artifact);
  return c.json({ ok: true });
});

artifactRoutes.get("/artifacts/:id/file", async (c) => {
  const artifactId = c.req.param("id");
  const user = await requireUser(c);
  const privateArtifact = user
    ? await getArtifactForUser(c.env.DB, artifactId, user.id)
    : null;
  const artifact = privateArtifact ?? (await getPublicArtifact(c.env.DB, artifactId));

  if (!artifact?.r2_key) {
    return notFound(c);
  }

  const object = await c.env.FILES.get(artifact.r2_key);
  if (!object) {
    return notFound(c);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", artifact.is_public ? "public, max-age=3600" : "private, max-age=0");
  return new Response(object.body, { headers });
});

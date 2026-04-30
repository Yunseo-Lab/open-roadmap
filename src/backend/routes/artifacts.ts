import { Hono } from "hono";
import { getArtifactForUser, getPublicArtifact } from "../db/artifacts";
import { toPublicArtifact } from "../db/public-mappers";
import { getRoadmapForUser } from "../db/roadmaps";
import {
  badRequest,
  cleanText,
  getOptionalUser,
  getOwnedArtifact,
  nodeBelongsToRoadmap,
  notFound,
  optionalString,
  optionalFormText,
  readJson,
  requireUser,
  type AppBindings,
} from "../http";
import { createFileArtifact, deleteArtifact, validateUploadFile } from "../services/artifacts";

export const artifactRoutes = new Hono<AppBindings>();

// Handles multipart uploads and optionally attaches the file to a roadmap node.
artifactRoutes.post("/uploads", async (c) => {
  const user = await requireUser(c);

  const form = await c.req.raw.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    badRequest("The file field is required.");
  }

  const validationError = validateUploadFile(file);
  if (validationError) {
    badRequest(validationError);
  }

  const roadmapId = optionalFormText(form.get("roadmapId"));
  const nodeId = optionalFormText(form.get("nodeId"));

  // Roadmap and node ids are cross-checked so users cannot attach across ownership boundaries.
  if (roadmapId) {
    const roadmap = await getRoadmapForUser(c.env.DB, roadmapId, user.id);
    if (!roadmap) {
      notFound("Roadmap not found.");
    }
  }
  if (nodeId) {
    if (!roadmapId) {
      badRequest("Roadmap is required when attaching to a node.");
    }
    if (!(await nodeBelongsToRoadmap(c.env.DB, nodeId, roadmapId))) {
      notFound("Node not found for this roadmap.");
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

// Moves an existing artifact between nodes, or detaches it when nodeId is null.
artifactRoutes.patch("/artifacts/:id", async (c) => {
  const user = await requireUser(c);

  const artifact = await getOwnedArtifact(c, user);
  if (!artifact) {
    return notFound();
  }

  const body = await readJson(c.req.raw);
  const nodeId = body.nodeId === null
    ? null
    : optionalString(body.nodeId);

  if (nodeId === undefined) {
    badRequest("Node is required, or pass null to detach.");
  }

  if (nodeId) {
    if (!artifact.roadmap_id) {
      badRequest("Artifact must belong to a roadmap before it can be attached.");
    }
    if (!(await nodeBelongsToRoadmap(c.env.DB, nodeId, artifact.roadmap_id))) {
      notFound("Node not found for this roadmap.");
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

  const artifact = await getOwnedArtifact(c, user);
  if (!artifact) {
    return notFound();
  }

  await deleteArtifact(c.env, artifact);
  return c.json({ ok: true });
});

// File downloads are private by owner first, then public only when explicitly published.
artifactRoutes.get("/artifacts/:id/file", async (c) => {
  const artifactId = c.req.param("id");
  const user = await getOptionalUser(c);
  const privateArtifact = user
    ? await getArtifactForUser(c.env.DB, artifactId, user.id)
    : null;
  const artifact = privateArtifact ?? (await getPublicArtifact(c.env.DB, artifactId));

  if (!artifact?.r2_key) {
    return notFound();
  }

  const object = await c.env.FILES.get(artifact.r2_key);
  if (!object) {
    return notFound();
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", artifact.is_public ? "public, max-age=3600" : "private, max-age=0");
  return new Response(object.body, { headers });
});

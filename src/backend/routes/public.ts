import { Hono } from "hono";
import { getGraph, toPublicArtifact, toPublicRoadmap } from "../db/queries";
import { cleanHandle, notFound, type AppBindings } from "../http";
import type { ArtifactRow, RoadmapRow } from "../types";

export const publicRoutes = new Hono<AppBindings>();

publicRoutes.get("/public/users/:handle", async (c) => {
  const handle = cleanHandle(c.req.param("handle"));
  if (!handle) {
    return notFound(c);
  }

  const profile = await c.env.DB.prepare(
    `SELECT profiles.handle, profiles.display_name, profiles.bio, users.image
     FROM profiles
     JOIN users ON users.id = profiles.user_id
     WHERE profiles.handle = ?`,
  )
    .bind(handle)
    .first<{ handle: string; display_name: string; bio: string; image: string | null }>();

  if (!profile) {
    return notFound(c);
  }

  const roadmaps = await c.env.DB.prepare(
    `SELECT
       roadmaps.*,
       (
         SELECT COUNT(*)
         FROM roadmap_nodes
         WHERE roadmap_nodes.roadmap_id = roadmaps.id
       ) AS node_count
     FROM roadmaps
     WHERE roadmaps.user_id = (SELECT user_id FROM profiles WHERE handle = ?)
       AND roadmaps.status = 'published'
     ORDER BY roadmaps.published_at DESC`,
  )
    .bind(handle)
    .all<RoadmapRow>();

  return c.json({
    profile: {
      handle: profile.handle,
      displayName: profile.display_name,
      bio: profile.bio,
      image: profile.image,
    },
    roadmaps: (roadmaps.results ?? []).map(toPublicRoadmap),
  });
});

publicRoutes.get("/public/roadmaps/:slug", async (c) => {
  const slug = cleanHandle(c.req.param("slug"));
  if (!slug) {
    return notFound(c);
  }

  const roadmap = await c.env.DB.prepare(
    `SELECT roadmaps.*
     FROM roadmaps
     WHERE slug = ? AND status = 'published'`,
  )
    .bind(slug)
    .first<RoadmapRow>();

  if (!roadmap) {
    return notFound(c);
  }

  const profile = await c.env.DB.prepare(
    `SELECT profiles.handle, profiles.display_name, profiles.bio, users.image
     FROM profiles
     JOIN users ON users.id = profiles.user_id
     WHERE profiles.user_id = ?`,
  )
    .bind(roadmap.user_id)
    .first<{ handle: string; display_name: string; bio: string; image: string | null }>();

  const artifacts = await c.env.DB.prepare(
    `SELECT *
     FROM artifacts
     WHERE roadmap_id = ? AND is_public = 1
     ORDER BY created_at DESC`,
  )
    .bind(roadmap.id)
    .all<ArtifactRow>();

  return c.json({
    profile: profile
      ? {
          handle: profile.handle,
          displayName: profile.display_name,
          bio: profile.bio,
          image: profile.image,
        }
      : null,
    roadmap: toPublicRoadmap(roadmap),
    graph: await getGraph(c.env.DB, roadmap.id),
    artifacts: (artifacts.results ?? []).map(toPublicArtifact),
  });
});

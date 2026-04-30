import { Hono } from "hono";
import { getGraph } from "../db/graphs";
import {
  getPublishedRoadmapForHandle,
  getPublicProfileByHandle,
  listPublicArtifactsForRoadmap,
  listPublicRoadmapsForHandle,
} from "../db/public";
import { toPublicArtifact, toPublicRoadmap } from "../db/public-mappers";
import { cleanHandle, notFound, type AppBindings } from "../http";

export const publicRoutes = new Hono<AppBindings>();

// Public profile pages expose only the profile fields and published roadmaps.
publicRoutes.get("/public/users/:handle", async (c) => {
  const handle = cleanHandle(c.req.param("handle"));
  if (!handle) {
    return notFound();
  }

  const profile = await getPublicProfileByHandle(c.env.DB, handle);
  if (!profile) {
    return notFound();
  }

  const roadmaps = await listPublicRoadmapsForHandle(c.env.DB, handle);

  return c.json({
    profile: {
      handle: profile.handle,
      displayName: profile.display_name,
      bio: profile.bio,
      image: profile.image,
    },
    roadmaps: roadmaps.map(toPublicRoadmap),
  });
});

// Public roadmap pages expose the published graph plus artifacts explicitly marked public.
publicRoutes.get("/public/users/:handle/roadmaps/:slug", async (c) => {
  const handle = cleanHandle(c.req.param("handle"));
  const slug = cleanHandle(c.req.param("slug"));
  if (!handle || !slug) {
    return notFound();
  }

  const [profile, roadmap] = await Promise.all([
    getPublicProfileByHandle(c.env.DB, handle),
    getPublishedRoadmapForHandle(c.env.DB, handle, slug),
  ]);
  if (!profile || !roadmap) {
    return notFound();
  }

  const artifacts = await listPublicArtifactsForRoadmap(c.env.DB, roadmap.id);

  return c.json({
    profile: {
      handle: profile.handle,
      displayName: profile.display_name,
      bio: profile.bio,
      image: profile.image,
    },
    roadmap: toPublicRoadmap(roadmap),
    graph: await getGraph(c.env.DB, roadmap.id),
    artifacts: artifacts.map(toPublicArtifact),
  });
});

import type { ArtifactRow, RoadmapRow } from "../types";

export type PublicProfileRow = {
  handle: string;
  display_name: string;
  bio: string;
  image: string | null;
};

// Public profiles expose only profile display fields and the user's avatar.
export async function getPublicProfileByHandle(
  db: D1Database,
  handle: string,
): Promise<PublicProfileRow | null> {
  return db
    .prepare(
      `SELECT profiles.handle, profiles.display_name, profiles.bio, users.image
       FROM profiles
       JOIN users ON users.id = profiles.user_id
       WHERE profiles.handle = ?`,
    )
    .bind(handle)
    .first<PublicProfileRow>();
}

// Profile pages list only published roadmaps, with a lightweight node count.
export async function listPublicRoadmapsForHandle(
  db: D1Database,
  handle: string,
): Promise<RoadmapRow[]> {
  const result = await db
    .prepare(
      `SELECT
         roadmaps.*,
         (
           SELECT COUNT(*)
           FROM roadmap_nodes
           WHERE roadmap_nodes.roadmap_id = roadmaps.id
         ) AS node_count
       FROM roadmaps
       JOIN profiles ON profiles.user_id = roadmaps.user_id
       WHERE profiles.handle = ?
         AND roadmaps.status = 'published'
       ORDER BY roadmaps.published_at DESC`,
    )
    .bind(handle)
    .all<RoadmapRow>();

  return result.results ?? [];
}

// Public roadmap pages are addressed by owner handle plus roadmap slug.
export async function getPublishedRoadmapForHandle(
  db: D1Database,
  handle: string,
  slug: string,
): Promise<RoadmapRow | null> {
  return db
    .prepare(
      `SELECT roadmaps.*
       FROM roadmaps
       JOIN profiles ON profiles.user_id = roadmaps.user_id
       WHERE profiles.handle = ?
         AND roadmaps.slug = ?
         AND roadmaps.status = 'published'`,
    )
    .bind(handle, slug)
    .first<RoadmapRow>();
}

// Public artifacts must be explicitly marked visible for the published roadmap.
export async function listPublicArtifactsForRoadmap(
  db: D1Database,
  roadmapId: string,
): Promise<ArtifactRow[]> {
  const result = await db
    .prepare(
      `SELECT *
       FROM artifacts
       WHERE roadmap_id = ? AND is_public = 1
       ORDER BY created_at DESC`,
    )
    .bind(roadmapId)
    .all<ArtifactRow>();

  return result.results ?? [];
}

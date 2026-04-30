import type { ArtifactRow } from "../types";

// Lists a user's artifacts, optionally narrowed to one roadmap.
export async function listArtifacts(
  db: D1Database,
  userId: string,
  roadmapId?: string,
): Promise<ArtifactRow[]> {
  if (roadmapId) {
    const result = await db
      .prepare(
        `SELECT * FROM artifacts
         WHERE user_id = ? AND roadmap_id = ?
         ORDER BY created_at DESC`,
      )
      .bind(userId, roadmapId)
      .all<ArtifactRow>();
    return result.results ?? [];
  }

  const result = await db
    .prepare(
      `SELECT * FROM artifacts
       WHERE user_id = ?
       ORDER BY created_at DESC`,
    )
    .bind(userId)
    .all<ArtifactRow>();
  return result.results ?? [];
}

// Private artifact lookup always includes user ownership.
export async function getArtifactForUser(db: D1Database, artifactId: string, userId: string) {
  return db
    .prepare("SELECT * FROM artifacts WHERE id = ? AND user_id = ?")
    .bind(artifactId, userId)
    .first<ArtifactRow>();
}

// Public downloads require both artifact visibility and a published parent roadmap.
export async function getPublicArtifact(db: D1Database, artifactId: string) {
  return db
    .prepare(
      `SELECT artifacts.*
       FROM artifacts
       JOIN roadmaps ON roadmaps.id = artifacts.roadmap_id
       WHERE artifacts.id = ?
         AND artifacts.is_public = 1
         AND roadmaps.status = 'published'`,
    )
    .bind(artifactId)
    .first<ArtifactRow>();
}

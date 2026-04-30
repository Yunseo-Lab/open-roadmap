import type { ArtifactRow } from "../types";

const artifactColumns = `
  id, user_id, roadmap_id, node_id, title, kind, mime_type, original_name,
  size, r2_key, url, text_content, is_public, created_at
`;

const artifactTableColumns = `
  artifacts.id, artifacts.user_id, artifacts.roadmap_id, artifacts.node_id,
  artifacts.title, artifacts.kind, artifacts.mime_type, artifacts.original_name,
  artifacts.size, artifacts.r2_key, artifacts.url, artifacts.text_content,
  artifacts.is_public, artifacts.created_at
`;

// Lists a user's artifacts, optionally narrowed to one roadmap.
export async function listArtifacts(
  db: D1Database,
  userId: string,
  roadmapId?: string,
): Promise<ArtifactRow[]> {
  if (roadmapId) {
    const result = await db
      .prepare(
        `SELECT ${artifactColumns}
         FROM artifacts
         WHERE user_id = ? AND roadmap_id = ?
         ORDER BY created_at DESC`,
      )
      .bind(userId, roadmapId)
      .all<ArtifactRow>();
    return result.results ?? [];
  }

  const result = await db
    .prepare(
      `SELECT ${artifactColumns}
       FROM artifacts
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
    .prepare(`SELECT ${artifactColumns} FROM artifacts WHERE id = ? AND user_id = ?`)
    .bind(artifactId, userId)
    .first<ArtifactRow>();
}

export async function updateArtifactNode(
  db: D1Database,
  artifactId: string,
  userId: string,
  nodeId: string | null,
) {
  await db
    .prepare(
      `UPDATE artifacts
       SET node_id = ?
       WHERE id = ? AND user_id = ?`,
    )
    .bind(nodeId, artifactId, userId)
    .run();

  return getArtifactForUser(db, artifactId, userId);
}

// Public downloads require both artifact visibility and a published parent roadmap.
export async function getPublicArtifact(db: D1Database, artifactId: string) {
  return db
    .prepare(
      `SELECT ${artifactTableColumns}
       FROM artifacts
       JOIN roadmaps ON roadmaps.id = artifacts.roadmap_id
       WHERE artifacts.id = ?
         AND artifacts.is_public = 1
         AND roadmaps.status = 'published'`,
    )
    .bind(artifactId)
    .first<ArtifactRow>();
}

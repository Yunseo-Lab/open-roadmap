import type { CurrentUser, RoadmapRow } from "../types";
import { ensureDefaultGraphTypes } from "./graph-types";
import { toPublicRoadmap } from "./public-mappers";

// Roadmap lists include a lightweight node count for dashboard summaries.
export async function listRoadmaps(db: D1Database, userId: string) {
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
       WHERE roadmaps.user_id = ?
       ORDER BY roadmaps.updated_at DESC`,
    )
    .bind(userId)
    .all<RoadmapRow>();

  return (result.results ?? []).map(toPublicRoadmap);
}

// Ownership checks are encoded in the query so callers never fetch by id alone.
export async function getRoadmapForUser(db: D1Database, roadmapId: string, userId: string) {
  return db
    .prepare("SELECT * FROM roadmaps WHERE id = ? AND user_id = ?")
    .bind(roadmapId, userId)
    .first<RoadmapRow>();
}

// New roadmaps always start with the default graph vocabulary.
export async function createRoadmap(
  db: D1Database,
  user: CurrentUser,
  input: { title: string; summary: string },
) {
  const now = Date.now();
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO roadmaps (id, user_id, title, summary, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, user.id, input.title, input.summary, now, now)
    .run();

  await ensureDefaultGraphTypes(db, id);
  return getRoadmapForUser(db, id, user.id);
}

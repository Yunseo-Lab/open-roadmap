import type { CurrentUser, RoadmapRow } from "../types";
import { ensureDefaultGraphTypes } from "./graph-types";
import { toPublicRoadmap } from "./public-mappers";

const roadmapColumns = `
  id, user_id, title, summary, status, public_title, public_summary, slug,
  published_at, created_at, updated_at
`;

const roadmapTableColumns = `
  roadmaps.id, roadmaps.user_id, roadmaps.title, roadmaps.summary,
  roadmaps.status, roadmaps.public_title, roadmaps.public_summary,
  roadmaps.slug, roadmaps.published_at, roadmaps.created_at, roadmaps.updated_at
`;

// Roadmap lists include a lightweight node count for dashboard summaries.
export async function listRoadmaps(db: D1Database, userId: string) {
  const result = await db
    .prepare(
      `SELECT
         ${roadmapTableColumns},
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
    .prepare(`SELECT ${roadmapColumns} FROM roadmaps WHERE id = ? AND user_id = ?`)
    .bind(roadmapId, userId)
    .first<RoadmapRow>();
}

export async function updateRoadmapDetails(
  db: D1Database,
  roadmapId: string,
  userId: string,
  input: { title: string; summary: string },
) {
  await db.prepare(
    `UPDATE roadmaps
     SET title = ?, summary = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
  )
    .bind(input.title, input.summary, Date.now(), roadmapId, userId)
    .run();

  return getRoadmapForUser(db, roadmapId, userId);
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

export async function deleteRoadmapRecords(db: D1Database, roadmapId: string, userId: string) {
  await db.batch([
    db.prepare(
      `DELETE FROM ai_messages
       WHERE conversation_id IN (
         SELECT id FROM ai_conversations WHERE roadmap_id = ? AND user_id = ?
       )`,
    ).bind(roadmapId, userId),
    db.prepare(
      `DELETE FROM ai_runs
       WHERE conversation_id IN (
         SELECT id FROM ai_conversations WHERE roadmap_id = ? AND user_id = ?
       )`,
    ).bind(roadmapId, userId),
    db.prepare("DELETE FROM ai_conversations WHERE roadmap_id = ? AND user_id = ?").bind(roadmapId, userId),
    db.prepare("DELETE FROM roadmap_edges WHERE roadmap_id = ?").bind(roadmapId),
    db.prepare("DELETE FROM roadmap_nodes WHERE roadmap_id = ?").bind(roadmapId),
    db.prepare("DELETE FROM artifacts WHERE roadmap_id = ? AND user_id = ?").bind(roadmapId, userId),
    db.prepare("DELETE FROM roadmaps WHERE id = ? AND user_id = ?").bind(roadmapId, userId),
  ]);
}

export async function createUniqueRoadmapSlug(
  db: D1Database,
  roadmapId: string,
  userId: string,
  source: string,
): Promise<string> {
  const base = slugifyRoadmapSlug(source) || `roadmap-${roadmapId.slice(0, 8)}`;

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

export async function publishRoadmap(
  db: D1Database,
  roadmapId: string,
  userId: string,
  input: {
    publicTitle: string;
    publicSummary: string;
    slug: string;
    artifactIds: string[];
  },
) {
  const now = Date.now();
  const statements: D1PreparedStatement[] = [
    db.prepare(
      `UPDATE roadmaps
       SET status = 'published', public_title = ?, public_summary = ?, slug = ?, published_at = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    ).bind(input.publicTitle, input.publicSummary, input.slug, now, now, roadmapId, userId),
    db.prepare("UPDATE artifacts SET is_public = 0 WHERE roadmap_id = ? AND user_id = ?").bind(roadmapId, userId),
  ];

  for (const artifactId of input.artifactIds) {
    statements.push(
      db.prepare("UPDATE artifacts SET is_public = 1 WHERE id = ? AND roadmap_id = ? AND user_id = ?").bind(
        artifactId,
        roadmapId,
        userId,
      ),
    );
  }

  await db.batch(statements);
  return getRoadmapForUser(db, roadmapId, userId);
}

function slugifyRoadmapSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

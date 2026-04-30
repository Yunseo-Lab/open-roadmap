import type { ArtifactRow, RoadmapRow } from "../types";

// Converts database column names into the public API shape used by the frontend.
export function toPublicRoadmap(row: RoadmapRow) {
  const roadmap = {
    id: row.id,
    title: row.title,
    summary: row.summary,
    status: row.status,
    publicTitle: row.public_title,
    publicSummary: row.public_summary,
    slug: row.slug,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (row.node_count !== undefined) {
    return {
      ...roadmap,
      nodeCount: row.node_count,
    };
  }

  return roadmap;
}

// R2-backed files expose a download URL, while text/link artifacts can omit it.
export function toPublicArtifact(row: ArtifactRow) {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    mimeType: row.mime_type,
    originalName: row.original_name,
    size: row.size,
    url: row.url,
    nodeId: row.node_id,
    isPublic: Boolean(row.is_public),
    createdAt: row.created_at,
    fileUrl: row.r2_key ? `/api/artifacts/${row.id}/file` : null,
  };
}

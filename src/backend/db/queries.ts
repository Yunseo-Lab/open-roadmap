import {
  defaultEdgeTypeDefinitions,
  defaultNodeTypeDefinitions,
  isTypeId,
  normalizeColor,
  normalizeGraph,
  parseStoredMetadata,
  safeText,
} from "../../shared/graph";
import type {
  ArtifactRow,
  CurrentUser,
  GraphEdge,
  GraphNode,
  GraphTypeDefinition,
  RoadmapGraph,
  RoadmapRow,
} from "../types";

type NodeRow = {
  id: string;
  type: GraphNode["type"];
  title: string;
  description: string;
  status: string;
  x: number;
  y: number;
  metadata: string;
};

type EdgeRow = {
  id: string;
  type: GraphEdge["data"]["kind"];
  source_node_id: string;
  target_node_id: string;
  label: string;
  metadata: string;
};

type TypeRow = {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  is_default: number;
  sort_order: number;
};

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

export async function getRoadmapForUser(db: D1Database, roadmapId: string, userId: string) {
  return db
    .prepare("SELECT * FROM roadmaps WHERE id = ? AND user_id = ?")
    .bind(roadmapId, userId)
    .first<RoadmapRow>();
}

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

export async function getGraph(db: D1Database, roadmapId: string): Promise<RoadmapGraph> {
  await ensureDefaultGraphTypes(db, roadmapId);
  const [nodeTypes, edgeTypes] = await Promise.all([
    listGraphTypes(db, roadmapId, "node"),
    listGraphTypes(db, roadmapId, "edge"),
  ]);
  const nodeResult = await db
    .prepare(
      `SELECT id, type, title, description, status, x, y, metadata
       FROM roadmap_nodes
       WHERE roadmap_id = ?
       ORDER BY created_at ASC`,
    )
    .bind(roadmapId)
    .all<NodeRow>();

  const edgeResult = await db
    .prepare(
      `SELECT id, type, source_node_id, target_node_id, label, metadata
       FROM roadmap_edges
       WHERE roadmap_id = ?
       ORDER BY created_at ASC`,
    )
    .bind(roadmapId)
    .all<EdgeRow>();

  const nodes: GraphNode[] = (nodeResult.results ?? []).map((node) => ({
    id: node.id,
    type: node.type,
    position: {
      x: node.x,
      y: node.y,
    },
    data: {
      title: node.title,
      description: node.description,
      status: node.status,
      metadata: parseStoredMetadata(node.metadata),
    },
  }));

  const edges: GraphEdge[] = (edgeResult.results ?? []).map((edge) => ({
    id: edge.id,
    source: edge.source_node_id,
    target: edge.target_node_id,
    ...edgeHandlesFromMetadata(parseStoredMetadata(edge.metadata)),
    type: "smoothstep",
    label: edge.label,
    data: {
      kind: edge.type,
      label: edge.label,
      metadata: parseStoredMetadata(edge.metadata),
    },
  }));

  return { nodes, edges, nodeTypes, edgeTypes };
}

export async function replaceGraph(
  db: D1Database,
  roadmapId: string,
  graphInput: unknown,
): Promise<RoadmapGraph> {
  await ensureDefaultGraphTypes(db, roadmapId);
  const existingNodeTypes = await listGraphTypes(db, roadmapId, "node");
  const existingEdgeTypes = await listGraphTypes(db, roadmapId, "edge");
  const graph = normalizeGraph(graphInput, {
    nodeTypes: existingNodeTypes,
    edgeTypes: existingEdgeTypes,
  });
  const existingArtifactAttachments = await db
    .prepare(
      `SELECT id, node_id
       FROM artifacts
       WHERE roadmap_id = ? AND node_id IS NOT NULL`,
    )
    .bind(roadmapId)
    .all<{ id: string; node_id: string }>();
  const nodeIds = graph.nodes.map((node) => node.id);
  const nodeIdSet = new Set(nodeIds);
  const now = Date.now();
  const statements: D1PreparedStatement[] = [
    db.prepare("DELETE FROM roadmap_edges WHERE roadmap_id = ?").bind(roadmapId),
    db.prepare("DELETE FROM roadmap_nodes WHERE roadmap_id = ?").bind(roadmapId),
  ];

  for (const type of graph.nodeTypes) {
    statements.push(upsertTypeStatement(db, roadmapId, "node", type, now));
  }

  for (const type of graph.edgeTypes) {
    statements.push(upsertTypeStatement(db, roadmapId, "edge", type, now));
  }

  for (const node of graph.nodes) {
    statements.push(
      db
        .prepare(
          `INSERT INTO roadmap_nodes
             (id, roadmap_id, type, title, description, status, x, y, metadata, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          node.id,
          roadmapId,
          node.type,
          node.data.title,
          node.data.description,
          node.data.status,
          node.position.x,
          node.position.y,
          JSON.stringify(node.data.metadata),
          now,
          now,
        ),
    );
  }

  for (const edge of graph.edges) {
    statements.push(
      db
        .prepare(
          `INSERT INTO roadmap_edges
             (id, roadmap_id, type, source_node_id, target_node_id, label, metadata, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          edge.id,
          roadmapId,
          edge.data.kind,
          edge.source,
          edge.target,
          edge.data.label,
          JSON.stringify(edge.data.metadata),
          now,
          now,
        ),
    );
  }

  if (nodeIds.length > 0) {
    statements.push(
      db
        .prepare(
          `UPDATE artifacts
           SET node_id = NULL
           WHERE roadmap_id = ? AND node_id IS NOT NULL AND node_id NOT IN (${nodeIds.map(() => "?").join(", ")})`,
        )
        .bind(roadmapId, ...nodeIds),
    );
  } else {
    statements.push(
      db.prepare("UPDATE artifacts SET node_id = NULL WHERE roadmap_id = ?").bind(roadmapId),
    );
  }

  for (const attachment of existingArtifactAttachments.results ?? []) {
    if (!nodeIdSet.has(attachment.node_id)) {
      continue;
    }
    statements.push(
      db
        .prepare("UPDATE artifacts SET node_id = ? WHERE id = ? AND roadmap_id = ?")
        .bind(attachment.node_id, attachment.id, roadmapId),
    );
  }

  statements.push(db.prepare("UPDATE roadmaps SET updated_at = ? WHERE id = ?").bind(now, roadmapId));
  await db.batch(statements);
  return graph;
}

export async function listGraphTypes(
  db: D1Database,
  roadmapId: string,
  scope: "node" | "edge",
): Promise<GraphTypeDefinition[]> {
  const table = scope === "node" ? "roadmap_node_types" : "roadmap_edge_types";
  const result = await db
    .prepare(
      `SELECT id, name, description, color, icon, is_default, sort_order
       FROM ${table}
       WHERE roadmap_id = ?
       ORDER BY sort_order ASC, name ASC`,
    )
    .bind(roadmapId)
    .all<TypeRow>();

  const rows = result.results ?? [];
  if (rows.length === 0) {
    return scope === "node" ? defaultNodeTypeDefinitions : defaultEdgeTypeDefinitions;
  }

  return rows.map(typeRowToDefinition);
}

export async function ensureDefaultGraphTypes(db: D1Database, roadmapId: string): Promise<void> {
  const now = Date.now();
  await db.batch([
    ...defaultNodeTypeDefinitions.map((definition) =>
      upsertTypeStatement(db, roadmapId, "node", definition, now),
    ),
    ...defaultEdgeTypeDefinitions.map((definition) =>
      upsertTypeStatement(db, roadmapId, "edge", definition, now),
    ),
  ]);
}

export async function createGraphType(
  db: D1Database,
  roadmapId: string,
  scope: "node" | "edge",
  input: {
    id?: string;
    name: string;
    description?: string;
    color?: string;
    icon?: string;
  },
): Promise<GraphTypeDefinition> {
  await ensureDefaultGraphTypes(db, roadmapId);

  const existingTypes = await listGraphTypes(db, roadmapId, scope);
  const id = await createUniqueTypeId(
    db,
    roadmapId,
    scope,
    input.id && isTypeId(input.id) ? input.id : slugTypeId(input.name),
  );
  const sortOrder = (existingTypes.at(-1)?.sortOrder ?? 0) + 10;
  const definition: GraphTypeDefinition = {
    id,
    name: safeText(input.name, "New type", 40),
    description: safeText(input.description, "", 200),
    color: normalizeColor(input.color, "#2c7a6f"),
    icon: safeText(input.icon, "circle", 32),
    isDefault: false,
    sortOrder,
  };

  await db.batch([upsertTypeStatement(db, roadmapId, scope, definition, Date.now())]);
  return definition;
}

function edgeHandlesFromMetadata(metadata: Record<string, unknown>) {
  return {
    ...(typeof metadata.sourceHandle === "string" ? { sourceHandle: metadata.sourceHandle } : {}),
    ...(typeof metadata.targetHandle === "string" ? { targetHandle: metadata.targetHandle } : {}),
  };
}

function upsertTypeStatement(
  db: D1Database,
  roadmapId: string,
  scope: "node" | "edge",
  definition: GraphTypeDefinition,
  now: number,
): D1PreparedStatement {
  const table = scope === "node" ? "roadmap_node_types" : "roadmap_edge_types";
  return db
    .prepare(
      `INSERT INTO ${table}
         (id, roadmap_id, name, description, color, icon, is_default, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id, roadmap_id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         color = excluded.color,
         icon = excluded.icon,
         sort_order = excluded.sort_order,
         updated_at = excluded.updated_at`,
    )
    .bind(
      definition.id,
      roadmapId,
      definition.name,
      definition.description,
      definition.color,
      definition.icon,
      definition.isDefault ? 1 : 0,
      definition.sortOrder,
      now,
      now,
    );
}

function typeRowToDefinition(row: TypeRow): GraphTypeDefinition {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    icon: row.icon,
    isDefault: Boolean(row.is_default),
    sortOrder: row.sort_order,
  };
}

async function createUniqueTypeId(
  db: D1Database,
  roadmapId: string,
  scope: "node" | "edge",
  source: string,
): Promise<string> {
  const table = scope === "node" ? "roadmap_node_types" : "roadmap_edge_types";
  const base = source || "custom";

  for (let index = 0; index < 30; index += 1) {
    const id = index === 0 ? base : `${base}-${index + 1}`;
    const existing = await db
      .prepare(`SELECT id FROM ${table} WHERE id = ? AND roadmap_id = ?`)
      .bind(id, roadmapId)
      .first<{ id: string }>();
    if (!existing) {
      return id;
    }
  }

  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

function slugTypeId(value: string): string {
  const id = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return isTypeId(id) ? id : `custom-${crypto.randomUUID().slice(0, 6)}`;
}

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

export async function getArtifactForUser(db: D1Database, artifactId: string, userId: string) {
  return db
    .prepare("SELECT * FROM artifacts WHERE id = ? AND user_id = ?")
    .bind(artifactId, userId)
    .first<ArtifactRow>();
}

export async function getPublicArtifact(db: D1Database, artifactId: string) {
  return db
    .prepare(
      `SELECT artifacts.*
       FROM artifacts
       LEFT JOIN roadmaps ON roadmaps.id = artifacts.roadmap_id
       WHERE artifacts.id = ?
         AND artifacts.is_public = 1
         AND roadmaps.status = 'published'`,
    )
    .bind(artifactId)
    .first<ArtifactRow>();
}

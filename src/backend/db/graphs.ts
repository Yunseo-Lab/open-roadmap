import { normalizeGraph, parseStoredMetadata } from "../../shared/graph";
import type { GraphEdge, GraphNode, RoadmapGraph } from "../types";
import {
  ensureDefaultGraphTypes,
  listGraphTypes,
  upsertGraphTypeStatement,
} from "./graph-types";

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

// Loads the persisted graph rows and rehydrates them into React Flow-style objects.
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

  const edges: GraphEdge[] = (edgeResult.results ?? []).map((edge) => {
    const metadata = parseStoredMetadata(edge.metadata);
    return {
      id: edge.id,
      source: edge.source_node_id,
      target: edge.target_node_id,
      ...edgeHandlesFromMetadata(metadata),
      type: "smoothstep",
      label: edge.label,
      data: {
        kind: edge.type,
        label: edge.label,
        metadata,
      },
    };
  });

  return { nodes, edges, nodeTypes, edgeTypes };
}

// Replaces the persisted graph in one batch after validating the full input graph.
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
  const nodeIdSet = new Set(graph.nodes.map((node) => node.id));
  const now = Date.now();

  // Edges are deleted first because they reference nodes being replaced.
  const statements: D1PreparedStatement[] = [
    db.prepare("DELETE FROM roadmap_edges WHERE roadmap_id = ?").bind(roadmapId),
    db.prepare("DELETE FROM roadmap_nodes WHERE roadmap_id = ?").bind(roadmapId),
  ];

  for (const type of graph.nodeTypes) {
    statements.push(upsertGraphTypeStatement(db, roadmapId, "node", type, now));
  }

  for (const type of graph.edgeTypes) {
    statements.push(upsertGraphTypeStatement(db, roadmapId, "edge", type, now));
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

  // Reset artifact links before reattaching only links whose nodes survived replacement.
  statements.push(
    db.prepare("UPDATE artifacts SET node_id = NULL WHERE roadmap_id = ? AND node_id IS NOT NULL").bind(roadmapId),
  );

  // Keep existing artifact-node links when the referenced node still exists.
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

// Edge handle positions are stored in metadata for compatibility with old rows.
function edgeHandlesFromMetadata(metadata: Record<string, unknown>) {
  return {
    ...(typeof metadata.sourceHandle === "string" ? { sourceHandle: metadata.sourceHandle } : {}),
    ...(typeof metadata.targetHandle === "string" ? { targetHandle: metadata.targetHandle } : {}),
  };
}

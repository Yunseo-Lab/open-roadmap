import {
  defaultEdgeTypeDefinitions,
  defaultNodeTypeDefinitions,
  isTypeId,
  normalizeColor,
  safeText,
} from "../../shared/graph";
import type { GraphTypeDefinition } from "../types";

export type GraphTypeScope = "node" | "edge";

type TypeRow = {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  is_default: number;
  sort_order: number;
};

// Type definitions are stored per roadmap, with shared defaults as a fallback.
export async function listGraphTypes(
  db: D1Database,
  roadmapId: string,
  scope: GraphTypeScope,
): Promise<GraphTypeDefinition[]> {
  const table = graphTypeTable(scope);
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

// Idempotently adds the built-in node and edge types to a roadmap.
export async function ensureDefaultGraphTypes(db: D1Database, roadmapId: string): Promise<void> {
  const now = Date.now();
  await db.batch([
    ...defaultNodeTypeDefinitions.map((definition) =>
      upsertGraphTypeStatement(db, roadmapId, "node", definition, now),
    ),
    ...defaultEdgeTypeDefinitions.map((definition) =>
      upsertGraphTypeStatement(db, roadmapId, "edge", definition, now),
    ),
  ]);
}

// Creates a user-defined graph type without colliding with existing type ids.
export async function createGraphType(
  db: D1Database,
  roadmapId: string,
  scope: GraphTypeScope,
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

  await db.batch([upsertGraphTypeStatement(db, roadmapId, scope, definition, Date.now())]);
  return definition;
}

// Node and edge type tables share the same column shape, so one helper builds both statements.
export function upsertGraphTypeStatement(
  db: D1Database,
  roadmapId: string,
  scope: GraphTypeScope,
  definition: GraphTypeDefinition,
  now: number,
): D1PreparedStatement {
  const table = graphTypeTable(scope);
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

function graphTypeTable(scope: GraphTypeScope): "roadmap_node_types" | "roadmap_edge_types" {
  return scope === "node" ? "roadmap_node_types" : "roadmap_edge_types";
}

// Converts SQLite numeric booleans into the graph type shape expected by shared code.
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

// Appends numeric suffixes before falling back to a random suffix.
async function createUniqueTypeId(
  db: D1Database,
  roadmapId: string,
  scope: GraphTypeScope,
  source: string,
): Promise<string> {
  const table = graphTypeTable(scope);
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

// Produces a custom graph type id from human text.
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

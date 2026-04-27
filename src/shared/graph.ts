import type { GraphEdge, GraphNode, GraphTypeDefinition, JsonRecord, RoadmapGraph } from "./types";

const maxNodeTitle = 120;
const maxNodeDescription = 2000;
const maxEdgeLabel = 80;
const allowedHandleIds = new Set(["top", "right", "bottom", "left"]);

export const defaultNodeTypeDefinitions: GraphTypeDefinition[] = [
  {
    id: "objective",
    name: "Objective",
    description: "The key outcome this roadmap is moving toward",
    color: "#2c7a6f",
    icon: "target",
    isDefault: true,
    sortOrder: 10,
  },
  {
    id: "milestone",
    name: "Milestone",
    description: "A major step toward the objective",
    color: "#b7791f",
    icon: "flag",
    isDefault: true,
    sortOrder: 20,
  },
  {
    id: "event",
    name: "Event",
    description: "Progress updates and reflection records",
    color: "#4469a8",
    icon: "calendar",
    isDefault: true,
    sortOrder: 30,
  },
  {
    id: "artifact",
    name: "Artifact",
    description: "Work products and supporting evidence",
    color: "#7a4d93",
    icon: "file",
    isDefault: true,
    sortOrder: 40,
  },
];

export const defaultEdgeTypeDefinitions: GraphTypeDefinition[] = [
  {
    id: "supports",
    name: "Supports",
    description: "One item supports another goal or step",
    color: "#2c7a6f",
    icon: "arrow-up-right",
    isDefault: true,
    sortOrder: 10,
  },
  {
    id: "depends_on",
    name: "Depends on",
    description: "A prerequisite or dependency relationship",
    color: "#b7791f",
    icon: "link",
    isDefault: true,
    sortOrder: 20,
  },
  {
    id: "evidences",
    name: "Evidence",
    description: "A resource proves or supports a goal or event",
    color: "#7a4d93",
    icon: "paperclip",
    isDefault: true,
    sortOrder: 30,
  },
  {
    id: "next",
    name: "Next",
    description: "Time or progress order",
    color: "#4469a8",
    icon: "arrow-right",
    isDefault: true,
    sortOrder: 40,
  },
];

type NormalizeOptions = {
  nodeTypes?: GraphTypeDefinition[];
  edgeTypes?: GraphTypeDefinition[];
};

export function safeText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed.slice(0, maxLength);
}

export function parseMetadata(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as JsonRecord;
}

export function parseStoredMetadata(value: string | null): JsonRecord {
  if (!value) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return parseMetadata(parsed);
  } catch {
    return {};
  }
}

export function isTypeId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9][a-z0-9_-]{0,47}$/.test(value);
}

export function normalizeTypeDefinitions(input: unknown, defaults: GraphTypeDefinition[]): GraphTypeDefinition[] {
  const rawDefinitions = Array.isArray(input) ? input : [];
  const byId = new Map(defaults.map((definition) => [definition.id, definition]));

  for (const rawDefinition of rawDefinitions) {
    if (!rawDefinition || typeof rawDefinition !== "object") {
      continue;
    }

    const definition = rawDefinition as {
      id?: unknown;
      name?: unknown;
      description?: unknown;
      color?: unknown;
      icon?: unknown;
      isDefault?: unknown;
      sortOrder?: unknown;
    };

    const id = safeText(definition.id, "", 48);
    if (!isTypeId(id)) {
      continue;
    }

    byId.set(id, {
      id,
      name: safeText(definition.name, id, 40),
      description: safeText(definition.description, "", 200),
      color: normalizeColor(definition.color, byId.get(id)?.color ?? "#2c7a6f"),
      icon: safeText(definition.icon, "circle", 32),
      isDefault: definition.isDefault === true || definition.isDefault === 1 || byId.get(id)?.isDefault === true,
      sortOrder:
        typeof definition.sortOrder === "number" && Number.isFinite(definition.sortOrder)
          ? definition.sortOrder
          : byId.get(id)?.sortOrder ?? byId.size * 10,
    });
  }

  return Array.from(byId.values()).sort((left, right) => left.sortOrder - right.sortOrder);
}

export function normalizeColor(value: unknown, fallback: string): string {
  if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)) {
    return value.toLowerCase();
  }

  return fallback;
}

export function normalizeGraph(input: unknown, options: NormalizeOptions = {}): RoadmapGraph {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid graph input.");
  }

  const candidate = input as { nodes?: unknown; edges?: unknown; nodeTypes?: unknown; edgeTypes?: unknown };
  if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) {
    throw new Error("Graph input must include nodes and edges arrays.");
  }

  const nodeTypes = normalizeTypeDefinitions(
    candidate.nodeTypes ?? options.nodeTypes,
    options.nodeTypes ?? defaultNodeTypeDefinitions,
  );
  const edgeTypes = normalizeTypeDefinitions(
    candidate.edgeTypes ?? options.edgeTypes,
    options.edgeTypes ?? defaultEdgeTypeDefinitions,
  );
  const nodeTypeIds = new Set(nodeTypes.map((definition) => definition.id));
  const edgeTypeIds = new Set(edgeTypes.map((definition) => definition.id));
  const seenNodeIds = new Set<string>();
  const nodes: GraphNode[] = candidate.nodes.map((rawNode, index) => {
    if (!rawNode || typeof rawNode !== "object") {
      throw new Error(`Node ${index + 1} is invalid.`);
    }

    const node = rawNode as {
      id?: unknown;
      type?: unknown;
      position?: { x?: unknown; y?: unknown };
      data?: {
        title?: unknown;
        description?: unknown;
        status?: unknown;
        metadata?: unknown;
      };
    };

    const id = safeText(node.id, "", 80);
    if (!id) {
      throw new Error(`Node ${index + 1} is missing an id.`);
    }
    if (seenNodeIds.has(id)) {
      throw new Error(`Duplicate node id: ${id}`);
    }
    seenNodeIds.add(id);

    const type = safeText(node.type, "", 48);
    if (!isTypeId(type) || !nodeTypeIds.has(type)) {
      throw new Error(`Unsupported node type: ${String(node.type)}`);
    }

    const x = toFiniteNumber(node.position?.x, index * 260);
    const y = toFiniteNumber(node.position?.y, 120);

    return {
      id,
      type,
      position: { x, y },
      data: {
        title: safeText(node.data?.title, "Untitled", maxNodeTitle),
        description: safeText(node.data?.description, "", maxNodeDescription),
        status: safeText(node.data?.status, "planned", 40),
        metadata: parseMetadata(node.data?.metadata),
      },
    };
  });

  const seenEdgeIds = new Set<string>();
  const edges: GraphEdge[] = candidate.edges.map((rawEdge, index) => {
    if (!rawEdge || typeof rawEdge !== "object") {
      throw new Error(`Edge ${index + 1} is invalid.`);
    }

    const edge = rawEdge as {
      id?: unknown;
      source?: unknown;
      target?: unknown;
      sourceHandle?: unknown;
      targetHandle?: unknown;
      label?: unknown;
      data?: {
        kind?: unknown;
        type?: unknown;
        label?: unknown;
        metadata?: unknown;
      };
    };

    const id = safeText(edge.id, "", 100);
    const source = safeText(edge.source, "", 80);
    const target = safeText(edge.target, "", 80);
    const kind = safeText(edge.data?.kind ?? edge.data?.type, "", 48);

    if (!id) {
      throw new Error(`Edge ${index + 1} is missing an id.`);
    }
    if (seenEdgeIds.has(id)) {
      throw new Error(`Duplicate edge id: ${id}`);
    }
    seenEdgeIds.add(id);
    if (!seenNodeIds.has(source) || !seenNodeIds.has(target)) {
      throw new Error(`Edge ${id} connects a node that does not exist.`);
    }
    if (!isTypeId(kind) || !edgeTypeIds.has(kind)) {
      throw new Error(`Unsupported edge type: ${String(kind)}`);
    }

    const label = safeText(edge.data?.label ?? edge.label, "", maxEdgeLabel);
    const metadata = parseMetadata(edge.data?.metadata);
    const sourceHandle = normalizeHandleId(edge.sourceHandle ?? metadata.sourceHandle);
    const targetHandle = normalizeHandleId(edge.targetHandle ?? metadata.targetHandle);

    if (sourceHandle) {
      metadata.sourceHandle = sourceHandle;
    } else {
      delete metadata.sourceHandle;
    }

    if (targetHandle) {
      metadata.targetHandle = targetHandle;
    } else {
      delete metadata.targetHandle;
    }

    return {
      id,
      source,
      target,
      ...(sourceHandle ? { sourceHandle } : {}),
      ...(targetHandle ? { targetHandle } : {}),
      type: "smoothstep",
      label,
      data: {
        kind,
        label,
        metadata,
      },
    };
  });

  return { nodes, edges, nodeTypes, edgeTypes };
}

export function createEmptyGraph(): RoadmapGraph {
  return {
    nodes: [],
    edges: [],
    nodeTypes: defaultNodeTypeDefinitions,
    edgeTypes: defaultEdgeTypeDefinitions,
  };
}

function toFiniteNumber(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return value;
}

function normalizeHandleId(value: unknown): string | undefined {
  if (typeof value !== "string" || !allowedHandleIds.has(value)) {
    return undefined;
  }

  return value;
}

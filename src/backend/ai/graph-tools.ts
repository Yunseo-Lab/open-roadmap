import { isTypeId, normalizeColor, normalizeGraph, safeText } from "../../shared/graph";
import type {
  GraphEdge,
  GraphNode,
  GraphTypeDefinition,
  JsonRecord,
  RoadmapGraph,
} from "../types";
import type { ArtifactPromptPart } from "./artifact-prompts";

// Dispatches model-requested tools against the in-memory draft graph.
export function applyToolCall(
  graph: RoadmapGraph,
  artifacts: ArtifactPromptPart[],
  toolName: string,
  args: JsonRecord,
): JsonRecord {
  try {
    switch (toolName) {
      case "create_node":
        return createNode(graph, args);
      case "update_node":
        return updateNode(graph, args);
      case "delete_node":
        return deleteNode(graph, args);
      case "create_edge":
        return createEdge(graph, args);
      case "update_edge":
        return updateEdge(graph, args);
      case "delete_edge":
        return deleteEdge(graph, args);
      case "attach_artifact":
        return attachArtifact(graph, artifacts, args);
      case "set_layout":
        return setLayout(graph, args);
      case "create_node_type":
        return createTypeDefinition(graph.nodeTypes, args, "#2c7a6f");
      case "create_edge_type":
        return createTypeDefinition(graph.edgeTypes, args, "#4469a8");
      default:
        return { ok: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Represents selected artifacts as graph nodes and evidence edges.
export function attachArtifact(
  graph: RoadmapGraph,
  artifacts: ArtifactPromptPart[],
  args: JsonRecord,
): JsonRecord {
  const artifactId = requireText(args.artifactId ?? args.artifact_id, "artifactId");
  const targetNodeId = requireText(args.nodeId ?? args.node_id, "nodeId");
  const artifact = artifacts.find((part) => part.artifact.id === artifactId)?.artifact;
  if (!artifact) {
    throw new Error(`Artifact is not selected: ${artifactId}`);
  }
  if (!graph.nodes.some((node) => node.id === targetNodeId)) {
    throw new Error(`Node to attach was not found: ${targetNodeId}`);
  }

  const artifactNodeId = `artifact-${artifactId}`;
  if (!graph.nodes.some((node) => node.id === artifactNodeId)) {
    graph.nodes.push({
      id: artifactNodeId,
      type: "artifact",
      position: {
        x: getNumber(args.x, graph.nodes.length * 240),
        y: getNumber(args.y, 420),
      },
      data: {
        title: artifact.title,
        description: artifact.original_name || artifact.mime_type || "Attached material",
        status: "attached",
        metadata: {
          artifactId,
        },
      },
    });
  }

  const edgeId = `artifact-${artifactId}-evidences-${targetNodeId}`;
  if (!graph.edges.some((edge) => edge.id === edgeId)) {
    graph.edges.push({
      id: edgeId,
      source: artifactNodeId,
      target: targetNodeId,
      type: "smoothstep",
      label: "Evidence",
      data: {
        kind: "evidences",
        label: "Evidence",
        metadata: { artifactId },
      },
    });
  }

  normalizeGraph(graph);
  return { ok: true, artifactNodeId, edgeId };
}

// Invalid model JSON becomes an empty argument object so the tool returns a normal error.
export function parseToolArguments(raw: string): JsonRecord {
  try {
    const parsed: unknown = JSON.parse(raw || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as JsonRecord;
  } catch {
    return {};
  }
}

// Compactly describes available types inside the system prompt.
export function describeTypes(definitions: GraphTypeDefinition[]): string {
  return definitions.map((definition) => `${definition.id}(${definition.name})`).join(", ");
}

// Creates a validated graph node from model-supplied arguments.
function createNode(graph: RoadmapGraph, args: JsonRecord): JsonRecord {
  const id = getText(args.id) || crypto.randomUUID();
  const type = getText(args.type);
  if (!typeExists(graph.nodeTypes, type)) {
    throw new Error("Unsupported node type.");
  }
  if (graph.nodes.some((node) => node.id === id)) {
    throw new Error(`Node already exists: ${id}`);
  }

  const node: GraphNode = {
    id,
    type,
    position: {
      x: getNumber(args.x, graph.nodes.length * 260),
      y: getNumber(args.y, 120),
    },
    data: {
      title: safeText(args.title, "Untitled", 120),
      description: safeText(args.description, "", 2000),
      status: safeText(args.status, "planned", 40),
      metadata: getRecord(args.metadata),
    },
  };
  graph.nodes.push(node);
  normalizeGraph(graph);
  return { ok: true, id };
}

// Updates only fields the model explicitly supplied.
function updateNode(graph: RoadmapGraph, args: JsonRecord): JsonRecord {
  const id = requireText(args.id, "id");
  const node = graph.nodes.find((candidate) => candidate.id === id);
  if (!node) {
    throw new Error(`Node not found: ${id}`);
  }

  const type = getText(args.type);
  if (type) {
    if (!typeExists(graph.nodeTypes, type)) {
      throw new Error("Unsupported node type.");
    }
    node.type = type;
  }

  if (typeof args.title === "string") {
    node.data.title = safeText(args.title, node.data.title, 120);
  }
  if (typeof args.description === "string") {
    node.data.description = safeText(args.description, "", 2000);
  }
  if (typeof args.status === "string") {
    node.data.status = safeText(args.status, "planned", 40);
  }
  if (typeof args.x === "number") {
    node.position.x = args.x;
  }
  if (typeof args.y === "number") {
    node.position.y = args.y;
  }
  if (args.metadata) {
    node.data.metadata = {
      ...node.data.metadata,
      ...getRecord(args.metadata),
    };
  }

  normalizeGraph(graph);
  return { ok: true, id };
}

// Deleting a node also removes edges that would become dangling.
function deleteNode(graph: RoadmapGraph, args: JsonRecord): JsonRecord {
  const id = requireText(args.id, "id");
  graph.nodes = graph.nodes.filter((node) => node.id !== id);
  graph.edges = graph.edges.filter((edge) => edge.source !== id && edge.target !== id);
  normalizeGraph(graph);
  return { ok: true, id };
}

// Creates an edge only after both endpoint nodes and the edge type are valid.
function createEdge(graph: RoadmapGraph, args: JsonRecord): JsonRecord {
  const source = requireText(args.source, "source");
  const target = requireText(args.target, "target");
  const kind = requireEdgeType(graph, args.kind ?? args.type);
  const id = getText(args.id) || `${source}-${kind}-${target}`;

  if (!graph.nodes.some((node) => node.id === source)) {
    throw new Error(`Source node not found: ${source}`);
  }
  if (!graph.nodes.some((node) => node.id === target)) {
    throw new Error(`Target node not found: ${target}`);
  }
  if (graph.edges.some((edge) => edge.id === id)) {
    throw new Error(`Edge already exists: ${id}`);
  }

  const label = safeText(args.label, "", 80);
  graph.edges.push({
    id,
    source,
    target,
    type: "smoothstep",
    label,
    data: {
      kind,
      label,
      metadata: getRecord(args.metadata),
    },
  });
  normalizeGraph(graph);
  return { ok: true, id };
}

// Updates edge metadata while preserving unspecified fields.
function updateEdge(graph: RoadmapGraph, args: JsonRecord): JsonRecord {
  const id = requireText(args.id, "id");
  const edge = graph.edges.find((candidate) => candidate.id === id);
  if (!edge) {
    throw new Error(`Edge not found: ${id}`);
  }

  const kindInput = args.kind ?? args.type;
  if (kindInput) {
    edge.data.kind = requireEdgeType(graph, kindInput);
  }
  if (typeof args.label === "string") {
    edge.label = safeText(args.label, "", 80);
    edge.data.label = edge.label;
  }
  if (args.metadata) {
    edge.data.metadata = {
      ...edge.data.metadata,
      ...getRecord(args.metadata),
    };
  }

  normalizeGraph(graph);
  return { ok: true, id };
}

// Removes a single edge by id.
function deleteEdge(graph: RoadmapGraph, args: JsonRecord): JsonRecord {
  const id = requireText(args.id, "id");
  graph.edges = graph.edges.filter((edge) => edge.id !== id);
  normalizeGraph(graph);
  return { ok: true, id };
}

// Applies a batch of layout positions without requiring every node to be present.
function setLayout(graph: RoadmapGraph, args: JsonRecord): JsonRecord {
  const positions = Array.isArray(args.positions) ? args.positions : [];
  let updated = 0;

  for (const rawPosition of positions) {
    if (!rawPosition || typeof rawPosition !== "object") {
      continue;
    }
    const position = rawPosition as JsonRecord;
    const id = getText(position.id);
    const node = graph.nodes.find((candidate) => candidate.id === id);
    if (!node) {
      continue;
    }
    node.position.x = getNumber(position.x, node.position.x);
    node.position.y = getNumber(position.y, node.position.y);
    updated += 1;
  }

  normalizeGraph(graph);
  return { ok: true, updated };
}

// Adds a custom type to the draft graph before persistence.
function createTypeDefinition(
  definitions: GraphTypeDefinition[],
  args: JsonRecord,
  fallbackColor: string,
): JsonRecord {
  const name = safeText(args.name, "New type", 40);
  const id = getText(args.id) || slugTypeId(name);
  if (!isTypeId(id)) {
    throw new Error("Type id can only contain lowercase English letters, numbers, hyphens, and underscores.");
  }
  if (definitions.some((definition) => definition.id === id)) {
    return { ok: true, id, reused: true };
  }

  const definition: GraphTypeDefinition = {
    id,
    name,
    description: safeText(args.description, "", 200),
    color: normalizeColor(args.color, fallbackColor),
    icon: safeText(args.icon, "circle", 32),
    isDefault: false,
    sortOrder: (definitions.at(-1)?.sortOrder ?? 0) + 10,
  };
  definitions.push(definition);
  return { ok: true, id };
}

// Small validators keep model-provided data narrow before touching the graph.
function requireText(value: unknown, key: string): string {
  const text = getText(value);
  if (!text) {
    throw new Error(`${key} is required.`);
  }
  return text;
}

function getText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as JsonRecord;
}

function requireEdgeType(graph: RoadmapGraph, value: unknown): string {
  const id = getText(value);
  if (!typeExists(graph.edgeTypes, id)) {
    throw new Error("Unsupported edge type.");
  }
  return id;
}

function typeExists(definitions: GraphTypeDefinition[], id: string): boolean {
  return isTypeId(id) && definitions.some((definition) => definition.id === id);
}

// Produces graph type ids that match the shared type-id validator.
function slugTypeId(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return isTypeId(slug) ? slug : `custom-${crypto.randomUUID().slice(0, 6)}`;
}

import { getArtifactForUser, getGraph, replaceGraph } from "../db/queries";
import { isTypeId, normalizeColor, normalizeGraph, safeText } from "../../shared/graph";
import type {
  AppEnv,
  ArtifactRow,
  GraphEdge,
  GraphNode,
  GraphTypeDefinition,
  JsonRecord,
  RoadmapGraph,
} from "../types";

export type AgentResult = {
  graph: RoadmapGraph;
  summary: string;
  operations: AgentOperation[];
  model: string;
};

export type AgentOperation = {
  tool: string;
  args: JsonRecord;
  result: JsonRecord;
};

type OpenRouterMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | OpenRouterContentPart[] | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

type OpenRouterContentPart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "file";
      file: {
        filename: string;
        file_data: string;
      };
    };

type ToolCall = {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
};

export type AgentInput = {
  env: AppEnv;
  db: D1Database;
  userId: string;
  roadmapId: string;
  message: string;
  artifactIds: string[];
};

export async function runRoadmapAgent(input: AgentInput): Promise<AgentResult> {
  const graph = await getGraph(input.db, input.roadmapId);
  const artifacts = await loadArtifacts(input);

  if (!input.env.OPENROUTER_API_KEY) {
    if (input.env.APP_ENV === "production") {
      throw new Error("OPENROUTER_API_KEY is not configured.");
    }

    return persistAgentResult(input.db, input.roadmapId, {
      ...createFallbackGraph(graph, input.message, artifacts),
      model: "local-fallback",
    });
  }

  try {
    const result = await callOpenRouterAgent(input.env, graph, input.message, artifacts);
    return persistAgentResult(input.db, input.roadmapId, result);
  } catch (error) {
    if (input.env.APP_ENV === "production") {
      throw error;
    }

    return persistAgentResult(input.db, input.roadmapId, {
      ...createFallbackGraph(graph, input.message, artifacts),
      model: "local-fallback-after-error",
    });
  }
}

async function persistAgentResult(
  db: D1Database,
  roadmapId: string,
  result: AgentResult,
): Promise<AgentResult> {
  const graph = await replaceGraph(db, roadmapId, result.graph);
  return {
    ...result,
    graph,
  };
}

async function callOpenRouterAgent(
  env: AppEnv,
  startingGraph: RoadmapGraph,
  message: string,
  artifacts: ArtifactPromptPart[],
): Promise<AgentResult> {
  const model = env.OPENROUTER_MODEL || "openai/gpt-4.1-mini";
  const draft: RoadmapGraph = structuredClone(startingGraph);
  const operations: AgentOperation[] = [];
  const userContent = await buildUserContent(message, artifacts);

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content:
        "You are Open Roadmap's roadmap graph generation agent. Build goal-oriented graphs from the user's documents and conversation. " +
        "Modify the graph only through the provided tools. Prefer the default types, but create new node or edge types when the user's thinking structure needs them. " +
        `Current node types: ${describeTypes(startingGraph.nodeTypes)}. ` +
        `Current edge types: ${describeTypes(startingGraph.edgeTypes)}. ` +
        "After tool calls, respond with a one or two sentence summary in English.",
    },
    {
      role: "user",
      content: userContent,
    },
  ];

  for (let iteration = 0; iteration < 8; iteration += 1) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": env.BETTER_AUTH_URL,
        "X-Title": "Open Roadmap",
      },
      body: JSON.stringify({
        model,
        messages,
        tools: roadmapTools,
        tool_choice: "auto",
        parallel_tool_calls: false,
        plugins: [
          {
            id: "file-parser",
            pdf: {
              engine: "cloudflare-ai",
            },
          },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter request failed: ${response.status} ${errorText.slice(0, 300)}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: OpenRouterMessage;
      }>;
    };
    const assistantMessage = payload.choices?.[0]?.message;
    if (!assistantMessage) {
      throw new Error("OpenRouter response did not include an assistant message.");
    }

    messages.push(assistantMessage);
    const toolCalls = assistantMessage.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return {
        graph: normalizeGraph(draft),
        summary:
          typeof assistantMessage.content === "string" && assistantMessage.content.trim()
            ? assistantMessage.content.trim()
            : "Updated the roadmap draft.",
        operations,
        model,
      };
    }

    for (const toolCall of toolCalls) {
      const args = parseToolArguments(toolCall.function.arguments);
      const result = applyToolCall(draft, artifacts, toolCall.function.name, args);
      operations.push({
        tool: toolCall.function.name,
        args,
        result,
      });
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  return {
    graph: normalizeGraph(draft),
    summary: "Reached the tool call limit and saved the current roadmap draft.",
    operations,
    model,
  };
}

type ArtifactPromptPart = {
  artifact: ArtifactRow;
  text?: string;
  file?: OpenRouterContentPart;
};

async function loadArtifacts(input: AgentInput): Promise<ArtifactPromptPart[]> {
  const parts: ArtifactPromptPart[] = [];
  const uniqueIds = Array.from(new Set(input.artifactIds)).slice(0, 6);

  for (const artifactId of uniqueIds) {
    const artifact = await getArtifactForUser(input.db, artifactId, input.userId);
    if (!artifact || artifact.roadmap_id !== input.roadmapId) {
      continue;
    }

    if (artifact.kind === "text" && artifact.text_content) {
      parts.push({
        artifact,
        text: artifact.text_content.slice(0, 12000),
      });
      continue;
    }

    if (artifact.kind !== "file" || !artifact.r2_key) {
      parts.push({ artifact });
      continue;
    }

    const object = await input.env.FILES.get(artifact.r2_key);
    if (!object) {
      parts.push({ artifact });
      continue;
    }

    if (isTextMime(artifact.mime_type, artifact.original_name)) {
      const text = await object.text();
      parts.push({
        artifact,
        text: text.slice(0, 12000),
      });
      continue;
    }

    if (artifact.mime_type === "application/pdf") {
      const bytes = await object.arrayBuffer();
      parts.push({
        artifact,
        file: {
          type: "file",
          file: {
            filename: artifact.original_name || `${artifact.id}.pdf`,
            file_data: `data:application/pdf;base64,${arrayBufferToBase64(bytes)}`,
          },
        },
      });
      continue;
    }

    parts.push({ artifact });
  }

  return parts;
}

async function buildUserContent(
  message: string,
  artifacts: ArtifactPromptPart[],
): Promise<OpenRouterContentPart[]> {
  const textParts = artifacts
    .map((part) => {
      if (part.text) {
        return `\n\n[Document: ${part.artifact.title}]\n${part.text}`;
      }
      return `\n\n[Evidence file: ${part.artifact.title}, ${part.artifact.mime_type ?? "unknown"}]`;
    })
    .join("");

  const content: OpenRouterContentPart[] = [
    {
      type: "text",
      text:
        `User request:\n${message}\n\nUse the selected documents and evidence to build a goal-oriented roadmap graph.` +
        textParts,
    },
  ];

  for (const part of artifacts) {
    if (part.file) {
      content.push(part.file);
    }
  }

  return content;
}

function applyToolCall(
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

function deleteNode(graph: RoadmapGraph, args: JsonRecord): JsonRecord {
  const id = requireText(args.id, "id");
  graph.nodes = graph.nodes.filter((node) => node.id !== id);
  graph.edges = graph.edges.filter((edge) => edge.source !== id && edge.target !== id);
  normalizeGraph(graph);
  return { ok: true, id };
}

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

function deleteEdge(graph: RoadmapGraph, args: JsonRecord): JsonRecord {
  const id = requireText(args.id, "id");
  graph.edges = graph.edges.filter((edge) => edge.id !== id);
  normalizeGraph(graph);
  return { ok: true, id };
}

function attachArtifact(
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

function createFallbackGraph(
  startingGraph: RoadmapGraph,
  message: string,
  artifacts: ArtifactPromptPart[],
): Omit<AgentResult, "model"> {
  const graph = structuredClone(startingGraph);
  const operations: AgentOperation[] = [];

  if (graph.nodes.length === 0) {
    const objectiveId = "objective-main";
    const milestoneId = "milestone-first";
    const eventId = "event-log";
    graph.nodes.push(
      {
        id: objectiveId,
        type: "objective",
        position: { x: 80, y: 140 },
        data: {
          title: safeText(message, "My core goal", 72),
          description: "This first objective was created from the AI conversation. Edit it with the details you need.",
          status: "active",
          metadata: {},
        },
      },
      {
        id: milestoneId,
        type: "milestone",
        position: { x: 420, y: 80 },
        data: {
          title: "Plan the first milestone",
          description: "Clarify the key steps needed to reach the objective.",
          status: "planned",
          metadata: {},
        },
      },
      {
        id: eventId,
        type: "event",
        position: { x: 420, y: 260 },
        data: {
          title: "Log progress",
          description: "Track completed work, lessons learned, and outputs as events.",
          status: "planned",
          metadata: {},
        },
      },
    );
    graph.edges.push(
      {
        id: "milestone-first-supports-objective-main",
        source: milestoneId,
        target: objectiveId,
        type: "smoothstep",
        label: "Supports",
        data: { kind: "supports", label: "Supports", metadata: {} },
      },
      {
        id: "event-log-next-milestone-first",
        source: eventId,
        target: milestoneId,
        type: "smoothstep",
        label: "Progress",
        data: { kind: "next", label: "Progress", metadata: {} },
      },
    );
    operations.push({
      tool: "local_fallback_seed",
      args: { message },
      result: { ok: true, nodes: 3, edges: 2 },
    });
  }

  for (const part of artifacts.slice(0, 3)) {
    const targetNode = graph.nodes.find((node) => node.type === "event") ?? graph.nodes[0];
    if (!targetNode) {
      continue;
    }
    attachArtifact(graph, artifacts, {
      artifactId: part.artifact.id,
      nodeId: targetNode.id,
      x: 760,
      y: 120 + operations.length * 150,
    });
  }

  return {
    graph: normalizeGraph(graph),
    summary: "Created a roadmap draft with the development fallback. Configure an OpenRouter key to let the agent build the graph through tool calls.",
    operations,
  };
}

function parseToolArguments(raw: string): JsonRecord {
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

function describeTypes(definitions: GraphTypeDefinition[]): string {
  return definitions.map((definition) => `${definition.id}(${definition.name})`).join(", ");
}

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

function isTextMime(mimeType: string | null, filename: string | null): boolean {
  if (mimeType === "text/plain" || mimeType === "text/markdown") {
    return true;
  }

  return Boolean(filename?.toLowerCase().match(/\.(txt|md|markdown)$/));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

const nodeToolProperties = {
  id: { type: "string", description: "Stable node id. Use kebab-case." },
  type: { type: "string", description: "A known node type id. Create a custom type first if needed." },
  title: { type: "string" },
  description: { type: "string" },
  status: { type: "string" },
  x: { type: "number" },
  y: { type: "number" },
  metadata: { type: "object", additionalProperties: true },
} satisfies JsonRecord;

const edgeToolProperties = {
  id: { type: "string", description: "Stable edge id." },
  source: { type: "string" },
  target: { type: "string" },
  kind: { type: "string", description: "A known edge type id. Create a custom type first if needed." },
  label: { type: "string" },
  metadata: { type: "object", additionalProperties: true },
} satisfies JsonRecord;

const roadmapTools = [
  {
    type: "function",
    function: {
      name: "create_node_type",
      description: "Create a custom node type when the existing node types do not fit the user's roadmap language.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Stable type id. Use kebab-case." },
          name: { type: "string" },
          description: { type: "string" },
          color: { type: "string", description: "Hex color, for example #2c7a6f." },
          icon: { type: "string" },
        },
        required: ["id", "name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_edge_type",
      description: "Create a custom edge type when the existing edge types do not describe the relationship.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Stable type id. Use kebab-case." },
          name: { type: "string" },
          description: { type: "string" },
          color: { type: "string", description: "Hex color, for example #4469a8." },
          icon: { type: "string" },
        },
        required: ["id", "name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_node",
      description: "Create a roadmap graph node.",
      parameters: {
        type: "object",
        properties: nodeToolProperties,
        required: ["id", "type", "title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_node",
      description: "Update an existing roadmap graph node.",
      parameters: {
        type: "object",
        properties: nodeToolProperties,
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_node",
      description: "Delete a node and any connected edges.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_edge",
      description: "Create an edge between two existing nodes.",
      parameters: {
        type: "object",
        properties: edgeToolProperties,
        required: ["id", "source", "target", "kind"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_edge",
      description: "Update an existing edge.",
      parameters: {
        type: "object",
        properties: edgeToolProperties,
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_edge",
      description: "Delete an edge.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "attach_artifact",
      description: "Attach a selected artifact to an existing node as evidence.",
      parameters: {
        type: "object",
        properties: {
          artifactId: { type: "string" },
          nodeId: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
        },
        required: ["artifactId", "nodeId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_layout",
      description: "Set node positions after creating or updating nodes.",
      parameters: {
        type: "object",
        properties: {
          positions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                x: { type: "number" },
                y: { type: "number" },
              },
              required: ["id", "x", "y"],
            },
          },
        },
        required: ["positions"],
      },
    },
  },
];

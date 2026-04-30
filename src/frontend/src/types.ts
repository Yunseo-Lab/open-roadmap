export type UserProfile = {
  handle: string;
  displayName: string;
  bio: string;
};

export type UpdateProfileInput = UserProfile;

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  profile: UserProfile;
};

export type CreateRoadmapInput = {
  title: string;
  summary: string;
};

export type UpdateRoadmapInput = CreateRoadmapInput;

export type PublishRoadmapInput = {
  publicTitle: string;
  publicSummary: string;
  slug: string;
  artifactIds: string[];
};

export type UpdateArtifactInput = {
  nodeId: string | null;
};

export type Roadmap = {
  id: string;
  title: string;
  summary: string;
  status: "draft" | "published";
  publicTitle: string | null;
  publicSummary: string | null;
  slug: string | null;
  publishedAt: number | null;
  createdAt: number;
  updatedAt: number;
  nodeCount?: number;
};

export type GraphTypeDefinition = {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  isDefault: boolean;
  sortOrder: number;
};

export type RoadmapGraph = {
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: {
      title: string;
      description: string;
      status: string;
      metadata: Record<string, unknown>;
    };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
    type: "smoothstep";
    label?: string;
    data: {
      kind: string;
      label: string;
      metadata: Record<string, unknown>;
    };
  }>;
  nodeTypes: GraphTypeDefinition[];
  edgeTypes: GraphTypeDefinition[];
};

export type SaveRoadmapGraphInput = Pick<RoadmapGraph, "nodes" | "edges"> &
  Partial<Pick<RoadmapGraph, "nodeTypes" | "edgeTypes">>;

export type AgentOperation = {
  id?: string;
  tool: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
  status?: "success" | "error" | "skipped" | "approval_required";
  startedAt?: number | null;
  completedAt?: number | null;
};

export type AgentResponse = {
  summary: string;
  operations: AgentOperation[];
  graph: RoadmapGraph;
  responseType?: "answer" | "graph_update" | "answer_and_graph_update" | "clarification" | "approval_required" | "error";
  committed?: boolean;
  citations?: Record<string, unknown>[];
  riskFlags?: Record<string, unknown>[];
  validationReport?: Record<string, unknown> | null;
  approvalRequest?: Record<string, unknown> | null;
  conversation?: AgentConversation;
};

export type AgentConversation = {
  id: string;
  title: string;
  summary: string;
  createdAt: number;
  updatedAt: number;
};

export type AgentConversationMessage = {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  metadata: Record<string, unknown>;
  createdAt: number;
};

export type Artifact = {
  id: string;
  title: string;
  kind: "file" | "link" | "text";
  mimeType: string | null;
  originalName: string | null;
  size: number;
  url: string | null;
  nodeId: string | null;
  isPublic: boolean;
  createdAt: number;
  fileUrl: string | null;
};

export type PublicProfile = {
  handle: string;
  displayName: string;
  bio: string;
  image: string | null;
};

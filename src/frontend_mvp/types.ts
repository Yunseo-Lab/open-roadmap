export type TypeDefinition = {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  isDefault: boolean;
  sortOrder: number;
};

export type GraphNodeData = {
  title: string;
  description: string;
  status: string;
  metadata: Record<string, unknown>;
  typeId?: string;
  typeName?: string;
  color?: string;
  icon?: string;
};

export type GraphEdgeData = {
  kind: string;
  label: string;
  metadata: Record<string, unknown>;
};

export type RoadmapGraph = {
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: GraphNodeData;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type: "smoothstep";
    label?: string;
    data: GraphEdgeData;
  }>;
  nodeTypes: TypeDefinition[];
  edgeTypes: TypeDefinition[];
};

export type UserProfile = {
  handle: string;
  displayName: string;
  bio: string;
};

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  profile: UserProfile;
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

export type PublicProfile = UserProfile & {
  image: string | null;
};

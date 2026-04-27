export type JsonRecord = Record<string, unknown>;

export type GraphTypeDefinition = {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  isDefault: boolean;
  sortOrder: number;
};

export type GraphNode = {
  id: string;
  type: string;
  position: {
    x: number;
    y: number;
  };
  data: {
    title: string;
    description: string;
    status: string;
    metadata: JsonRecord;
  };
};

export type GraphEdge = {
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
    metadata: JsonRecord;
  };
};

export type RoadmapGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  nodeTypes: GraphTypeDefinition[];
  edgeTypes: GraphTypeDefinition[];
};

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  profile: {
    handle: string;
    displayName: string;
    bio: string;
  };
};

export type RoadmapRow = {
  id: string;
  user_id: string;
  title: string;
  summary: string;
  status: "draft" | "published";
  public_title: string | null;
  public_summary: string | null;
  slug: string | null;
  published_at: number | null;
  created_at: number;
  updated_at: number;
  node_count?: number;
};

export type ArtifactRow = {
  id: string;
  user_id: string;
  roadmap_id: string | null;
  node_id: string | null;
  title: string;
  kind: "file" | "link" | "text";
  mime_type: string | null;
  original_name: string | null;
  size: number;
  r2_key: string | null;
  url: string | null;
  text_content: string | null;
  is_public: number;
  created_at: number;
};

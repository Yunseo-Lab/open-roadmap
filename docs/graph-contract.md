# Open Roadmap Graph Contract

This document is the shared contract for roadmap graphs across the frontend,
backend, database, and AI agents.

## Canonical Files

| File | Responsibility |
| --- | --- |
| `src/shared/types.ts` | Shared `RoadmapGraph`, `GraphNode`, `GraphEdge`, and `GraphTypeDefinition` types. |
| `src/shared/graph.ts` | Defaults, validation, normalization, metadata parsing, graph creation helpers. |
| `src/backend/db/queries.ts` | D1 row conversion, graph loading, graph replacement, graph type persistence. |
| `src/frontend/src/app/graph/types.ts` | React Flow-oriented graph types used by the workspace UI. |
| `src/frontend/src/app/graph/adapter.ts` | Converts between frontend graph state and backend graph input/output. |
| `services/ai/app/schemas.py` | Python service copy of the graph request/response schema. |

`src/shared/graph.ts` is the final validator for graph writes. Frontend and AI
code may be more permissive while editing, but anything persisted must pass
`normalizeGraph`.

## Backend Graph Shape

The backend and AI service use this shape:

```ts
type RoadmapGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  nodeTypes: GraphTypeDefinition[];
  edgeTypes: GraphTypeDefinition[];
};

type GraphNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    title: string;
    description: string;
    status: string;
    metadata: Record<string, unknown>;
  };
};

type GraphEdge = {
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
};
```

The backend graph is intentionally close to React Flow, but text fields are
domain-named (`title` instead of `label`) and extension data is stored in
`metadata`.

## Frontend Workspace Shape

The workspace uses `@xyflow/react`-oriented nodes and edges:

```ts
type GraphNode = {
  id: string;
  type: "objective" | "milestone" | "event" | "artifact";
  position: { x: number; y: number };
  data: {
    label: string;
    description?: string;
    status?: string;
    date?: string;
    attachments?: Array<{ type: string; name: string; url: string }>;
    metadata?: Record<string, unknown>;
  };
};
```

The frontend shape is not the persistence contract. It must pass through
`toApiGraph` before saving.

## Default Type Definitions

Default node types:

| ID | Name | Purpose | Color | Icon |
| --- | --- | --- | --- | --- |
| `objective` | Objective | The key outcome this roadmap is moving toward. | `#2c7a6f` | `target` |
| `milestone` | Milestone | A major step toward the objective. | `#b7791f` | `flag` |
| `event` | Event | Progress updates and reflection records. | `#4469a8` | `calendar` |
| `artifact` | Artifact | Work products and supporting evidence. | `#7a4d93` | `file` |

Default edge types:

| ID | Name | Purpose | Color | Icon |
| --- | --- | --- | --- | --- |
| `supports` | Supports | One item supports another goal or step. | `#2c7a6f` | `arrow-up-right` |
| `depends_on` | Depends on | A prerequisite or dependency relationship. | `#b7791f` | `link` |
| `evidences` | Evidence | A resource proves or supports a goal or event. | `#7a4d93` | `paperclip` |
| `next` | Next | Time or progress order. | `#4469a8` | `arrow-right` |

`ensureDefaultGraphTypes` inserts these definitions per roadmap. Custom types
are stored in `roadmap_node_types` and `roadmap_edge_types`.

## Validation Rules

`normalizeGraph` enforces these rules:

- The graph input must be an object.
- `nodes` and `edges` must both be arrays.
- Node IDs must be present and unique.
- Edge IDs must be present and unique.
- Node type IDs must be valid type IDs and must exist in the graph's node type definitions.
- Edge `data.kind` must be a valid type ID and must exist in the graph's edge type definitions.
- Every edge source and target must reference existing nodes.
- Positions must be finite numbers or they are replaced with deterministic fallbacks.
- Node `title`, `description`, `status`, and edge labels are trimmed and length-limited.
- Metadata must be an object. Arrays, null, and primitives are normalized to `{}`.
- Edge handles are limited to `top`, `right`, `bottom`, and `left`.
- Edge type is normalized to `"smoothstep"`.

Text limits:

| Field | Limit |
| --- | --- |
| Node title | 120 characters |
| Node description | 2000 characters |
| Edge label | 80 characters |
| Type name | 40 characters |
| Type description | 200 characters |

Type IDs must match:

```text
^[a-z0-9][a-z0-9_-]{0,47}$
```

## Persistence Model

D1 tables:

| Table | Role |
| --- | --- |
| `roadmap_nodes` | One row per graph node. Stores `type`, title, description, status, x/y, metadata JSON. |
| `roadmap_edges` | One row per graph edge. Stores `type`, source, target, label, metadata JSON. |
| `roadmap_node_types` | Per-roadmap node type definitions. |
| `roadmap_edge_types` | Per-roadmap edge type definitions. |

Graph saving is whole-graph replacement:

1. Ensure default type definitions exist.
2. Load existing type definitions.
3. Normalize the submitted graph.
4. Read current artifact node attachments.
5. Delete all existing graph edges and nodes for the roadmap.
6. Upsert graph type definitions from the normalized graph.
7. Insert all nodes and edges.
8. Detach artifacts whose node no longer exists.
9. Re-attach artifacts whose node still exists.
10. Update the roadmap `updated_at`.

There are no incremental backend endpoints for individual node or edge changes.

## Metadata Keys In Use

Metadata is the extension point, but a few keys already have meaning:

| Location | Key | Owner | Meaning |
| --- | --- | --- | --- |
| Node metadata | `date` | Frontend adapter | Date shown by milestone and event nodes. |
| Node metadata | `attachments` | Frontend adapter | Legacy inline attachment display data. |
| Node metadata | `artifactId` | AI artifact nodes | Links an AI-created artifact node to an artifact row. |
| Edge metadata | `sourceHandle` | React Flow adapter/backend normalizer | Source handle ID. |
| Edge metadata | `targetHandle` | React Flow adapter/backend normalizer | Target handle ID. |
| Edge metadata | `description` | Frontend edge editor | Human-readable edge description. |
| Edge metadata | `artifactId` | AI `attach_artifact` tool | Artifact evidenced by an edge. |

Before adding metadata keys, document them here and make sure the frontend
adapter preserves them.

## Adapter Rules

`toApiGraph` converts workspace state to backend input:

| Frontend | Backend |
| --- | --- |
| `node.data.label` | `node.data.title` |
| `node.data.description` | `node.data.description` |
| `node.data.status` | `node.data.status` |
| `node.data.date` | `node.data.metadata.date` |
| `node.data.attachments` | `node.data.metadata.attachments` |
| `edge.data.description` | `edge.data.metadata.description` |
| `edge.sourceHandle` | top-level `sourceHandle` and `metadata.sourceHandle` |
| `edge.targetHandle` | top-level `targetHandle` and `metadata.targetHandle` |

`toWorkspaceNode` and `toWorkspaceEdge` restore the editable shape after a load
or save response. This round trip is covered by
`src/frontend/src/app/graph/adapter.test.ts`.

## Edge Handles

The workspace renders four handle IDs on every custom node:

- `top`
- `right`
- `bottom`
- `left`

React Flow connections preserve top-level `sourceHandle` and `targetHandle`.
The adapter also mirrors those values into edge metadata. The backend normalizer
keeps only allowed handle IDs and drops invalid values.

## Artifacts and Graph Nodes

There are two related but different concepts:

1. An artifact row in D1, with optional `roadmap_id` and `node_id`.
2. A graph node of type `artifact`.

The current UI primarily attaches artifact rows to existing nodes through
`artifacts.node_id`. It does not automatically create an `artifact` graph node
for every uploaded file.

The AI `attach_artifact` tool may create an `artifact-*` graph node plus an
`evidences` edge. It also stores the artifact ID in metadata. That is a visual
graph representation in addition to the artifact row.

## Custom Graph Types

Backend support:

- `POST /api/roadmaps/:id/types`
- `createGraphType`
- `normalizeTypeDefinitions`
- Type definitions persisted in `roadmap_node_types` and `roadmap_edge_types`.

AI support:

- Worker-side OpenRouter tools can call `create_node_type` and
  `create_edge_type` on the draft graph.
- The persisted graph replacement upserts those custom type definitions.

Current frontend limitation:

- The workspace creation and editor UI only expose default node and edge types.
- If custom type UI is added, update `NodeType`, `EdgeType`, node rendering,
  editor select controls, minimap colors, and adapter tests.

## Safe Change Process

When changing the graph contract:

1. Update shared TypeScript types in `src/shared/types.ts`.
2. Update validation and defaults in `src/shared/graph.ts`.
3. Update D1 migrations if persistence changes.
4. Update query conversion in `src/backend/db/queries.ts`.
5. Update frontend graph types and `adapter.ts`.
6. Update Python Pydantic schemas if the AI service sends or receives the field.
7. Add or update tests in `src/shared/graph.test.ts` and
   `src/frontend/src/app/graph/adapter.test.ts`.
8. Update this document.

## Examples

Minimal valid backend graph:

```json
{
  "nodes": [
    {
      "id": "objective-main",
      "type": "objective",
      "position": { "x": 80, "y": 140 },
      "data": {
        "title": "Become a senior frontend engineer",
        "description": "Build evidence toward a senior role.",
        "status": "active",
        "metadata": {}
      }
    }
  ],
  "edges": [],
  "nodeTypes": [],
  "edgeTypes": []
}
```

Edge with handles and description:

```json
{
  "id": "milestone-supports-objective",
  "source": "milestone-first",
  "target": "objective-main",
  "sourceHandle": "right",
  "targetHandle": "left",
  "type": "smoothstep",
  "label": "Supports",
  "data": {
    "kind": "supports",
    "label": "Supports",
    "metadata": {
      "sourceHandle": "right",
      "targetHandle": "left",
      "description": "This milestone moves the objective forward."
    }
  }
}
```

## Current Test Coverage

`src/shared/graph.test.ts` covers:

- Accepted default node and edge types.
- Rejection of invalid node types.
- Rejection of dangling edges.
- Preservation of edge handle IDs.

`src/frontend/src/app/graph/adapter.test.ts` covers:

- Frontend-to-backend-to-frontend field preservation.
- Legacy edge label restoration.

Expand these tests whenever adding metadata, node types, edge types, or
normalization behavior.


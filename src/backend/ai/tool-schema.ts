import type { JsonRecord } from "../types";

// Shared JSON-schema fragments for the model's graph-editing tools.
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

// Tool definitions are the contract between model output and graph-tools.ts.
export const roadmapTools = [
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

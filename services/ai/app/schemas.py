from typing import Any, Literal

from pydantic import BaseModel, Field


class TypeDefinition(BaseModel):
    id: str
    name: str
    description: str = ""
    color: str = "#2c7a6f"
    icon: str = "circle"
    isDefault: bool = False
    sortOrder: int = 0


class NodeData(BaseModel):
    title: str
    description: str = ""
    status: str = "planned"
    metadata: dict[str, Any] = Field(default_factory=dict)


class GraphNode(BaseModel):
    id: str
    type: str
    position: dict[str, float]
    data: NodeData


class EdgeData(BaseModel):
    kind: str
    label: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    type: Literal["smoothstep"] = "smoothstep"
    label: str = ""
    data: EdgeData


class RoadmapGraph(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    nodeTypes: list[TypeDefinition]
    edgeTypes: list[TypeDefinition]


class ArtifactSummary(BaseModel):
    id: str
    title: str
    kind: str
    mimeType: str | None = None
    originalName: str | None = None
    size: int = 0
    url: str | None = None
    nodeId: str | None = None
    isPublic: bool = False
    createdAt: int
    fileUrl: str | None = None


class RoadmapAgentRequest(BaseModel):
    userId: str
    roadmapId: str
    message: str
    artifactIds: list[str] = Field(default_factory=list)
    artifacts: list[ArtifactSummary] = Field(default_factory=list)
    graph: RoadmapGraph


class AgentOperation(BaseModel):
    tool: str
    args: dict[str, Any] = Field(default_factory=dict)
    result: dict[str, Any] = Field(default_factory=dict)


class RoadmapAgentResponse(BaseModel):
    graph: RoadmapGraph
    summary: str
    operations: list[AgentOperation] = Field(default_factory=list)
    model: str = "python-ai-service"

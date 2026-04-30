from typing import Any, Literal
from uuid import uuid4

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


class ChatHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    createdAt: int | None = None


class RoadmapAgentRequest(BaseModel):
    userId: str
    roadmapId: str
    conversationId: str | None = None
    message: str
    history: list[ChatHistoryMessage] = Field(default_factory=list)
    conversationSummary: str | None = None
    artifactIds: list[str] = Field(default_factory=list)
    artifacts: list[ArtifactSummary] = Field(default_factory=list)
    graph: RoadmapGraph


class AgentOperation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    tool: str
    args: dict[str, Any] = Field(default_factory=dict)
    result: dict[str, Any] = Field(default_factory=dict)
    status: Literal["success", "error", "skipped", "approval_required"] = "success"
    startedAt: int | None = None
    completedAt: int | None = None


class GraphCitation(BaseModel):
    kind: Literal["node", "edge", "artifact", "subgraph"]
    id: str
    title: str | None = None
    relevance: str
    confidence: float = Field(default=1.0, ge=0, le=1)


class RiskFlag(BaseModel):
    code: str
    message: str
    severity: Literal["low", "medium", "high"] = "medium"


class ValidationReport(BaseModel):
    ok: bool
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class ApprovalRequest(BaseModel):
    reason: str
    summary: str
    operations: list[AgentOperation] = Field(default_factory=list)


class RoadmapAgentResponse(BaseModel):
    graph: RoadmapGraph
    summary: str
    operations: list[AgentOperation] = Field(default_factory=list)
    model: str = "python-ai-service"
    responseType: Literal[
        "answer",
        "graph_update",
        "answer_and_graph_update",
        "clarification",
        "approval_required",
        "error",
    ] = "graph_update"
    committed: bool = True
    citations: list[GraphCitation] = Field(default_factory=list)
    riskFlags: list[RiskFlag] = Field(default_factory=list)
    validationReport: ValidationReport | None = None
    approvalRequest: ApprovalRequest | None = None

import re
import time
from collections.abc import Callable
from uuid import uuid4

from ..schemas import (
    AgentOperation,
    EdgeData,
    GraphCitation,
    GraphEdge,
    GraphNode,
    RoadmapAgentRequest,
    RoadmapGraph,
    ValidationReport,
)
from .retrieval import graph_overview, search_graph as search_graph_data
from .validation import validate_graph as validate_graph_contract


class GraphToolRuntime:
    def __init__(self, request: RoadmapAgentRequest, on_operation: Callable[[AgentOperation], None] | None = None) -> None:
        self.request = request
        self.current_graph = request.graph.model_copy(deep=True)
        self.draft_graph: RoadmapGraph | None = None
        self.committed_candidate: RoadmapGraph | None = None
        self.operations: list[AgentOperation] = []
        self.citations: list[GraphCitation] = []
        self.validation_report: ValidationReport | None = None
        self.on_operation = on_operation

    @property
    def active_graph(self) -> RoadmapGraph:
        return self.draft_graph or self.current_graph

    def read_graph(self) -> dict[str, object]:
        result = {"ok": True, "graph": graph_overview(self.active_graph), "hasDraft": self.draft_graph is not None}
        self._record("read_graph", {}, result)
        return result

    def search_graph(self, query: str, node_type: str | None = None, limit: int = 5) -> dict[str, object]:
        result = {"ok": True, "matches": search_graph_data(self.active_graph, query, node_type, limit)}
        self._add_citations(result["matches"])
        self._record("search_graph", {"query": query, "node_type": node_type, "limit": limit}, result)
        return result

    def create_graph_draft(self, objective: str | None = None) -> dict[str, object]:
        objective_title = _clean_text(objective or self.request.message, "Core objective", 120)
        graph = self.current_graph.model_copy(deep=True)

        if graph.nodes:
            self.draft_graph = graph
            result = {
                "ok": True,
                "changed": False,
                "reason": "Draft initialized from existing graph.",
                "nodeCount": len(graph.nodes),
                "edgeCount": len(graph.edges),
            }
            self._record("create_graph_draft", {"objective": objective}, result)
            return result

        objective_id = _unique_id("objective", objective_title, set())
        milestone_id = _unique_id("milestone", "First milestone", {objective_id})
        event_id = _unique_id("event", "Progress log", {objective_id, milestone_id})
        graph.nodes.extend(
            [
                GraphNode(
                    id=objective_id,
                    type="objective",
                    position={"x": 80, "y": 140},
                    data={
                        "title": objective_title,
                        "description": "Primary outcome for this roadmap.",
                        "status": "active",
                        "metadata": {},
                    },
                ),
                GraphNode(
                    id=milestone_id,
                    type="milestone",
                    position={"x": 420, "y": 80},
                    data={
                        "title": "First milestone",
                        "description": "Break the objective into an actionable stage.",
                        "status": "planned",
                        "metadata": {},
                    },
                ),
                GraphNode(
                    id=event_id,
                    type="event",
                    position={"x": 420, "y": 260},
                    data={
                        "title": "Progress log",
                        "description": "Capture work, learning, and supporting artifacts.",
                        "status": "planned",
                        "metadata": {},
                    },
                ),
            ]
        )
        graph.edges.extend(
            [
                _edge(milestone_id, objective_id, "supports"),
                _edge(event_id, milestone_id, "next"),
            ]
        )

        for index, artifact in enumerate(self.request.artifacts[:3]):
            artifact_node_id = _unique_id("artifact", artifact.title, {node.id for node in graph.nodes})
            graph.nodes.append(
                GraphNode(
                    id=artifact_node_id,
                    type="artifact",
                    position={"x": 760, "y": 100 + index * 160},
                    data={
                        "title": artifact.title,
                        "description": artifact.originalName or artifact.mimeType or artifact.kind,
                        "status": "available",
                        "metadata": {"artifactId": artifact.id},
                    },
                )
            )
            graph.edges.append(_edge(artifact_node_id, event_id, "evidences"))

        self.draft_graph = graph
        validation = validate_graph_contract(graph)
        self.validation_report = validation
        result = {
            "ok": validation.ok,
            "changed": True,
            "nodeCount": len(graph.nodes),
            "edgeCount": len(graph.edges),
            "validation": validation.model_dump(),
        }
        self._record("create_graph_draft", {"objective": objective}, result, "success" if validation.ok else "error")
        return result

    def create_node(
        self,
        title: str,
        node_type: str = "milestone",
        description: str = "",
        status: str = "planned",
        node_id: str | None = None,
        x: float | None = None,
        y: float | None = None,
    ) -> dict[str, object]:
        graph = self._ensure_draft()
        existing_ids = {node.id for node in graph.nodes}
        resolved_id = node_id or _unique_id(node_type, title, existing_ids)
        if resolved_id in existing_ids:
            return self._tool_error("create_node", {"node_id": node_id, "title": title}, f"Node already exists: {resolved_id}")
        if node_type not in {definition.id for definition in graph.nodeTypes}:
            return self._tool_error("create_node", {"node_type": node_type}, f"Unsupported node type: {node_type}")

        graph.nodes.append(
            GraphNode(
                id=resolved_id,
                type=node_type,
                position={"x": x if x is not None else len(graph.nodes) * 260, "y": y if y is not None else 120},
                data={
                    "title": _clean_text(title, "Untitled", 120),
                    "description": _clean_text(description, "", 2000),
                    "status": _clean_text(status, "planned", 40),
                    "metadata": {},
                },
            )
        )
        validation = validate_graph_contract(graph)
        self.validation_report = validation
        result = {"ok": validation.ok, "nodeId": resolved_id, "validation": validation.model_dump()}
        self._record("create_node", {"title": title, "node_type": node_type, "node_id": node_id}, result)
        return result

    def create_edge(
        self,
        source: str,
        target: str,
        kind: str = "supports",
        label: str | None = None,
        edge_id: str | None = None,
    ) -> dict[str, object]:
        graph = self._ensure_draft()
        node_ids = {node.id for node in graph.nodes}
        if source not in node_ids or target not in node_ids:
            return self._tool_error("create_edge", {"source": source, "target": target}, "Source or target node is missing.")
        if kind not in {definition.id for definition in graph.edgeTypes}:
            return self._tool_error("create_edge", {"kind": kind}, f"Unsupported edge type: {kind}")

        resolved_id = edge_id or f"{source}-{kind}-{target}"
        if any(edge.id == resolved_id for edge in graph.edges):
            return self._tool_error("create_edge", {"edge_id": resolved_id}, f"Edge already exists: {resolved_id}")
        graph.edges.append(_edge(source, target, kind, label=label, edge_id=resolved_id))
        validation = validate_graph_contract(graph)
        self.validation_report = validation
        result = {"ok": validation.ok, "edgeId": resolved_id, "validation": validation.model_dump()}
        self._record("create_edge", {"source": source, "target": target, "kind": kind}, result)
        return result

    def validate_graph(self) -> dict[str, object]:
        validation = validate_graph_contract(self.active_graph)
        self.validation_report = validation
        result = {"ok": validation.ok, "validation": validation.model_dump()}
        self._record("validate_graph", {}, result, "success" if validation.ok else "error")
        return result

    def commit_graph(self) -> dict[str, object]:
        if self.draft_graph is None:
            result = {"ok": False, "error": "No draft graph exists to commit.", "recoverable": True}
            self._record("commit_graph", {}, result, "error")
            return result

        graph = self.draft_graph
        validation = validate_graph_contract(graph)
        self.validation_report = validation
        if not validation.ok:
            result = {"ok": False, "validation": validation.model_dump()}
            self._record("commit_graph", {}, result, "error")
            return result

        self.committed_candidate = graph.model_copy(deep=True)
        result = {"ok": True, "nodeCount": len(graph.nodes), "edgeCount": len(graph.edges)}
        self._record("commit_graph", {}, result)
        return result

    def final_graph(self) -> RoadmapGraph:
        return (self.committed_candidate or self.current_graph).model_copy(deep=True)

    def _ensure_draft(self) -> RoadmapGraph:
        if self.draft_graph is None:
            self.draft_graph = self.current_graph.model_copy(deep=True)
        return self.draft_graph

    def _add_citations(self, matches: object) -> None:
        if not isinstance(matches, dict):
            return
        for node in matches.get("nodes", []):
            if not isinstance(node, dict) or not isinstance(node.get("id"), str):
                continue
            if any(citation.id == node["id"] and citation.kind == "node" for citation in self.citations):
                continue
            self.citations.append(
                GraphCitation(
                    kind="node",
                    id=node["id"],
                    title=node.get("title") if isinstance(node.get("title"), str) else None,
                    relevance="Matched the user's graph query.",
                    confidence=0.8,
                )
            )

    def _tool_error(self, tool: str, args: dict[str, object], message: str) -> dict[str, object]:
        result = {"ok": False, "error": message, "recoverable": True}
        self._record(tool, args, result, "error")
        return result

    def _record(
        self,
        tool: str,
        args: dict[str, object],
        result: dict[str, object],
        status: str = "success",
    ) -> None:
        now = int(time.time() * 1000)
        operation = AgentOperation(
            tool=tool,
            args=args,
            result=result,
            status=status,  # type: ignore[arg-type]
            startedAt=now,
            completedAt=now,
        )
        self.operations.append(operation)
        if self.on_operation is not None:
            self.on_operation(operation)


def _edge(source: str, target: str, kind: str, label: str | None = None, edge_id: str | None = None) -> GraphEdge:
    edge_label = label or kind
    return GraphEdge(
        id=edge_id or f"{source}-{kind}-{target}",
        source=source,
        target=target,
        label=edge_label,
        data=EdgeData(kind=kind, label=edge_label, metadata={}),
    )


def _unique_id(prefix: str, text: str, existing: set[str]) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:42]
    if not base:
        base = uuid4().hex[:10]
    candidate = f"{prefix}-{base}"
    suffix = 2
    while candidate in existing:
        candidate = f"{prefix}-{base}-{suffix}"
        suffix += 1
    return candidate


def _clean_text(value: str | None, fallback: str, max_length: int) -> str:
    if not value:
        return fallback
    cleaned = value.strip()
    return (cleaned or fallback)[:max_length]

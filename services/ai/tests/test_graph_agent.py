import os
import unittest

from app.graph_agent.graph_tools import GraphToolRuntime
from app.graph_agent.workflow import _agent_recursion_limit, _openrouter_response_text_detail, run_graph_agent
from app.schemas import (
    EdgeData,
    GraphEdge,
    GraphNode,
    RoadmapAgentRequest,
    RoadmapGraph,
    TypeDefinition,
)


class GraphAgentTests(unittest.TestCase):
    def setUp(self) -> None:
        os.environ.pop("OPENROUTER_API_KEY", None)
        os.environ.pop("APP_ENV", None)
        os.environ.pop("ALLOW_DETERMINISTIC_AGENT_FALLBACK", None)
        os.environ.pop("AGENT_RECURSION_LIMIT", None)

    def test_empty_graph_creates_committed_draft(self) -> None:
        response = run_graph_agent(_request("Create a roadmap for backend engineering", _empty_graph()))

        self.assertEqual(response.responseType, "graph_update")
        self.assertTrue(response.committed)
        self.assertGreaterEqual(len(response.graph.nodes), 3)
        self.assertTrue(any(operation.tool == "create_graph_draft" for operation in response.operations))
        self.assertTrue(any(operation.tool == "commit_graph" for operation in response.operations))
        self.assertIsNotNone(response.validationReport)
        self.assertTrue(response.validationReport.ok)

    def test_graph_question_requires_model_backed_agent(self) -> None:
        graph = _seeded_graph()

        with self.assertRaises(RuntimeError):
            run_graph_agent(_request("Explain the roadmap", graph))

    def test_invalid_edge_tool_returns_recoverable_error(self) -> None:
        runtime = GraphToolRuntime(_request("Add an edge", _seeded_graph()))
        result = runtime.create_edge("objective-main", "missing-node", "supports")

        self.assertFalse(result["ok"])
        self.assertTrue(result["recoverable"])
        self.assertEqual(runtime.operations[-1].status, "error")

    def test_commit_without_draft_is_recoverable_error(self) -> None:
        runtime = GraphToolRuntime(_request("Commit the graph", _seeded_graph()))
        result = runtime.commit_graph()

        self.assertFalse(result["ok"])
        self.assertTrue(result["recoverable"])
        self.assertIsNone(runtime.committed_candidate)
        self.assertEqual(runtime.operations[-1].status, "error")

    def test_production_requires_model_backed_agent(self) -> None:
        os.environ["APP_ENV"] = "production"

        with self.assertRaises(RuntimeError):
            run_graph_agent(_request("Create a roadmap", _empty_graph()))

    def test_openrouter_response_detail_uses_safe_raw_message(self) -> None:
        detail = _openrouter_response_text_detail(
            '{"error":{"message":"Provider returned error","metadata":{"raw":"rate limited"}},"user_id":"hidden"}'
        )

        self.assertEqual(detail, "rate limited")

    def test_agent_recursion_limit_defaults_and_clamps(self) -> None:
        self.assertEqual(_agent_recursion_limit(), 48)

        os.environ["AGENT_RECURSION_LIMIT"] = "500"
        self.assertEqual(_agent_recursion_limit(), 200)

        os.environ["AGENT_RECURSION_LIMIT"] = "6"
        self.assertEqual(_agent_recursion_limit(), 12)


def _request(message: str, graph: RoadmapGraph) -> RoadmapAgentRequest:
    return RoadmapAgentRequest(
        userId="user-1",
        roadmapId="roadmap-1",
        message=message,
        artifactIds=[],
        artifacts=[],
        graph=graph,
    )


def _empty_graph() -> RoadmapGraph:
    return RoadmapGraph(nodes=[], edges=[], nodeTypes=_node_types(), edgeTypes=_edge_types())


def _seeded_graph() -> RoadmapGraph:
    graph = _empty_graph()
    graph.nodes.extend(
        [
            GraphNode(
                id="objective-main",
                type="objective",
                position={"x": 0, "y": 0},
                data={
                    "title": "Become a backend engineer",
                    "description": "Build production backend skills.",
                    "status": "active",
                    "metadata": {},
                },
            ),
            GraphNode(
                id="milestone-api",
                type="milestone",
                position={"x": 260, "y": 0},
                data={
                    "title": "API foundations",
                    "description": "Design HTTP APIs and persistence layers.",
                    "status": "planned",
                    "metadata": {},
                },
            ),
        ]
    )
    graph.edges.append(
        GraphEdge(
            id="milestone-api-supports-objective-main",
            source="milestone-api",
            target="objective-main",
            label="supports",
            data=EdgeData(kind="supports", label="supports", metadata={}),
        )
    )
    return graph


def _node_types() -> list[TypeDefinition]:
    return [
        TypeDefinition(
            id="objective",
            name="Objective",
            color="#2c7a6f",
            icon="target",
            isDefault=True,
            sortOrder=10,
        ),
        TypeDefinition(
            id="milestone",
            name="Milestone",
            color="#b7791f",
            icon="flag",
            isDefault=True,
            sortOrder=20,
        ),
        TypeDefinition(
            id="event",
            name="Event",
            color="#4469a8",
            icon="calendar",
            isDefault=True,
            sortOrder=30,
        ),
        TypeDefinition(
            id="artifact",
            name="Artifact",
            color="#7a4d93",
            icon="file",
            isDefault=True,
            sortOrder=40,
        ),
    ]


def _edge_types() -> list[TypeDefinition]:
    return [
        TypeDefinition(id="supports", name="Supports", color="#2c7a6f", icon="arrow-up-right"),
        TypeDefinition(id="depends_on", name="Depends on", color="#b7791f", icon="link"),
        TypeDefinition(id="evidences", name="Evidence", color="#7a4d93", icon="paperclip"),
        TypeDefinition(id="next", name="Next", color="#4469a8", icon="arrow-right"),
    ]


if __name__ == "__main__":
    unittest.main()

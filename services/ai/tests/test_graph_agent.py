import os
import unittest

from app.graph_agent.graph_tools import GraphToolRuntime
from app.graph_agent.workflow import (
    _agent_recursion_limit,
    _agent_messages,
    _openrouter_response_text_detail,
    _response_from_runtime,
    run_graph_agent,
)
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
        self.assertTrue(any(operation.tool == "scaffold_graph_from_objective" for operation in response.operations))
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

    def test_start_graph_draft_copies_existing_graph(self) -> None:
        runtime = GraphToolRuntime(_request("Start from the current graph", _seeded_graph()))
        result = runtime.start_graph_draft()

        self.assertTrue(result["ok"])
        self.assertFalse(result["changed"])
        self.assertEqual(result["nodeCount"], 2)
        self.assertEqual(result["edgeCount"], 1)
        self.assertEqual([node.id for node in runtime.active_graph.nodes], ["objective-main", "milestone-api"])
        self.assertEqual(runtime.operations[-1].tool, "start_graph_draft")

    def test_scaffold_graph_from_objective_creates_new_draft(self) -> None:
        runtime = GraphToolRuntime(_request("Create a roadmap for backend engineering", _seeded_graph()))
        result = runtime.scaffold_graph_from_objective("Backend engineering")

        self.assertTrue(result["ok"])
        self.assertTrue(result["changed"])
        self.assertGreaterEqual(result["nodeCount"], 3)
        self.assertFalse(any(node.id == "objective-main" for node in runtime.active_graph.nodes))
        self.assertEqual(runtime.operations[-1].tool, "scaffold_graph_from_objective")

    def test_delete_node_removes_incident_edges(self) -> None:
        runtime = GraphToolRuntime(_request("Delete the API milestone", _seeded_graph()))
        result = runtime.delete_node("milestone-api")

        self.assertTrue(result["ok"])
        self.assertEqual(result["nodeId"], "milestone-api")
        self.assertEqual(result["deletedEdgeIds"], ["milestone-api-supports-objective-main"])
        self.assertEqual([node.id for node in runtime.active_graph.nodes], ["objective-main"])
        self.assertEqual(runtime.active_graph.edges, [])
        self.assertEqual(runtime.operations[-1].tool, "delete_node")

        commit_result = runtime.commit_graph()
        self.assertTrue(commit_result["ok"])
        self.assertEqual(len(runtime.final_graph().nodes), 1)
        self.assertEqual(len(runtime.final_graph().edges), 0)

    def test_response_auto_commits_valid_uncommitted_draft(self) -> None:
        runtime = GraphToolRuntime(_request("Delete the API milestone", _seeded_graph()))
        runtime.delete_node("milestone-api")

        response = _response_from_runtime(runtime, "Deleted the API milestone.", "test-model")

        self.assertTrue(response.committed)
        self.assertEqual(response.responseType, "graph_update")
        self.assertEqual([node.id for node in response.graph.nodes], ["objective-main"])
        self.assertEqual(response.graph.edges, [])
        self.assertEqual([operation.tool for operation in response.operations], ["delete_node", "validate_graph", "commit_graph"])

    def test_delete_edge_preserves_nodes(self) -> None:
        runtime = GraphToolRuntime(_request("Delete the supporting edge", _seeded_graph()))
        result = runtime.delete_edge("milestone-api-supports-objective-main")

        self.assertTrue(result["ok"])
        self.assertEqual(result["edgeId"], "milestone-api-supports-objective-main")
        self.assertEqual(len(runtime.active_graph.nodes), 2)
        self.assertEqual(runtime.active_graph.edges, [])
        self.assertEqual(runtime.operations[-1].tool, "delete_edge")

    def test_clear_graph_removes_all_nodes_and_edges(self) -> None:
        runtime = GraphToolRuntime(_request("Clear the whole graph", _seeded_graph()))
        result = runtime.clear_graph()

        self.assertTrue(result["ok"])
        self.assertEqual(result["deletedNodeCount"], 2)
        self.assertEqual(result["deletedEdgeCount"], 1)
        self.assertEqual(runtime.active_graph.nodes, [])
        self.assertEqual(runtime.active_graph.edges, [])
        self.assertEqual(runtime.operations[-1].tool, "clear_graph")

        response = _response_from_runtime(runtime, "Cleared the graph.", "test-model")
        self.assertTrue(response.committed)
        self.assertEqual(response.graph.nodes, [])
        self.assertEqual(response.graph.edges, [])

    def test_delete_missing_node_returns_recoverable_error(self) -> None:
        runtime = GraphToolRuntime(_request("Delete a missing node", _seeded_graph()))
        result = runtime.delete_node("missing-node")

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

    def test_agent_messages_include_conversation_context(self) -> None:
        request = RoadmapAgentRequest(
            userId="user-1",
            roadmapId="roadmap-1",
            conversationId="conversation-1",
            conversationSummary="The user is planning backend growth.",
            history=[
                {"role": "user", "content": "Hi", "metadata": {}, "createdAt": 1},
                {"role": "assistant", "content": "Hello, how can I help?", "metadata": {}, "createdAt": 2},
            ],
            message="What did I ask before?",
            artifactIds=[],
            artifacts=[],
            graph=_seeded_graph(),
        )

        self.assertEqual(
            _agent_messages(request),
            [
                {
                    "role": "system",
                    "content": "Conversation summary so far: The user is planning backend growth.",
                },
                {"role": "user", "content": "Hi"},
                {"role": "assistant", "content": "Hello, how can I help?"},
                {"role": "user", "content": "What did I ask before?"},
            ],
        )


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

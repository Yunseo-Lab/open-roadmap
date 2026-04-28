from fastapi.testclient import TestClient

from app.graph_agent.errors import AgentExecutionError
from app.main import app


def test_agent_execution_error_returns_structured_status(monkeypatch) -> None:
    def fail_agent(_request):
        raise AgentExecutionError(
            "OpenRouter model request failed: upstream rate limit",
            status_code=429,
            code="model_rate_limited",
        )

    monkeypatch.setattr("app.main.build_graph_response", fail_agent)
    response = TestClient(app).post("/roadmap-agent/runs", json=_request_body())

    assert response.status_code == 429
    assert response.json() == {
        "detail": {
            "error": {
                "code": "model_rate_limited",
                "message": "OpenRouter model request failed: upstream rate limit",
            }
        }
    }


def _request_body() -> dict:
    return {
        "userId": "user-1",
        "roadmapId": "roadmap-1",
        "message": "Explain this roadmap",
        "artifactIds": [],
        "artifacts": [],
        "graph": {
            "nodes": [],
            "edges": [],
            "nodeTypes": [],
            "edgeTypes": [],
        },
    }

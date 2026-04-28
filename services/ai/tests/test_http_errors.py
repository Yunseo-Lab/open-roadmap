from fastapi.testclient import TestClient

from app.graph_agent.errors import AgentExecutionError
from app.main import app
from app.schemas import RoadmapAgentResponse


def test_agent_execution_error_returns_structured_status(monkeypatch) -> None:
    monkeypatch.delenv("AI_SERVICE_TOKEN", raising=False)
    monkeypatch.delenv("APP_ENV", raising=False)

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


def test_health_does_not_require_agent_service_token(monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("AI_SERVICE_TOKEN", raising=False)

    response = TestClient(app).get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_agent_endpoint_requires_token_in_production(monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("AI_SERVICE_TOKEN", raising=False)

    response = TestClient(app).post("/roadmap-agent/runs", json=_request_body())

    assert response.status_code == 503
    assert response.json() == {
        "error": {
            "code": "service_token_missing",
            "message": "AI_SERVICE_TOKEN is required in production.",
        }
    }


def test_agent_endpoint_rejects_invalid_token(monkeypatch) -> None:
    monkeypatch.setenv("AI_SERVICE_TOKEN", "expected-token")

    response = TestClient(app).post(
        "/roadmap-agent/runs",
        json=_request_body(),
        headers={"Authorization": "Bearer wrong-token"},
    )

    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "unauthorized",
            "message": "Valid bearer token is required.",
        }
    }


def test_agent_endpoint_accepts_valid_token(monkeypatch) -> None:
    monkeypatch.setenv("AI_SERVICE_TOKEN", "expected-token")

    def ok_agent(request):
        return RoadmapAgentResponse(
            graph=request.graph,
            summary="ok",
            operations=[],
            model="test",
            responseType="answer",
            committed=False,
        )

    monkeypatch.setattr("app.main.build_graph_response", ok_agent)
    response = TestClient(app).post(
        "/roadmap-agent/runs",
        json=_request_body(),
        headers={"Authorization": "Bearer expected-token"},
    )

    assert response.status_code == 200
    assert response.json()["summary"] == "ok"


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

import os
import secrets

from fastapi import FastAPI, HTTPException
from fastapi import Request
from fastapi.responses import JSONResponse, StreamingResponse

from .agent import build_graph_response
from .graph_agent.errors import AgentExecutionError
from .graph_agent.streaming import stream_graph_agent_events
from .schemas import RoadmapAgentRequest, RoadmapAgentResponse

app = FastAPI(title="Open Roadmap AI Service")


@app.middleware("http")
async def require_agent_service_token(request: Request, call_next):
    if not request.url.path.startswith("/roadmap-agent/"):
        return await call_next(request)

    expected_token = os.getenv("AI_SERVICE_TOKEN", "").strip()
    if not expected_token:
        if os.getenv("APP_ENV") == "production":
            return JSONResponse(
                status_code=503,
                content={
                    "error": {
                        "code": "service_token_missing",
                        "message": "AI_SERVICE_TOKEN is required in production.",
                    }
                },
            )
        return await call_next(request)

    authorization = request.headers.get("authorization", "")
    scheme, _, provided_token = authorization.partition(" ")
    token_is_valid = scheme.lower() == "bearer" and secrets.compare_digest(
        provided_token,
        expected_token,
    )
    if not token_is_valid:
        return JSONResponse(
            status_code=401,
            content={
                "error": {
                    "code": "unauthorized",
                    "message": "Valid bearer token is required.",
                }
            },
        )

    return await call_next(request)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/roadmap-agent/runs", response_model=RoadmapAgentResponse)
def run_roadmap_agent(request: RoadmapAgentRequest) -> RoadmapAgentResponse:
    try:
        return build_graph_response(request)
    except AgentExecutionError as error:
        raise HTTPException(
            status_code=error.status_code,
            detail={"error": {"code": error.code, "message": error.message}},
        ) from error


@app.post("/roadmap-agent/runs/stream")
def stream_roadmap_agent(request: RoadmapAgentRequest) -> StreamingResponse:
    return StreamingResponse(
        stream_graph_agent_events(request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

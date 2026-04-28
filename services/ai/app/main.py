from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse

from .agent import build_graph_response
from .graph_agent.errors import AgentExecutionError
from .graph_agent.streaming import stream_graph_agent_events
from .schemas import RoadmapAgentRequest, RoadmapAgentResponse

app = FastAPI(title="Open Roadmap AI Service")


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

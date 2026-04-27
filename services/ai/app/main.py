from fastapi import FastAPI

from .agent import build_graph_response
from .schemas import RoadmapAgentRequest, RoadmapAgentResponse

app = FastAPI(title="Loadmap AI Service")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/roadmap-agent/runs", response_model=RoadmapAgentResponse)
def run_roadmap_agent(request: RoadmapAgentRequest) -> RoadmapAgentResponse:
    return build_graph_response(request)

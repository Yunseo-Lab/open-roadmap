from .graph_agent import run_graph_agent
from .schemas import RoadmapAgentRequest, RoadmapAgentResponse


def build_graph_response(request: RoadmapAgentRequest) -> RoadmapAgentResponse:
    return run_graph_agent(request)

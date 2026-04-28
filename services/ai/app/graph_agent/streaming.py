import json
from collections.abc import Iterator
from queue import Queue
from threading import Thread
from typing import Any

from ..schemas import AgentOperation, RoadmapAgentRequest
from .errors import AgentExecutionError
from .workflow import run_graph_agent


def stream_graph_agent_events(request: RoadmapAgentRequest) -> Iterator[str]:
    events: Queue[tuple[str, dict[str, Any]]] = Queue()

    def emit(event: str, payload: dict[str, Any]) -> None:
        events.put((event, payload))

    def on_operation(operation: AgentOperation) -> None:
        emit("operation", {"operation": operation.model_dump(mode="json")})

    def run() -> None:
        try:
            emit("status", {"message": "Agent run started."})
            response = run_graph_agent(request, on_operation=on_operation)
            emit("final", response.model_dump(mode="json"))
        except AgentExecutionError as error:
            emit(
                "error",
                {
                    "code": error.code,
                    "message": error.message,
                    "statusCode": error.status_code,
                },
            )
        except Exception as error:
            emit(
                "error",
                {
                    "code": "agent_error",
                    "message": str(error),
                    "statusCode": 500,
                },
            )
        finally:
            emit("done", {})

    Thread(target=run, daemon=True).start()

    while True:
        event, payload = events.get()
        yield _sse(event, payload)
        if event == "done":
            break


def _sse(event: str, payload: dict[str, Any]) -> str:
    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    return f"event: {event}\ndata: {data}\n\n"

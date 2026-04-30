from collections.abc import Callable
import json
import os
from typing import Any

from ..schemas import AgentOperation, RoadmapAgentRequest, RoadmapAgentResponse
from .errors import AgentExecutionError
from .graph_tools import GraphToolRuntime
from .models import create_openrouter_model
from .prompts import SYSTEM_PROMPT
from .tools import build_graph_tools


def run_graph_agent(
    request: RoadmapAgentRequest,
    on_operation: Callable[[AgentOperation], None] | None = None,
) -> RoadmapAgentResponse:
    runtime = GraphToolRuntime(request, on_operation=on_operation)
    model = create_openrouter_model()

    if model is not None:
        return _run_langchain_agent(runtime, model)

    if not _deterministic_fallback_allowed():
        raise AgentExecutionError(
            "Model-backed graph agent is unavailable and deterministic fallback is disabled.",
            status_code=503,
            code="model_unavailable",
        )

    return _run_deterministic_agent(runtime)


def _run_langchain_agent(runtime: GraphToolRuntime, model: Any) -> RoadmapAgentResponse | None:
    try:
        from langchain.agents import create_agent
        tools = build_graph_tools(runtime)
    except ImportError as error:
        raise AgentExecutionError(
            "LangChain agent dependencies are not installed.",
            status_code=500,
            code="agent_dependency_missing",
        ) from error

    agent = create_agent(model=model, tools=tools, system_prompt=SYSTEM_PROMPT)
    try:
        result = agent.invoke(
            {"messages": _agent_messages(runtime.request)},
            config={"recursion_limit": _agent_recursion_limit()},
        )
    except Exception as error:
        message = _model_error_message(error)
        runtime.operations.append(_agent_error_operation(message))
        raise AgentExecutionError(message, status_code=_model_error_status(error), code=_model_error_code(error)) from error

    summary = _last_message_text(result) or "Processed the roadmap request."
    return _response_from_runtime(runtime, summary=summary, model_name="python-langchain-openrouter")


def _agent_messages(request: RoadmapAgentRequest) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = []
    if request.conversationSummary and request.conversationSummary.strip():
        messages.append(
            {
                "role": "system",
                "content": f"Conversation summary so far: {request.conversationSummary.strip()}",
            }
        )

    for item in request.history:
        content = item.content.strip()
        if content:
            messages.append({"role": item.role, "content": content})

    messages.append({"role": "user", "content": request.message})
    return messages


def _run_deterministic_agent(runtime: GraphToolRuntime) -> RoadmapAgentResponse:
    message = runtime.request.message.lower()
    runtime.read_graph()

    wants_change = not runtime.current_graph.nodes or any(
        keyword in message
        for keyword in [
            "create",
            "draw",
            "build",
            "make",
            "add",
            "update",
            "generate",
            "그려",
            "만들",
            "추가",
            "수정",
            "생성",
        ]
    )

    if not wants_change:
        raise AgentExecutionError(
            "A model-backed agent is required to answer questions about the graph.",
            status_code=503,
            code="model_required",
        )

    runtime.scaffold_graph_from_objective(runtime.request.message)
    runtime.validate_graph()
    runtime.commit_graph()
    summary = "Created a committed roadmap graph draft."
    return _response_from_runtime(runtime, summary=summary, model_name="python-graph-tools-deterministic")


def _response_from_runtime(runtime: GraphToolRuntime, summary: str, model_name: str) -> RoadmapAgentResponse:
    _commit_valid_uncommitted_draft(runtime)
    committed = runtime.committed_candidate is not None
    changed = committed and runtime.committed_candidate != runtime.current_graph
    response_type = "graph_update" if changed else "answer"
    return RoadmapAgentResponse(
        graph=runtime.final_graph(),
        summary=summary,
        operations=runtime.operations,
        model=model_name,
        responseType=response_type,
        committed=committed,
        citations=runtime.citations,
        validationReport=runtime.validation_report,
    )


def _commit_valid_uncommitted_draft(runtime: GraphToolRuntime) -> None:
    if runtime.committed_candidate is not None or runtime.draft_graph is None:
        return
    if runtime.draft_graph == runtime.current_graph:
        return

    validation_result = runtime.validate_graph()
    if validation_result.get("ok") is True:
        runtime.commit_graph()


def _last_message_text(result: object) -> str:
    if not isinstance(result, dict):
        return ""
    messages = result.get("messages")
    if not isinstance(messages, list) or not messages:
        return ""
    last = messages[-1]
    content = getattr(last, "content", None)
    if isinstance(content, str):
        return content.strip()
    if isinstance(last, dict) and isinstance(last.get("content"), str):
        return last["content"].strip()
    return ""


def _agent_error_operation(message: str) -> AgentOperation:
    return AgentOperation(tool="agent_loop", result={"ok": False, "error": message}, status="error")


def _model_error_message(error: Exception) -> str:
    detail = _openrouter_error_detail(error)
    if detail:
        return f"OpenRouter model request failed: {detail}"
    return f"OpenRouter model request failed: {error.__class__.__name__}"


def _openrouter_error_detail(error: Exception) -> str:
    body = getattr(error, "body", None)
    if isinstance(body, dict):
        error_body = body.get("error")
        if isinstance(error_body, dict):
            metadata = error_body.get("metadata")
            if isinstance(metadata, dict) and isinstance(metadata.get("raw"), str):
                return metadata["raw"]
            if isinstance(error_body.get("message"), str):
                return error_body["message"]

    response = getattr(error, "response", None)
    if response is not None:
        text = getattr(response, "text", None)
        if isinstance(text, str) and text.strip():
            response_detail = _openrouter_response_text_detail(text)
            if response_detail:
                return response_detail
            return text.strip()[:500]

    message = str(error).strip()
    return message[:500]


def _openrouter_response_text_detail(text: str) -> str:
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return ""
    if not isinstance(payload, dict):
        return ""

    error_body = payload.get("error")
    if not isinstance(error_body, dict):
        return ""

    metadata = error_body.get("metadata")
    if isinstance(metadata, dict) and isinstance(metadata.get("raw"), str):
        return metadata["raw"]
    if isinstance(error_body.get("message"), str):
        return error_body["message"]
    return ""


def _model_error_status(error: Exception) -> int:
    status_code = getattr(error, "status_code", None)
    if isinstance(status_code, int) and 400 <= status_code < 600:
        return status_code
    response = getattr(error, "response", None)
    response_status = getattr(response, "status_code", None)
    if isinstance(response_status, int) and 400 <= response_status < 600:
        return response_status
    if error.__class__.__name__ == "RateLimitError":
        return 429
    return 502


def _model_error_code(error: Exception) -> str:
    status_code = _model_error_status(error)
    if status_code == 429:
        return "model_rate_limited"
    return "model_request_failed"


def _agent_recursion_limit() -> int:
    raw_value = os.getenv("AGENT_RECURSION_LIMIT")
    if raw_value is None:
        return 48

    try:
        value = int(raw_value)
    except ValueError:
        return 48

    return min(max(value, 12), 200)


def _deterministic_fallback_allowed() -> bool:
    if os.getenv("ALLOW_DETERMINISTIC_AGENT_FALLBACK") == "true":
        return True
    return os.getenv("APP_ENV") != "production"

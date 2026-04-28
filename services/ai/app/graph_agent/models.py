import os
from typing import Any


def create_openrouter_model() -> Any | None:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        return None

    try:
        from langchain_openai import ChatOpenAI
    except ImportError:
        return None

    headers: dict[str, str] = {}
    referer = os.getenv("OPENROUTER_SITE_URL")
    title = os.getenv("OPENROUTER_APP_TITLE", "Open Roadmap")
    if referer:
        headers["HTTP-Referer"] = referer
    if title:
        headers["X-Title"] = title

    kwargs: dict[str, Any] = {
        "api_key": api_key,
        "base_url": "https://openrouter.ai/api/v1",
        "model": os.getenv("OPENROUTER_MODEL", "openai/gpt-4.1-mini"),
        "temperature": 0.1,
        "timeout": 45,
    }
    if headers:
        kwargs["default_headers"] = headers

    return ChatOpenAI(**kwargs)

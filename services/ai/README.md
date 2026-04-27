# Loadmap AI Service

This is the Python boundary for roadmap generation. The Cloudflare Worker calls this service when `AI_SERVICE_URL` is set.

```bash
cd services/ai
python -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload --port 8000
```

Expected Worker setting:

```bash
AI_SERVICE_URL=http://localhost:8000
```

The current implementation is a contract skeleton. Replace `build_graph_response` with the real OpenRouter/OpenAI agent workflow.

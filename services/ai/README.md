# Open Roadmap AI Service

This is the Python boundary for roadmap generation. The Cloudflare Worker calls this service when `AI_SERVICE_URL` is set.

```bash
cd services/ai
python3.11 -m venv .venv
source .venv/bin/activate
pip install '.[dev]'
cp .env.example .env
uvicorn app.main:app --reload --port 8000 --env-file .env
```

Expected Worker setting:

```bash
AI_SERVICE_URL=http://localhost:8000
```

The current implementation has a graph tool runtime and an optional LangChain
`create_agent` loop. Set `OPENROUTER_API_KEY` to use the model-backed agent; if
it is absent, the service can use deterministic graph tools for local graph
creation tests. That fallback does not answer graph questions and model-call
errors are returned as errors. Set `APP_ENV=production` to disable deterministic
fallback unless `ALLOW_DETERMINISTIC_AGENT_FALLBACK=true` is explicitly
configured.

`AGENT_RECURSION_LIMIT` controls the LangGraph agent loop depth. The default is
48, and values are clamped between 12 and 200.

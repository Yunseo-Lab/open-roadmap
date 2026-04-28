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
AI_SERVICE_TOKEN=<same value as services/ai/.env>
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

## Docker + DuckDNS Deployment

The service can be exposed as a small Docker Compose stack:

- `ai`: FastAPI + Uvicorn application.
- `caddy`: HTTPS reverse proxy for `open-roadmaps.duckdns.org`.

Prepare the service host:

```bash
cd services/ai
cp .env.example .env
```

Fill `.env`:

```dotenv
OPENROUTER_API_KEY=<openrouter-key>
OPENROUTER_MODEL=openai/gpt-4.1-mini
OPENROUTER_SITE_URL=https://open-roadmap.your-worker.workers.dev
OPENROUTER_APP_TITLE=Open Roadmap
AGENT_RECURSION_LIMIT=48
APP_ENV=production
ALLOW_DETERMINISTIC_AGENT_FALLBACK=false
AI_SERVICE_TOKEN=<long-random-shared-token>
AI_SERVICE_DOMAIN=open-roadmaps.duckdns.org
```

DuckDNS must point `open-roadmaps.duckdns.org` to the Docker host's public IP.
The host router or firewall must forward ports `80` and `443` to the machine
running Compose so Caddy can issue and renew HTTPS certificates.

Start the service:

```bash
docker compose up -d --build
docker compose logs -f ai caddy
```

Check it:

```bash
curl https://open-roadmaps.duckdns.org/health
curl -H "Authorization: Bearer <long-random-shared-token>" \
  https://open-roadmaps.duckdns.org/roadmap-agent/runs
```

The second command should return `405 Method Not Allowed` because the endpoint
requires `POST`; that still confirms Caddy is reaching FastAPI and the token is
accepted by the auth middleware.

Configure the Worker:

```bash
npx wrangler secret put AI_SERVICE_TOKEN
```

Then set `AI_SERVICE_URL` to `https://open-roadmaps.duckdns.org` in the
appropriate Wrangler environment vars. `AI_SERVICE_TOKEN` is a secret and should
not be committed to `wrangler.jsonc`.

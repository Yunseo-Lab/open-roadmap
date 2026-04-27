# Loadmap

AI와 함께 로드맵을 만들고, 목표와 이벤트의 증거를 공개 포트폴리오로 발행하는 Cloudflare Workers 기반 v1입니다.

## Structure

```txt
src/
  frontend/        React, React Flow UI, browser API client
  backend/         Cloudflare Worker, Hono routes, D1/R2/Better Auth
  backend/ai/      Worker-side AI adapter boundary
  shared/          Graph validation and shared domain types
services/
  ai/              Python AI service contract skeleton
```

Cloudflare Worker 백엔드는 그대로 Hono/D1/R2를 사용합니다. `AI_SERVICE_URL`이 설정되어 있으면 Worker가 Python AI 서비스의 `/roadmap-agent/runs`로 위임하고, 설정되어 있지 않으면 기존 TypeScript OpenRouter/local fallback Agent를 사용합니다.

## Local setup

```bash
npm install
npm run cf-typegen
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run preview
```

Python AI 서비스를 같이 띄우려면:

```bash
cd services/ai
python -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload --port 8000
```

배포 전에는 실제 D1 database id와 R2 bucket을 `wrangler.jsonc`에 넣고, 아래 값은 secret으로 설정하세요.

```bash
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put OPENROUTER_API_KEY
```

`AI_SERVICE_URL`은 secret이 아니라 환경별 `vars`로 두면 됩니다.

로컬 개발에서는 `APP_ENV=development`일 때 Google OAuth가 없어도 개발용 사용자로 API를 사용할 수 있습니다.

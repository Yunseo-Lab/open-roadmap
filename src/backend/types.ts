export * from "../shared/types";

// Secrets are optional at the type level because local development may omit them.
// Production-only requirements are enforced where each secret is used.
export type AppSecrets = {
  BETTER_AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  OPENROUTER_API_KEY?: string;
  AI_SERVICE_TOKEN?: string;
};

// Plain string values configured in wrangler.jsonc under vars.
type RuntimeVars = {
  APP_ENV: string;
  BETTER_AUTH_URL: string;
  OPENROUTER_MODEL?: string;
  AI_SERVICE_URL?: string;
};

// Service bindings come from Wrangler's generated Env type, keeping code aligned
// with wrangler.jsonc when bindings are renamed or added.
type RuntimeBindings = Pick<Env, "DB" | "FILES" | "ASSETS">;

// Combined environment type used by Hono contexts and backend services.
export type AppEnv = RuntimeBindings & RuntimeVars & AppSecrets;

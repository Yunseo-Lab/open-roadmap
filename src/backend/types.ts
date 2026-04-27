export * from "../shared/types";

export type AppSecrets = {
  BETTER_AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  OPENROUTER_API_KEY?: string;
};

type RuntimeVars = {
  APP_ENV: string;
  BETTER_AUTH_URL: string;
  OPENROUTER_MODEL?: string;
  AI_SERVICE_URL?: string;
};

type AppBindings = {
  DB: D1Database;
  FILES: R2Bucket;
  ASSETS: Fetcher;
};

export type AppEnv = AppBindings & RuntimeVars & AppSecrets;

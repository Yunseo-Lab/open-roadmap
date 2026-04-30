import type { Context } from "hono";
import { getCurrentUser, slugify } from "./auth";
import type { AppEnv, CurrentUser, JsonRecord } from "./types";
import { getArtifactForUser } from "./db/artifacts";
import { getRoadmapForUser } from "./db/roadmaps";

// Hono receives the Cloudflare Worker bindings through this typed context.
export type AppBindings = {
  Bindings: AppEnv;
};

export type AppContext = Context<AppBindings>;

type HttpErrorStatus = 400 | 401 | 404 | 409;
export type ApiErrorStatus = HttpErrorStatus | 403 | 429 | 500 | 502 | 503;

// Route helpers throw this for expected client errors; the app-level error
// handler converts it back into a JSON response without logging it as a 500.
export class HttpError extends Error {
  readonly status: HttpErrorStatus;

  constructor(status: HttpErrorStatus, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function badRequest(message: string): never {
  throw new HttpError(400, message);
}

export function conflict(message: string): never {
  throw new HttpError(409, message);
}

export function unauthorized(message = "Authentication required."): never {
  throw new HttpError(401, message);
}

export function notFound(message = "Not found."): never {
  throw new HttpError(404, message);
}

// Preserves explicit upstream retry/service statuses while treating unknown failures as 500.
export function responseStatusFromError(error: unknown): ApiErrorStatus {
  if (error instanceof HttpError) {
    return error.status;
  }

  if (error && typeof error === "object") {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    if (statusCode === 429 || statusCode === 502 || statusCode === 503) {
      return statusCode;
    }
  }

  return 500;
}

// Use this for endpoints that can work for both signed-in and public visitors.
export async function getOptionalUser(c: AppContext): Promise<CurrentUser | null> {
  return getCurrentUser(c.env, c.req.raw);
}

// Use this for protected endpoints. Authentication failure is handled centrally.
export async function requireUser(c: AppContext): Promise<CurrentUser> {
  const user = await getOptionalUser(c);
  if (!user) {
    unauthorized();
  }

  return user;
}

// Loads a roadmap only when the route id belongs to the current user.
export async function getOwnedRoadmap(c: AppContext, user: CurrentUser) {
  const id = c.req.param("id");
  if (!id) {
    return null;
  }

  return getRoadmapForUser(c.env.DB, id, user.id);
}

// Loads an artifact only when the route id belongs to the current user.
export async function getOwnedArtifact(c: AppContext, user: CurrentUser) {
  const id = c.req.param("id");
  if (!id) {
    return null;
  }

  return getArtifactForUser(c.env.DB, id, user.id);
}

// Parses optional JSON bodies, but rejects malformed or non-object JSON clearly.
export async function readJson(request: Request): Promise<JsonRecord> {
  const body = await request.text();
  if (!body.trim()) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    badRequest("Request body must be valid JSON.");
  }

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as JsonRecord;
  }

  badRequest("Request body must be a JSON object.");
}

// Cleans short user-facing text fields while preserving a caller-provided fallback.
export function cleanText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return (trimmed || fallback).slice(0, maxLength);
}

export function requiredCleanText(value: unknown, message: string, maxLength: number): string {
  const cleaned = cleanText(value, "", maxLength);
  if (!cleaned) {
    badRequest(message);
  }

  return cleaned;
}

export function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

export function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

// Handles are stricter than general text because they appear in public URLs.
export function cleanHandle(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return slugify(value).slice(0, 48);
}

// FormData can include File values; this helper accepts only non-empty text.
export function optionalFormText(value: FormDataEntryValue | null): string | null {
  return optionalString(value) ?? null;
}

import type { Context } from "hono";
import { getCurrentUser, slugify } from "./auth";
import { getArtifactForUser, getRoadmapForUser } from "./db/queries";
import type { AppEnv, CurrentUser, JsonRecord } from "./types";

export type AppBindings = {
  Bindings: AppEnv;
};

export type AppContext = Context<AppBindings>;

export async function requireUser(c: AppContext): Promise<CurrentUser | null> {
  return getCurrentUser(c.env, c.req.raw);
}

export async function getOwnedRoadmap(c: AppContext, user: CurrentUser) {
  const id = c.req.param("id");
  if (!id) {
    return null;
  }

  return getRoadmapForUser(c.env.DB, id, user.id);
}

export async function getOwnedArtifact(c: AppContext, user: CurrentUser) {
  const id = c.req.param("id");
  if (!id) {
    return null;
  }

  return getArtifactForUser(c.env.DB, id, user.id);
}

export async function nodeBelongsToRoadmap(db: D1Database, nodeId: string, roadmapId: string) {
  const node = await db
    .prepare("SELECT id FROM roadmap_nodes WHERE id = ? AND roadmap_id = ?")
    .bind(nodeId, roadmapId)
    .first<{ id: string }>();

  return Boolean(node);
}

export async function readJson(request: Request): Promise<JsonRecord> {
  try {
    const parsed: unknown = await request.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as JsonRecord;
    }
  } catch {
    return {};
  }

  return {};
}

export function unauthorized(c: AppContext) {
  return c.json({ error: "Authentication required." }, 401);
}

export function notFound(c: AppContext) {
  return c.json({ error: "Not found." }, 404);
}

export function cleanText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return (trimmed || fallback).slice(0, maxLength);
}

export function cleanHandle(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return slugify(value).slice(0, 48);
}

export function optionalFormText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

import { getArtifactForUser } from "../db/queries";
import type { AppEnv, ArtifactRow, CurrentUser } from "../types";

const maxUploadSize = 10 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/markdown",
]);

export function validateUploadFile(file: File): string | null {
  if (file.size > maxUploadSize) {
    return "Files must be 10MB or smaller.";
  }

  const mimeType = normalizeMime(file);
  if (!allowedMimeTypes.has(mimeType)) {
    return "Unsupported file type.";
  }

  return null;
}

export async function createFileArtifact(
  env: AppEnv,
  user: CurrentUser,
  input: {
    file: File;
    title: string;
    roadmapId: string | null;
    nodeId: string | null;
  },
) {
  const artifactId = crypto.randomUUID();
  const mimeType = normalizeMime(input.file);
  const safeName = sanitizeFileName(input.file.name || "upload");
  const key = `users/${user.id}/${artifactId}-${safeName}`;

  await env.FILES.put(key, input.file.stream(), {
    httpMetadata: {
      contentType: mimeType,
    },
  });

  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO artifacts
       (id, user_id, roadmap_id, node_id, title, kind, mime_type, original_name, size, r2_key, created_at)
     VALUES (?, ?, ?, ?, ?, 'file', ?, ?, ?, ?, ?)`,
  )
    .bind(
      artifactId,
      user.id,
      input.roadmapId,
      input.nodeId,
      input.title,
      mimeType,
      input.file.name || safeName,
      input.file.size,
      key,
      now,
    )
    .run();

  return getArtifactForUser(env.DB, artifactId, user.id);
}

export async function deleteArtifact(env: AppEnv, artifact: ArtifactRow) {
  await deleteArtifactFile(env, artifact);
  await env.DB.prepare("DELETE FROM artifacts WHERE id = ? AND user_id = ?")
    .bind(artifact.id, artifact.user_id)
    .run();
}

export async function deleteArtifactFilesForRoadmap(
  env: AppEnv,
  roadmapId: string,
  userId: string,
) {
  const artifacts = await env.DB.prepare(
    `SELECT id, r2_key
     FROM artifacts
     WHERE roadmap_id = ? AND user_id = ? AND r2_key IS NOT NULL`,
  )
    .bind(roadmapId, userId)
    .all<Pick<ArtifactRow, "id" | "r2_key">>();

  await Promise.all(
    (artifacts.results ?? [])
      .filter((artifact): artifact is { id: string; r2_key: string } => Boolean(artifact.r2_key))
      .map((artifact) => env.FILES.delete(artifact.r2_key)),
  );
}

async function deleteArtifactFile(env: AppEnv, artifact: ArtifactRow) {
  if (artifact.r2_key) {
    await env.FILES.delete(artifact.r2_key);
  }
}

function normalizeMime(file: File): string {
  if (file.type) {
    if (file.type === "text/x-markdown") {
      return "text/markdown";
    }
    return file.type;
  }

  const name = file.name.toLowerCase();
  if (name.endsWith(".md") || name.endsWith(".markdown")) {
    return "text/markdown";
  }
  if (name.endsWith(".txt")) {
    return "text/plain";
  }
  if (name.endsWith(".pdf")) {
    return "application/pdf";
  }

  return "application/octet-stream";
}

function sanitizeFileName(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "upload";
}

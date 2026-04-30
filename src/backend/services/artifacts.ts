import { getArtifactForUser } from "../db/artifacts";
import { errorDetails, logError } from "../logger";
import type { AppEnv, ArtifactRow, CurrentUser } from "../types";

// Keep uploads bounded because Worker memory and downstream AI parsing are limited.
const maxUploadSize = 10 * 1024 * 1024;
type StoredFileArtifact = Pick<ArtifactRow, "id" | "r2_key">;
type ArtifactFileDeletionContext = {
  artifactId?: string;
  roadmapId?: string;
  userId: string;
};

// Only file types the app knows how to display or pass to the AI service are accepted.
const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/markdown",
]);

// Returns a user-facing validation error, or null when the upload is acceptable.
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

// Stores the bytes in R2 and the searchable/display metadata in D1.
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

  // R2 owns the file body; D1 stores only a key pointing back to this object.
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

// Deletes the D1 row first, then cleans up the external R2 object.
export async function deleteArtifact(env: AppEnv, artifact: ArtifactRow) {
  await env.DB.prepare("DELETE FROM artifacts WHERE id = ? AND user_id = ?")
    .bind(artifact.id, artifact.user_id)
    .run();
  await deleteArtifactFiles(env, artifact.r2_key ? [artifact.r2_key] : [], {
    artifactId: artifact.id,
    userId: artifact.user_id,
  });
}

// Roadmap deletion captures keys before D1 rows are removed.
export async function listArtifactFileKeysForRoadmap(
  db: D1Database,
  roadmapId: string,
  userId: string,
): Promise<string[]> {
  const artifacts = await db.prepare(
    `SELECT id, r2_key
     FROM artifacts
     WHERE roadmap_id = ? AND user_id = ? AND r2_key IS NOT NULL`,
  )
    .bind(roadmapId, userId)
    .all<StoredFileArtifact>();

  const artifactRows: StoredFileArtifact[] = artifacts.results ?? [];
  return artifactRows.flatMap((artifact) => artifact.r2_key ? [artifact.r2_key] : []);
}

// R2 is outside the D1 transaction, so cleanup is best-effort and fully logged.
export async function deleteArtifactFiles(
  env: AppEnv,
  r2Keys: string[],
  context: ArtifactFileDeletionContext,
) {
  if (r2Keys.length === 0) {
    return;
  }

  const results = await Promise.allSettled(r2Keys.map(async (r2Key) => env.FILES.delete(r2Key)));
  const failures = results.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return [];
    }

    return [{
      r2Key: r2Keys[index],
      ...errorDetails(result.reason),
    }];
  });

  if (failures.length > 0) {
    logError("Failed to delete one or more artifact files from R2.", {
      ...context,
      attemptedCount: r2Keys.length,
      failedCount: failures.length,
      failures,
    });
  }
}

// Browser-provided MIME types are preferred, with extension fallback for common text files.
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

// Prevents user-provided names from creating awkward or unsafe R2 object keys.
function sanitizeFileName(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "upload";
}

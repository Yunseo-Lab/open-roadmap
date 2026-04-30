import { getArtifactForUser } from "../db/artifacts";
import type { ArtifactRow } from "../types";
import type { AgentInput } from "./types";

export type OpenRouterContentPart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "file";
      file: {
        filename: string;
        file_data: string;
      };
    };

export type ArtifactPromptPart = {
  artifact: ArtifactRow;
  text?: string;
  file?: OpenRouterContentPart;
};

// Loads only selected, owned artifacts and converts them into prompt-friendly parts.
export async function loadArtifacts(input: AgentInput): Promise<ArtifactPromptPart[]> {
  const parts: ArtifactPromptPart[] = [];
  const uniqueIds = Array.from(new Set(input.artifactIds)).slice(0, 6);

  for (const artifactId of uniqueIds) {
    const artifact = await getArtifactForUser(input.db, artifactId, input.userId);
    if (!artifact || artifact.roadmap_id !== input.roadmapId) {
      continue;
    }

    if (artifact.kind === "text" && artifact.text_content) {
      parts.push({
        artifact,
        text: artifact.text_content.slice(0, 12000),
      });
      continue;
    }

    if (artifact.kind !== "file" || !artifact.r2_key) {
      parts.push({ artifact });
      continue;
    }

    const object = await input.env.FILES.get(artifact.r2_key);
    if (!object) {
      parts.push({ artifact });
      continue;
    }

    if (isTextMime(artifact.mime_type, artifact.original_name)) {
      const text = await object.text();
      parts.push({
        artifact,
        text: text.slice(0, 12000),
      });
      continue;
    }

    if (artifact.mime_type === "application/pdf") {
      const bytes = await object.arrayBuffer();
      parts.push({
        artifact,
        file: {
          type: "file",
          file: {
            filename: artifact.original_name || `${artifact.id}.pdf`,
            file_data: `data:application/pdf;base64,${arrayBufferToBase64(bytes)}`,
          },
        },
      });
      continue;
    }

    parts.push({ artifact });
  }

  return parts;
}

// Combines the chat message with selected artifact text or file references.
export async function buildUserContent(
  message: string,
  artifacts: ArtifactPromptPart[],
): Promise<OpenRouterContentPart[]> {
  const textParts = artifacts
    .map((part) => {
      if (part.text) {
        return `\n\n[Document: ${part.artifact.title}]\n${part.text}`;
      }
      return `\n\n[Evidence file: ${part.artifact.title}, ${part.artifact.mime_type ?? "unknown"}]`;
    })
    .join("");

  const content: OpenRouterContentPart[] = [
    {
      type: "text",
      text:
        `User request:\n${message}\n\nUse the selected documents and evidence to build a goal-oriented roadmap graph.` +
        textParts,
    },
  ];

  for (const part of artifacts) {
    if (part.file) {
      content.push(part.file);
    }
  }

  return content;
}

// Some browsers omit MIME types for text uploads, so filename fallback matters.
function isTextMime(mimeType: string | null, filename: string | null): boolean {
  if (mimeType === "text/plain" || mimeType === "text/markdown") {
    return true;
  }

  return Boolean(filename?.toLowerCase().match(/\.(txt|md|markdown)$/));
}

// Converts small, size-limited PDF uploads into data URLs for OpenRouter.
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

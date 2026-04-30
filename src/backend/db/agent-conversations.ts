import { parseStoredMetadata } from "../../shared/graph";
import type { JsonRecord } from "../types";

export type AgentMessageRole = "user" | "assistant" | "tool";

export type AgentConversationRow = {
  id: string;
  roadmap_id: string;
  user_id: string;
  title: string;
  summary: string | null;
  created_at: number;
  updated_at: number;
};

export type AgentMessageRow = {
  id: string;
  conversation_id: string;
  role: AgentMessageRole;
  content: string;
  metadata: string;
  created_at: number;
};

export type AgentMessage = {
  id: string;
  role: AgentMessageRole;
  content: string;
  metadata: JsonRecord;
  createdAt: number;
};

export type AgentHistoryMessage = Omit<Pick<AgentMessage, "role" | "content" | "metadata" | "createdAt">, "role"> & {
  role: "user" | "assistant";
};

const defaultConversationTitle = "New chat";
const maxConversationSummaryLength = 3000;
const maxSummaryMessageLength = 700;

export async function listAgentConversations(db: D1Database, roadmapId: string, userId: string) {
  const result = await db
    .prepare(
      `SELECT id, roadmap_id, user_id, title, summary, created_at, updated_at
       FROM ai_conversations
       WHERE roadmap_id = ? AND user_id = ?
       ORDER BY updated_at DESC, created_at DESC`,
    )
    .bind(roadmapId, userId)
    .all<AgentConversationRow>();

  return result.results ?? [];
}

export async function createAgentConversation(
  db: D1Database,
  roadmapId: string,
  userId: string,
  title = defaultConversationTitle,
) {
  const now = Date.now();
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO ai_conversations (id, roadmap_id, user_id, title, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, roadmapId, userId, cleanConversationTitle(title), now, now)
    .run();

  const conversation = await getAgentConversationForUser(db, id, roadmapId, userId);
  if (!conversation) {
    throw new Error("Failed to create the AI conversation.");
  }

  return conversation;
}

export async function getAgentConversationForUser(
  db: D1Database,
  conversationId: string,
  roadmapId: string,
  userId: string,
) {
  return db
    .prepare(
      `SELECT id, roadmap_id, user_id, title, summary, created_at, updated_at
       FROM ai_conversations
       WHERE id = ? AND roadmap_id = ? AND user_id = ?`,
    )
    .bind(conversationId, roadmapId, userId)
    .first<AgentConversationRow>();
}

export async function getLatestAgentConversation(db: D1Database, roadmapId: string, userId: string) {
  return db
    .prepare(
      `SELECT id, roadmap_id, user_id, title, summary, created_at, updated_at
       FROM ai_conversations
       WHERE roadmap_id = ? AND user_id = ?
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1`,
    )
    .bind(roadmapId, userId)
    .first<AgentConversationRow>();
}

export async function getOrCreateAgentConversation(
  db: D1Database,
  roadmapId: string,
  userId: string,
  requestedConversationId: string | undefined,
) {
  if (requestedConversationId) {
    return getAgentConversationForUser(db, requestedConversationId, roadmapId, userId);
  }

  return (await getLatestAgentConversation(db, roadmapId, userId)) ?? createAgentConversation(db, roadmapId, userId);
}

export async function listAgentMessages(db: D1Database, conversationId: string): Promise<AgentMessage[]> {
  const result = await db
    .prepare(
      `SELECT id, conversation_id, role, content, metadata, created_at
       FROM ai_messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC, id ASC`,
    )
    .bind(conversationId)
    .all<AgentMessageRow>();

  return (result.results ?? []).map(toAgentMessage);
}

export async function listRecentAgentHistory(
  db: D1Database,
  conversationId: string,
  limit = 20,
): Promise<AgentHistoryMessage[]> {
  const result = await db
    .prepare(
      `SELECT id, conversation_id, role, content, metadata, created_at
       FROM ai_messages
       WHERE conversation_id = ? AND role IN ('user', 'assistant')
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    )
    .bind(conversationId, limit)
    .all<AgentMessageRow>();

  return (result.results ?? []).reverse().map((row) => ({
    role: row.role === "assistant" ? "assistant" : "user",
    content: row.content,
    metadata: parseStoredMetadata(row.metadata),
    createdAt: row.created_at,
  }));
}

export async function recordAgentUserMessage(
  db: D1Database,
  conversation: AgentConversationRow,
  content: string,
  artifactIds: string[],
  shouldRetitle: boolean,
): Promise<AgentConversationRow> {
  const now = Date.now();
  const title = shouldRetitle ? titleFromMessage(content) : conversation.title;
  await db.batch([
    db.prepare(
      `INSERT INTO ai_messages (id, conversation_id, role, content, metadata, created_at)
       VALUES (?, ?, 'user', ?, ?, ?)`,
    ).bind(crypto.randomUUID(), conversation.id, content, JSON.stringify({ artifactIds }), now),
    db.prepare("UPDATE ai_conversations SET title = ?, updated_at = ? WHERE id = ?").bind(title, now, conversation.id),
  ]);

  return {
    ...conversation,
    title,
    updated_at: now,
  };
}

export function toAgentConversationPayload(row: AgentConversationRow) {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function nextConversationSummary(
  currentSummary: string | null,
  userMessage: string,
  assistantMessage: string,
): string {
  const entry = [
    `User: ${compactSummaryText(userMessage)}`,
    `Assistant: ${compactSummaryText(assistantMessage)}`,
  ].join("\n");
  const combined = [currentSummary?.trim(), entry].filter(Boolean).join("\n");

  if (combined.length <= maxConversationSummaryLength) {
    return combined;
  }

  return combined.slice(-maxConversationSummaryLength).replace(/^[^\n]*\n?/, "");
}

function toAgentMessage(row: AgentMessageRow): AgentMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    metadata: parseStoredMetadata(row.metadata),
    createdAt: row.created_at,
  };
}

function cleanConversationTitle(value: string): string {
  const trimmed = value.trim();
  return (trimmed || defaultConversationTitle).slice(0, 80);
}

function titleFromMessage(message: string): string {
  return cleanConversationTitle(message.replace(/\s+/g, " "));
}

function compactSummaryText(value: string): string {
  const compacted = value.replace(/\s+/g, " ").trim();
  if (compacted.length <= maxSummaryMessageLength) {
    return compacted;
  }

  return `${compacted.slice(0, maxSummaryMessageLength - 3)}...`;
}

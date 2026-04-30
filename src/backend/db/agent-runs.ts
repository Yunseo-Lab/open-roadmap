import type { AgentResult } from "../ai/types";
import { nextConversationSummary, type AgentConversationRow } from "./agent-conversations";

// Stores the assistant reply and the operation trace atomically.
export async function recordAgentSuccess(
  db: D1Database,
  conversation: AgentConversationRow,
  roadmapId: string,
  userMessage: string,
  result: AgentResult,
): Promise<AgentConversationRow> {
  const now = Date.now();
  const conversationSummary = nextConversationSummary(conversation.summary, userMessage, result.summary);
  const assistantMetadata = {
    model: result.model,
    operations: result.operations,
    responseType: result.responseType,
    committed: result.committed,
  };

  await db.batch([
    db.prepare(
      `INSERT INTO ai_messages (id, conversation_id, role, content, metadata, created_at)
       VALUES (?, ?, 'assistant', ?, ?, ?)`,
    ).bind(crypto.randomUUID(), conversation.id, result.summary, JSON.stringify(assistantMetadata), now),
    db.prepare(
      `INSERT INTO ai_runs
         (id, conversation_id, roadmap_id, status, model, operations_json, created_at)
       VALUES (?, ?, ?, 'completed', ?, ?, ?)`,
    ).bind(crypto.randomUUID(), conversation.id, roadmapId, result.model, JSON.stringify(result.operations), now),
    db.prepare("UPDATE ai_conversations SET summary = ?, updated_at = ? WHERE id = ?").bind(
      conversationSummary,
      now,
      conversation.id,
    ),
  ]);

  return {
    ...conversation,
    summary: conversationSummary,
    updated_at: now,
  };
}

// Failed runs keep enough detail for history/debug views.
export async function recordAgentFailure(
  db: D1Database,
  conversationId: string,
  roadmapId: string,
  model: string | undefined,
  message: string,
) {
  const now = Date.now();
  const assistantMetadata = {
    model: model || "openai/gpt-4.1-mini",
    responseType: "error",
    error: message,
  };

  await db.batch([
    db.prepare(
      `INSERT INTO ai_messages (id, conversation_id, role, content, metadata, created_at)
       VALUES (?, ?, 'assistant', ?, ?, ?)`,
    ).bind(crypto.randomUUID(), conversationId, message, JSON.stringify(assistantMetadata), now),
    db.prepare(
      `INSERT INTO ai_runs
         (id, conversation_id, roadmap_id, status, model, operations_json, error, created_at)
       VALUES (?, ?, ?, 'failed', ?, '[]', ?, ?)`,
    ).bind(crypto.randomUUID(), conversationId, roadmapId, model || "openai/gpt-4.1-mini", message, now),
    db.prepare("UPDATE ai_conversations SET updated_at = ? WHERE id = ?").bind(now, conversationId),
  ]);
}

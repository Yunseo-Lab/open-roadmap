DROP INDEX IF EXISTS idx_ai_conversations_roadmap_user;

ALTER TABLE ai_conversations ADD COLUMN summary TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_ai_conversations_roadmap_user_updated
ON ai_conversations(roadmap_id, user_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_created
ON ai_messages(conversation_id, created_at);

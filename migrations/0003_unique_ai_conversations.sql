-- Keep one conversation per user/roadmap pair before enforcing the unique index.
UPDATE ai_messages
SET conversation_id = (
  SELECT keeper.id
  FROM ai_conversations AS current
  JOIN ai_conversations AS keeper
    ON keeper.roadmap_id = current.roadmap_id
   AND keeper.user_id = current.user_id
  WHERE current.id = ai_messages.conversation_id
  ORDER BY keeper.created_at ASC, keeper.id ASC
  LIMIT 1
)
WHERE conversation_id IN (
  SELECT duplicate.id
  FROM ai_conversations AS duplicate
  WHERE duplicate.id != (
    SELECT keeper.id
    FROM ai_conversations AS keeper
    WHERE keeper.roadmap_id = duplicate.roadmap_id
      AND keeper.user_id = duplicate.user_id
    ORDER BY keeper.created_at ASC, keeper.id ASC
    LIMIT 1
  )
);

UPDATE ai_runs
SET conversation_id = (
  SELECT keeper.id
  FROM ai_conversations AS current
  JOIN ai_conversations AS keeper
    ON keeper.roadmap_id = current.roadmap_id
   AND keeper.user_id = current.user_id
  WHERE current.id = ai_runs.conversation_id
  ORDER BY keeper.created_at ASC, keeper.id ASC
  LIMIT 1
)
WHERE conversation_id IN (
  SELECT duplicate.id
  FROM ai_conversations AS duplicate
  WHERE duplicate.id != (
    SELECT keeper.id
    FROM ai_conversations AS keeper
    WHERE keeper.roadmap_id = duplicate.roadmap_id
      AND keeper.user_id = duplicate.user_id
    ORDER BY keeper.created_at ASC, keeper.id ASC
    LIMIT 1
  )
);

DELETE FROM ai_conversations
WHERE id IN (
  SELECT duplicate.id
  FROM ai_conversations AS duplicate
  WHERE duplicate.id != (
    SELECT keeper.id
    FROM ai_conversations AS keeper
    WHERE keeper.roadmap_id = duplicate.roadmap_id
      AND keeper.user_id = duplicate.user_id
    ORDER BY keeper.created_at ASC, keeper.id ASC
    LIMIT 1
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_conversations_roadmap_user
ON ai_conversations(roadmap_id, user_id);

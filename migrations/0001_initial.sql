CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  token TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at INTEGER,
  refresh_token_expires_at INTEGER,
  scope TEXT,
  password TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS verifications (
  id TEXT PRIMARY KEY NOT NULL,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY NOT NULL,
  handle TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS roadmaps (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  public_title TEXT,
  public_summary TEXT,
  slug TEXT UNIQUE,
  published_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS roadmap_nodes (
  id TEXT PRIMARY KEY NOT NULL,
  roadmap_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('objective', 'milestone', 'event', 'artifact')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planned',
  x REAL NOT NULL DEFAULT 0,
  y REAL NOT NULL DEFAULT 0,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS roadmap_edges (
  id TEXT PRIMARY KEY NOT NULL,
  roadmap_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('supports', 'depends_on', 'evidences', 'next')),
  source_node_id TEXT NOT NULL,
  target_node_id TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE,
  FOREIGN KEY (source_node_id) REFERENCES roadmap_nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (target_node_id) REFERENCES roadmap_nodes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  roadmap_id TEXT,
  node_id TEXT,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('file', 'link', 'text')),
  mime_type TEXT,
  original_name TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  r2_key TEXT,
  url TEXT,
  text_content TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE,
  FOREIGN KEY (node_id) REFERENCES roadmap_nodes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id TEXT PRIMARY KEY NOT NULL,
  roadmap_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '로드맵 생성 대화',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_runs (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL,
  roadmap_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'failed')),
  model TEXT NOT NULL,
  operations_json TEXT NOT NULL DEFAULT '[]',
  error TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_profiles_handle ON profiles(handle);
CREATE INDEX IF NOT EXISTS idx_roadmaps_user ON roadmaps(user_id);
CREATE INDEX IF NOT EXISTS idx_roadmaps_slug ON roadmaps(slug);
CREATE INDEX IF NOT EXISTS idx_nodes_roadmap ON roadmap_nodes(roadmap_id);
CREATE INDEX IF NOT EXISTS idx_edges_roadmap ON roadmap_edges(roadmap_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_user ON artifacts(user_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_roadmap ON artifacts(roadmap_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_roadmap ON ai_conversations(roadmap_id);

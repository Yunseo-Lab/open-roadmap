PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS roadmaps_new (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  public_title TEXT,
  public_summary TEXT,
  slug TEXT,
  published_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO roadmaps_new (
  id,
  user_id,
  title,
  summary,
  status,
  public_title,
  public_summary,
  slug,
  published_at,
  created_at,
  updated_at
)
SELECT
  id,
  user_id,
  title,
  summary,
  status,
  public_title,
  public_summary,
  slug,
  published_at,
  created_at,
  updated_at
FROM roadmaps;

DROP TABLE roadmaps;
ALTER TABLE roadmaps_new RENAME TO roadmaps;

CREATE INDEX IF NOT EXISTS idx_roadmaps_user ON roadmaps(user_id);
CREATE INDEX IF NOT EXISTS idx_roadmaps_slug ON roadmaps(slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_roadmaps_user_slug
  ON roadmaps(user_id, slug)
  WHERE slug IS NOT NULL;

PRAGMA foreign_keys = ON;

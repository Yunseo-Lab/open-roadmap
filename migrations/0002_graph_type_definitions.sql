CREATE TABLE IF NOT EXISTS roadmap_node_types (
  id TEXT NOT NULL,
  roadmap_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#2c7a6f',
  icon TEXT NOT NULL DEFAULT 'circle',
  is_default INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (id, roadmap_id),
  FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS roadmap_edge_types (
  id TEXT NOT NULL,
  roadmap_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#2c7a6f',
  icon TEXT NOT NULL DEFAULT 'circle',
  is_default INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (id, roadmap_id),
  FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO roadmap_node_types
  (id, roadmap_id, name, description, color, icon, is_default, sort_order, created_at, updated_at)
SELECT 'objective', id, '목표', '로드맵이 향하는 핵심 결과', '#2c7a6f', 'target', 1, 10, created_at, updated_at
FROM roadmaps;

INSERT OR IGNORE INTO roadmap_node_types
  (id, roadmap_id, name, description, color, icon, is_default, sort_order, created_at, updated_at)
SELECT 'milestone', id, '마일스톤', '목표를 향한 주요 단계', '#b7791f', 'flag', 1, 20, created_at, updated_at
FROM roadmaps;

INSERT OR IGNORE INTO roadmap_node_types
  (id, roadmap_id, name, description, color, icon, is_default, sort_order, created_at, updated_at)
SELECT 'event', id, '이벤트', '진행 과정과 회고 기록', '#4469a8', 'calendar', 1, 30, created_at, updated_at
FROM roadmaps;

INSERT OR IGNORE INTO roadmap_node_types
  (id, roadmap_id, name, description, color, icon, is_default, sort_order, created_at, updated_at)
SELECT 'artifact', id, '산출물', '결과물과 증거 자료', '#7a4d93', 'file', 1, 40, created_at, updated_at
FROM roadmaps;

INSERT OR IGNORE INTO roadmap_edge_types
  (id, roadmap_id, name, description, color, icon, is_default, sort_order, created_at, updated_at)
SELECT 'supports', id, '기여', '한 요소가 다른 목표에 기여함', '#2c7a6f', 'arrow-up-right', 1, 10, created_at, updated_at
FROM roadmaps;

INSERT OR IGNORE INTO roadmap_edge_types
  (id, roadmap_id, name, description, color, icon, is_default, sort_order, created_at, updated_at)
SELECT 'depends_on', id, '의존', '선행 조건이나 의존 관계', '#b7791f', 'link', 1, 20, created_at, updated_at
FROM roadmaps;

INSERT OR IGNORE INTO roadmap_edge_types
  (id, roadmap_id, name, description, color, icon, is_default, sort_order, created_at, updated_at)
SELECT 'evidences', id, '증거', '자료가 목표나 이벤트를 증명함', '#7a4d93', 'paperclip', 1, 30, created_at, updated_at
FROM roadmaps;

INSERT OR IGNORE INTO roadmap_edge_types
  (id, roadmap_id, name, description, color, icon, is_default, sort_order, created_at, updated_at)
SELECT 'next', id, '다음', '시간 또는 진행 순서', '#4469a8', 'arrow-right', 1, 40, created_at, updated_at
FROM roadmaps;

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS roadmap_nodes_next (
  id TEXT PRIMARY KEY NOT NULL,
  roadmap_id TEXT NOT NULL,
  type TEXT NOT NULL,
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

INSERT INTO roadmap_nodes_next
  (id, roadmap_id, type, title, description, status, x, y, metadata, created_at, updated_at)
SELECT id, roadmap_id, type, title, description, status, x, y, metadata, created_at, updated_at
FROM roadmap_nodes;

CREATE TABLE IF NOT EXISTS roadmap_edges_next (
  id TEXT PRIMARY KEY NOT NULL,
  roadmap_id TEXT NOT NULL,
  type TEXT NOT NULL,
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

INSERT INTO roadmap_edges_next
  (id, roadmap_id, type, source_node_id, target_node_id, label, metadata, created_at, updated_at)
SELECT id, roadmap_id, type, source_node_id, target_node_id, label, metadata, created_at, updated_at
FROM roadmap_edges;

DROP TABLE roadmap_edges;
DROP TABLE roadmap_nodes;
ALTER TABLE roadmap_nodes_next RENAME TO roadmap_nodes;
ALTER TABLE roadmap_edges_next RENAME TO roadmap_edges;

PRAGMA foreign_keys = ON;

CREATE INDEX IF NOT EXISTS idx_node_types_roadmap ON roadmap_node_types(roadmap_id);
CREATE INDEX IF NOT EXISTS idx_edge_types_roadmap ON roadmap_edge_types(roadmap_id);
CREATE INDEX IF NOT EXISTS idx_nodes_roadmap ON roadmap_nodes(roadmap_id);
CREATE INDEX IF NOT EXISTS idx_edges_roadmap ON roadmap_edges(roadmap_id);

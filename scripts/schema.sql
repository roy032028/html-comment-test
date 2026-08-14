-- 스키마 단일 출처. 전부 멱등(IF NOT EXISTS)이라 여러 번 실행해도 안전하다.
-- 프로덕션(Turso): `npm run db:init`으로 1회 적용.
-- 로컬(file: DB): src/lib/db/index.ts가 기동 시 자동 적용.

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content BLOB NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pins (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  x_percent REAL NOT NULL,
  y_percent REAL NOT NULL,
  selector TEXT,
  offset_x REAL,
  offset_y REAL,
  anchor_text TEXT,
  opener_selector TEXT,
  author_name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  pin_id TEXT NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 파일 목록 조회(project_id로 필터 + created_at 정렬)용 커버링 인덱스.
-- 필요한 컬럼을 전부 담고 있어 무거운 content BLOB 오버플로우 페이지를 건드리지 않는다.
CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id, created_at, filename, id);

-- 파일별 핀 조회/집계용.
CREATE INDEX IF NOT EXISTS idx_pins_file ON pins(file_id);

-- 핀별 댓글 조회용.
CREATE INDEX IF NOT EXISTS idx_comments_pin ON comments(pin_id);

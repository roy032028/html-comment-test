import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import fs from "fs";
import path from "path";
import * as schema from "./schema";

// 로컬 개발: file: URL (SQLite 파일). 프로덕션: Turso(libSQL) URL + 토큰.
const url = process.env.TURSO_DATABASE_URL || "file:data/local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

// 로컬 file: 사용 시 상위 디렉터리 보장
if (url.startsWith("file:")) {
  const filePath = url.slice("file:".length);
  const dir = path.dirname(path.resolve(filePath));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const client = createClient({ url, authToken });

// 스키마 보장 (top-level await → db를 import하는 쪽은 이 초기화가 끝난 뒤 실행됨)
await client.executeMultiple(`
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
`);

export const db = drizzle(client, { schema });

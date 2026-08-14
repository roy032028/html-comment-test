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

// 스키마 DDL은 요청 경로에서 실행하지 않는다.
// 예전에는 여기서 top-level await로 CREATE TABLE + ALTER TABLE을 돌렸는데,
// 서버리스에서는 콜드스타트마다 원격 DB로 직렬 왕복 6회를 지불하는 꼴이었다
// (그것도 `db`를 import하는 모든 함수에서 각각). 그래서 프로덕션은 `npm run db:init`
// 1회 적용으로 옮기고, 여기서는 로컬 파일 DB 편의만 남긴다.
if (url.startsWith("file:")) {
  const sql = fs.readFileSync(
    path.join(process.cwd(), "scripts", "schema.sql"),
    "utf8"
  );
  await client.executeMultiple(sql);
}

export const db = drizzle(client, { schema });

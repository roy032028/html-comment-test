// 스키마/인덱스를 DB에 1회 적용하는 스크립트.
//
//   npm run db:init              # .env.local의 TURSO_* 사용
//
// 런타임(요청 경로)에서 DDL을 실행하지 않기 위해 분리했다. 앱 코드는 이 스크립트가
// 이미 적용됐다고 가정하므로, 새 DB를 붙이거나 스키마를 바꾼 뒤에는 배포 전에 실행할 것.

import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.TURSO_DATABASE_URL || "file:data/local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

console.log(`[db:init] target: ${url}`);

if (url.startsWith("file:")) {
  const dir = path.dirname(path.resolve(url.slice("file:".length)));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const client = createClient({ url, authToken });

const sql = fs.readFileSync(path.join(here, "schema.sql"), "utf8");
await client.executeMultiple(sql);
console.log("[db:init] 테이블/인덱스 적용 완료");

// 앵커 컬럼이 없던 시절의 기존 DB를 위한 1회성 마이그레이션.
// 새 DB는 CREATE TABLE에 이미 포함돼 있으므로 여기서 실패하는 게 정상이다.
for (const stmt of [
  "ALTER TABLE pins ADD COLUMN selector TEXT",
  "ALTER TABLE pins ADD COLUMN offset_x REAL",
  "ALTER TABLE pins ADD COLUMN offset_y REAL",
  "ALTER TABLE pins ADD COLUMN anchor_text TEXT",
  "ALTER TABLE pins ADD COLUMN opener_selector TEXT",
]) {
  try {
    await client.execute(stmt);
    console.log(`[db:init] 적용: ${stmt}`);
  } catch {
    // 컬럼이 이미 있으면 무시
  }
}

client.close();
console.log("[db:init] 완료");

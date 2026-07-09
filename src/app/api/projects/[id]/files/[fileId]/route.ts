import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import zlib from "zlib";
import { db } from "@/lib/db";
import { files, pins, comments } from "@/lib/db/schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { id: projectId, fileId } = await params;

  const file = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .get();

  if (!file || file.projectId !== projectId) {
    return NextResponse.json({ error: "파일을 찾을 수 없습니다" }, { status: 404 });
  }

  // 저장된 바이트가 gzip이면 해제, 아니면(레거시 텍스트) 그대로 반환
  const raw: unknown = file.content;
  let buf: Buffer;
  if (Buffer.isBuffer(raw)) buf = raw;
  else if (typeof raw === "string") buf = Buffer.from(raw, "utf-8");
  else buf = Buffer.from(raw as Uint8Array);
  const isGzip = buf.length > 1 && buf[0] === 0x1f && buf[1] === 0x8b;
  const html = isGzip ? zlib.gunzipSync(buf).toString("utf-8") : buf.toString("utf-8");

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      // fileId별 URL은 불변 → 새로고침 시 브라우저 캐시 재사용(재다운로드 방지)
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { id: projectId, fileId } = await params;

  const file = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .get();

  if (!file || file.projectId !== projectId) {
    return NextResponse.json({ error: "파일을 찾을 수 없습니다" }, { status: 404 });
  }

  // FK cascade에 의존하지 않고 수동으로 핀·댓글까지 정리
  const pinRows = await db
    .select({ id: pins.id })
    .from(pins)
    .where(eq(pins.fileId, fileId))
    .all();

  const pinIds = pinRows.map((p) => p.id);
  if (pinIds.length > 0) {
    await db.delete(comments).where(inArray(comments.pinId, pinIds));
  }
  await db.delete(pins).where(eq(pins.fileId, fileId));
  await db.delete(files).where(eq(files.id, fileId));

  return NextResponse.json({ ok: true });
}

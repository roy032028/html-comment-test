import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { comments } from "@/lib/db/schema";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const { commentId } = await params;
  const { body } = await request.json();

  if (!body?.trim()) {
    return NextResponse.json({ error: "내용이 비어 있습니다" }, { status: 400 });
  }

  const comment = await db
    .select()
    .from(comments)
    .where(eq(comments.id, commentId))
    .get();

  if (!comment) {
    return NextResponse.json({ error: "댓글을 찾을 수 없습니다" }, { status: 404 });
  }

  await db
    .update(comments)
    .set({ body: body.trim() })
    .where(eq(comments.id, commentId));

  return NextResponse.json({ ok: true, body: body.trim() });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const { commentId } = await params;

  const comment = await db
    .select()
    .from(comments)
    .where(eq(comments.id, commentId))
    .get();

  if (!comment) {
    return NextResponse.json({ error: "댓글을 찾을 수 없습니다" }, { status: 404 });
  }

  await db.delete(comments).where(eq(comments.id, commentId));

  return NextResponse.json({ ok: true });
}

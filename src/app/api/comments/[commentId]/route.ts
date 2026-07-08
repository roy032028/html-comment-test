import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { comments } from "@/lib/db/schema";

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

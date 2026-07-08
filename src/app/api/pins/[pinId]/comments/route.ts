import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { pins, comments } from "@/lib/db/schema";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ pinId: string }> }
) {
  const { pinId } = await params;
  const body = await request.json();

  const { authorName, body: commentBody } = body;

  if (!authorName?.trim() || !commentBody?.trim()) {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const pin = await db.select().from(pins).where(eq(pins.id, pinId)).get();

  if (!pin) {
    return NextResponse.json({ error: "핀을 찾을 수 없습니다" }, { status: 404 });
  }

  const commentId = nanoid(12);
  await db.insert(comments).values({
    id: commentId,
    pinId,
    authorName: authorName.trim(),
    body: commentBody.trim(),
  });

  const comment = await db
    .select()
    .from(comments)
    .where(eq(comments.id, commentId))
    .get();

  return NextResponse.json({
    id: comment!.id,
    pinId: comment!.pinId,
    authorName: comment!.authorName,
    body: comment!.body,
    createdAt: comment!.createdAt.toISOString(),
  });
}

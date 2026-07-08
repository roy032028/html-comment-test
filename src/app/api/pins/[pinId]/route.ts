import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pins, comments } from "@/lib/db/schema";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ pinId: string }> }
) {
  const { pinId } = await params;

  const pin = await db.select().from(pins).where(eq(pins.id, pinId)).get();

  if (!pin) {
    return NextResponse.json({ error: "핀을 찾을 수 없습니다" }, { status: 404 });
  }

  await db.delete(comments).where(eq(comments.pinId, pinId));
  await db.delete(pins).where(eq(pins.id, pinId));

  return NextResponse.json({ ok: true });
}

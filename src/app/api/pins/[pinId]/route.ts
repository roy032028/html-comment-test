import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pins, comments } from "@/lib/db/schema";

// 핀 위치/앵커 갱신(드래그 이동)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ pinId: string }> }
) {
  const { pinId } = await params;
  const body = await request.json();

  const pin = await db.select().from(pins).where(eq(pins.id, pinId)).get();
  if (!pin) {
    return NextResponse.json({ error: "핀을 찾을 수 없습니다" }, { status: 404 });
  }

  const set: Record<string, unknown> = {};
  if (typeof body.xPercent === "number") set.xPercent = body.xPercent;
  if (typeof body.yPercent === "number") set.yPercent = body.yPercent;
  if (typeof body.selector === "string" || body.selector === null)
    set.selector = body.selector;
  if (typeof body.offsetX === "number") set.offsetX = body.offsetX;
  if (typeof body.offsetY === "number") set.offsetY = body.offsetY;
  if (typeof body.anchorText === "string" || body.anchorText === null)
    set.anchorText = body.anchorText;
  if (typeof body.openerSelector === "string" || body.openerSelector === null)
    set.openerSelector = body.openerSelector;

  if (Object.keys(set).length > 0) {
    await db.update(pins).set(set).where(eq(pins.id, pinId));
  }

  return NextResponse.json({ ok: true });
}

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

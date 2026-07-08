import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { files, pins } from "@/lib/db/schema";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const body = await request.json();

  const { xPercent, yPercent, authorName, fileId } = body;

  if (
    typeof xPercent !== "number" ||
    typeof yPercent !== "number" ||
    !authorName?.trim() ||
    !fileId
  ) {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const file = await db
    .select()
    .from(files)
    .where(eq(files.id, fileId))
    .get();

  if (!file || file.projectId !== projectId) {
    return NextResponse.json({ error: "파일을 찾을 수 없습니다" }, { status: 404 });
  }

  const pinId = nanoid(12);
  await db.insert(pins).values({
    id: pinId,
    fileId: file.id,
    xPercent,
    yPercent,
    authorName: authorName.trim(),
  });

  const pin = await db.select().from(pins).where(eq(pins.id, pinId)).get();

  return NextResponse.json({
    id: pin!.id,
    fileId: pin!.fileId,
    xPercent: pin!.xPercent,
    yPercent: pin!.yPercent,
    authorName: pin!.authorName,
    createdAt: pin!.createdAt.toISOString(),
    comments: [],
  });
}

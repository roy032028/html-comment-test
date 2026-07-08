import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { files, pins, comments } from "@/lib/db/schema";
import type { FileReview, Pin, Comment } from "@/lib/types";

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

  const pinRows = await db
    .select()
    .from(pins)
    .where(eq(pins.fileId, fileId))
    .orderBy(pins.createdAt)
    .all();

  const pinList: Pin[] = await Promise.all(
    pinRows.map(async (pin) => {
      const commentRows = await db
        .select()
        .from(comments)
        .where(eq(comments.pinId, pin.id))
        .orderBy(comments.createdAt)
        .all();

      return {
        id: pin.id,
        fileId: pin.fileId,
        xPercent: pin.xPercent,
        yPercent: pin.yPercent,
        selector: pin.selector,
        offsetX: pin.offsetX,
        offsetY: pin.offsetY,
        anchorText: pin.anchorText,
        authorName: pin.authorName,
        createdAt: pin.createdAt.toISOString(),
        comments: commentRows.map(
          (c): Comment => ({
            id: c.id,
            pinId: c.pinId,
            authorName: c.authorName,
            body: c.body,
            createdAt: c.createdAt.toISOString(),
          })
        ),
      };
    })
  );

  const result: FileReview = {
    file: {
      id: file.id,
      projectId: file.projectId,
      filename: file.filename,
      createdAt: file.createdAt.toISOString(),
      pinCount: pinList.length,
    },
    pins: pinList,
  };

  return NextResponse.json(result);
}

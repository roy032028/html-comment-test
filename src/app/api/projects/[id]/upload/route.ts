import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import path from "path";
import { db } from "@/lib/db";
import { projects, files } from "@/lib/db/schema";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .get();

  if (!project) {
    return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다" }, { status: 404 });
  }

  // 큰 파일도 올릴 수 있도록 gzip 바이트를 청크(base64 JSON)로 나눠 받는다.
  // 이 POST는 "첫 청크"로 파일을 생성하고, 나머지는 파일 PUT(append)로 이어붙인다.
  const body = await request.json().catch(() => null);
  const filename: string = body?.filename ?? "";
  const data: string = typeof body?.data === "string" ? body.data : "";

  const ext = path.extname(filename).toLowerCase();
  if (ext !== ".html" && ext !== ".htm") {
    return NextResponse.json(
      { error: "HTML 파일(.html, .htm)만 업로드할 수 있습니다" },
      { status: 400 }
    );
  }
  if (!data) {
    return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 });
  }

  const content = Buffer.from(data, "base64");

  const fileId = nanoid(12);
  await db.insert(files).values({
    id: fileId,
    projectId,
    filename,
    content,
  });

  return NextResponse.json({
    id: fileId,
    projectId,
    filename,
  });
}

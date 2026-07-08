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

  const formData = await request.formData();
  const blob = formData.get("file") as File | null;
  const filename = (formData.get("filename") as string | null) ?? blob?.name ?? "";

  if (!blob) {
    return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 });
  }

  const ext = path.extname(filename).toLowerCase();

  if (ext !== ".html" && ext !== ".htm") {
    return NextResponse.json(
      { error: "HTML 파일(.html, .htm)만 업로드할 수 있습니다" },
      { status: 400 }
    );
  }

  // 클라이언트가 gzip 압축한 바이트를 그대로 저장 (서빙 시 서버가 해제)
  const content = Buffer.from(await blob.arrayBuffer());

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

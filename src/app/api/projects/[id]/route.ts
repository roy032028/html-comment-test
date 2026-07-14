import { NextResponse } from "next/server";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, files, pins } from "@/lib/db/schema";
import type { Project, ProjectFile } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .get();

  if (!project) {
    return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다" }, { status: 404 });
  }

  // 목록엔 메타데이터만 필요 → 무거운 content(gzip HTML) 블롭은 조회하지 않는다.
  const fileRows = await db
    .select({
      id: files.id,
      projectId: files.projectId,
      filename: files.filename,
      createdAt: files.createdAt,
    })
    .from(files)
    .where(eq(files.projectId, id))
    .orderBy(files.createdAt)
    .all();

  // 파일별 핀(댓글) 수는 파일마다 세지 않고(N+1) 한 번의 groupBy로 집계.
  const fileIds = fileRows.map((f) => f.id);
  const counts = new Map<string, number>();
  if (fileIds.length > 0) {
    const countRows = await db
      .select({ fileId: pins.fileId, count: sql<number>`count(*)` })
      .from(pins)
      .where(inArray(pins.fileId, fileIds))
      .groupBy(pins.fileId)
      .all();
    for (const row of countRows) counts.set(row.fileId, Number(row.count));
  }

  const fileList: ProjectFile[] = fileRows.map((file) => ({
    id: file.id,
    projectId: file.projectId,
    filename: file.filename,
    createdAt: file.createdAt.toISOString(),
    pinCount: counts.get(file.id) ?? 0,
  }));

  const result: Project = {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt.toISOString(),
    files: fileList,
  };

  return NextResponse.json(result);
}

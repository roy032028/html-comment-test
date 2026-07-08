import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
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

  const fileRows = await db
    .select()
    .from(files)
    .where(eq(files.projectId, id))
    .orderBy(files.createdAt)
    .all();

  const fileList: ProjectFile[] = await Promise.all(
    fileRows.map(async (file) => {
      const pinRows = await db
        .select()
        .from(pins)
        .where(eq(pins.fileId, file.id))
        .all();

      return {
        id: file.id,
        projectId: file.projectId,
        filename: file.filename,
        createdAt: file.createdAt.toISOString(),
        pinCount: pinRows.length,
      };
    })
  );

  const result: Project = {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt.toISOString(),
    files: fileList,
  };

  return NextResponse.json(result);
}

import { eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { projects, files, pins } from "./db/schema";
import type { Project, ProjectFile } from "./types";

/**
 * 프로젝트 + 파일 목록 + 파일별 핀 수를 한 번에 조회한다.
 * 서버 컴포넌트(`app/page.tsx`)와 API 라우트가 같은 로직을 공유한다.
 */
export async function getProject(id: string): Promise<Project | null> {
  // 프로젝트 행과 파일 목록은 서로 의존하지 않으므로 함께 보낸다.
  // 목록엔 메타데이터만 필요 → 무거운 content(gzip HTML) 블롭은 조회하지 않는다.
  const [project, fileRows] = await Promise.all([
    db.select().from(projects).where(eq(projects.id, id)).get(),
    db
      .select({
        id: files.id,
        projectId: files.projectId,
        filename: files.filename,
        createdAt: files.createdAt,
      })
      .from(files)
      .where(eq(files.projectId, id))
      .orderBy(files.createdAt)
      .all(),
  ]);

  if (!project) return null;

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

  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt.toISOString(),
    files: fileList,
  };
}

import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { projects, files, pins } from "./db/schema";
import type { Project, ProjectFile } from "./types";

/**
 * 프로젝트 + 파일 목록 + 파일별 핀 수를 한 번에 조회한다.
 * 서버 컴포넌트(`app/page.tsx`)와 API 라우트가 같은 로직을 공유한다.
 */
export async function getProject(id: string): Promise<Project | null> {
  // 프로젝트 행과 파일 목록은 서로 의존하지 않으므로 함께 보낸다.
  // (libSQL HTTP 클라이언트가 같은 틱의 요청을 한 번의 왕복으로 파이프라이닝한다.)
  //
  // 파일별 핀 수는 fileIds를 알아야 해서 예전엔 뒤이어 따로 조회했는데,
  // 그러면 앞의 응답을 기다린 뒤 나가므로 원격 DB 왕복이 한 번 더 붙었다.
  // 같은 쿼리에서 LEFT JOIN으로 세면 파이프라인에 함께 실려 왕복이 1회로 끝난다.
  // 목록엔 메타데이터만 필요 → 무거운 content(gzip HTML) 블롭은 조회하지 않는다.
  const [project, fileRows] = await Promise.all([
    db.select().from(projects).where(eq(projects.id, id)).get(),
    db
      .select({
        id: files.id,
        projectId: files.projectId,
        filename: files.filename,
        createdAt: files.createdAt,
        pinCount: sql<number>`count(${pins.id})`,
      })
      .from(files)
      .leftJoin(pins, eq(pins.fileId, files.id))
      .where(eq(files.projectId, id))
      .groupBy(files.id)
      .orderBy(files.createdAt)
      .all(),
  ]);

  if (!project) return null;

  const fileList: ProjectFile[] = fileRows.map((file) => ({
    id: file.id,
    projectId: file.projectId,
    filename: file.filename,
    createdAt: file.createdAt.toISOString(),
    pinCount: Number(file.pinCount),
  }));

  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt.toISOString(),
    files: fileList,
  };
}

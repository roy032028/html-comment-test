import ProjectPage from "@/components/ProjectPage";
import { ensureDefaultProject, DEFAULT_PROJECT_ID } from "@/lib/project";
import { getProject } from "@/lib/queries";

// 요청 시점(런타임)에 DB를 조회해야 하므로 정적 프리렌더 금지
export const dynamic = "force-dynamic";

export default async function Home() {
  // 첫 페인트에 데이터가 이미 있도록 서버에서 조회해 내려보낸다.
  // (예전엔 ID만 넘겨서 클라이언트가 하이드레이션 후 /api를 다시 불렀고,
  //  그 왕복 동안 "로딩 중..."이 떠 있었다.)
  let project = await getProject(DEFAULT_PROJECT_ID);

  // 기본 프로젝트가 아직 없는 최초 1회에만 타는 경로
  if (!project) {
    await ensureDefaultProject();
    project = await getProject(DEFAULT_PROJECT_ID);
  }

  return (
    <ProjectPage projectId={DEFAULT_PROJECT_ID} initialProject={project} />
  );
}

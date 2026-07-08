import ProjectPage from "@/components/ProjectPage";
import { ensureDefaultProject, DEFAULT_PROJECT_ID } from "@/lib/project";

// 요청 시점(런타임)에 기본 프로젝트를 보장해야 하므로 정적 프리렌더 금지
export const dynamic = "force-dynamic";

export default async function Home() {
  await ensureDefaultProject();
  return <ProjectPage projectId={DEFAULT_PROJECT_ID} />;
}

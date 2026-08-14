"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/types";

export default function ProjectPage({
  projectId,
  // 서버에서 미리 조회해 넘겨주면 첫 페인트부터 목록이 보인다(스피너·추가 왕복 없음).
  // 넘기지 않으면 기존처럼 마운트 후 클라이언트에서 조회한다.
  initialProject,
}: {
  projectId: string;
  initialProject?: Project | null;
}) {
  const [project, setProject] = useState<Project | null>(initialProject ?? null);
  const [loading, setLoading] = useState(!initialProject);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`);
    if (!res.ok) {
      setError("프로젝트를 찾을 수 없습니다");
      setLoading(false);
      return;
    }
    const data: Project = await res.json();
    setProject(data);
    setLoading(false);
  }, [projectId]);

  // 서버가 넘겨준 데이터가 있으면 마운트 직후 재조회는 건너뛴다.
  // (업로드·삭제 후의 fetchProject 호출은 그대로 동작)
  const skipInitialFetch = useRef(Boolean(initialProject));

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
    fetchProject();
  }, [fetchProject]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);

    try {
      // 업로드 전 브라우저에서 gzip 압축
      const gzStream = file.stream().pipeThrough(new CompressionStream("gzip"));
      const gz = new Uint8Array(await new Response(gzStream).arrayBuffer());

      // Vercel 요청 4.5MB 한도를 넘기려면 3MB 바이트 청크로 나눠 올리고 서버가 이어붙인다.
      const CHUNK = 3_000_000;
      const toB64 = (u8: Uint8Array) => {
        let s = "";
        const c = 0x8000;
        for (let i = 0; i < u8.length; i += c)
          s += String.fromCharCode(...u8.subarray(i, i + c));
        return btoa(s);
      };

      // 1) 첫 청크로 파일 생성
      const first = gz.subarray(0, Math.min(CHUNK, gz.length));
      const res = await fetch(`/api/projects/${projectId}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, data: toB64(first) }),
      });
      if (!res.ok) {
        let detail = `${res.status}`;
        try {
          const d = await res.json();
          if (d?.error) detail = `${d.error} (${res.status})`;
        } catch {}
        setUploadError(`업로드 실패: ${detail}`);
        return;
      }
      const { id: fileId } = await res.json();

      // 2) 나머지 청크 이어붙이기
      for (let i = CHUNK; i < gz.length; i += CHUNK) {
        const slice = gz.subarray(i, Math.min(i + CHUNK, gz.length));
        const ar = await fetch(
          `/api/projects/${projectId}/files/${fileId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ append: toB64(slice) }),
          }
        );
        if (!ar.ok) {
          setUploadError(
            `업로드 실패: 큰 파일 저장 중 오류 (${ar.status}). 다시 시도해 주세요.`
          );
          return;
        }
      }
      await fetchProject();
    } catch (err) {
      setUploadError(
        `업로드 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`
      );
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm("이 HTML과 달린 댓글을 모두 삭제할까요?")) return;
    const res = await fetch(`/api/projects/${projectId}/files/${fileId}`, {
      method: "DELETE",
    });
    if (res.ok) await fetchProject();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400">로딩 중...</div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 mb-4">{error}</p>
          <a href="/" className="text-blue-500 hover:underline text-sm">
            홈으로 돌아가기
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-gray-900 truncate">{project.name}</h1>
              <p className="text-xs text-gray-500">HTML {project.files.length}개</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="cursor-pointer text-sm bg-blue-500 hover:bg-blue-600 text-white font-medium px-3 py-1.5 rounded-lg transition-colors">
              {uploading ? "업로드 중..." : "HTML 업로드"}
              <input
                type="file"
                accept=".html,.htm"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
            <button
              onClick={handleCopy}
              className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {copied ? "복사됨!" : "링크 공유"}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="max-w-5xl mx-auto">
          {uploadError && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              {uploadError}
            </div>
          )}
          {project.files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border-2 border-dashed border-gray-200">
              <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-gray-500 mb-2">아직 업로드된 HTML이 없습니다</p>
              <p className="text-gray-400 text-sm">우측 상단의 &quot;HTML 업로드&quot; 버튼을 클릭하세요</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {project.files.map((file) => (
                <div
                  key={file.id}
                  className="group relative bg-white rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all overflow-hidden"
                >
                  <a
                    href={`/review/${projectId}/${file.id}`}
                    className="absolute inset-0 z-0"
                    aria-label={file.filename}
                  />
                  <div className="h-32 bg-gray-50 border-b border-gray-100 flex items-center justify-center">
                    <svg className="w-10 h-10 text-gray-300 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-gray-900 text-sm truncate">
                      {file.filename}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      댓글 {file.pinCount}개
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteFile(file.id)}
                    className="absolute top-2 right-2 z-10 bg-white/90 backdrop-blur text-gray-400 hover:text-red-500 border border-gray-200 rounded-lg p-1.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    title="HTML 삭제"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

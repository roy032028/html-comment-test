"use client";

import { useCallback, useEffect, useState } from "react";
import HtmlViewer from "@/components/HtmlViewer";
import CommentPanel from "@/components/CommentPanel";
import ShareBar from "@/components/ShareBar";
import type { FileReview, Pin } from "@/lib/types";
import { DEFAULT_PROJECT_ID } from "@/lib/constants";

const AUTHOR_NAME_KEY = "filestage_author_name";

export default function ReviewPage({
  projectId,
  fileId,
}: {
  projectId: string;
  fileId: string;
}) {
  const [fileName, setFileName] = useState("");
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authorName, setAuthorName] = useState("");
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [isPlacingPin, setIsPlacingPin] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(AUTHOR_NAME_KEY);
    if (saved) setAuthorName(saved);
  }, []);

  const saveAuthorName = (name: string) => {
    setAuthorName(name);
    localStorage.setItem(AUTHOR_NAME_KEY, name);
  };

  const fetchPins = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/files/${fileId}/pins`);
    if (!res.ok) {
      setError("파일을 찾을 수 없습니다");
      setLoading(false);
      return;
    }
    const data: FileReview = await res.json();
    setFileName(data.file.filename);
    setPins(data.pins);
    setLoading(false);
  }, [projectId, fileId]);

  useEffect(() => {
    fetchPins();
    // 주기적 폴링 대신, 탭에 다시 들어올 때(포커스/가시성 변경)만 갱신
    const onFocus = () => fetchPins();
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchPins();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchPins]);

  const listHref =
    projectId === DEFAULT_PROJECT_ID ? "/" : `/review/${projectId}`;

  const handleSelectPin = (pinId: string | null) => {
    setActivePinId(pinId);
    if (pinId) setIsPanelOpen(true);
  };

  const handleTogglePanel = () => {
    if (!isPanelOpen) {
      if (!activePinId && pins.length > 0) {
        setActivePinId(pins[0].id);
      }
      setIsPanelOpen(true);
    } else {
      setIsPanelOpen(false);
    }
  };

  const handlePinPlaced = (pin: Pin) => {
    setPins((prev) => [...prev, pin]);
    setIsPlacingPin(false);
    // 핀 추가 시 전체를 다시 불러와 최신 상태(다른 사람 핀 포함)로 동기화
    fetchPins();
  };

  const handleCommentAdded = (pinId: string, comment: Pin["comments"][0]) => {
    setPins((prev) =>
      prev.map((p) =>
        p.id === pinId ? { ...p, comments: [...p.comments, comment] } : p
      )
    );
  };

  const handleCommentDeleted = (pinId: string, commentId: string) => {
    setPins((prev) =>
      prev.map((p) =>
        p.id === pinId
          ? { ...p, comments: p.comments.filter((c) => c.id !== commentId) }
          : p
      )
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 mb-4">{error}</p>
          <a href={listHref} className="text-blue-500 hover:underline text-sm">
            파일 목록으로 돌아가기
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <ShareBar
        backHref={listHref}
        fileName={fileName}
        authorName={authorName}
        onAuthorNameChange={saveAuthorName}
        isPlacingPin={isPlacingPin}
        onTogglePlacingPin={() => setIsPlacingPin(!isPlacingPin)}
        pinCount={pins.length}
        isPanelOpen={isPanelOpen}
        onTogglePanel={handleTogglePanel}
      />

      <main className="flex-1 min-h-0 relative">
        {!authorName && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-4 py-2 rounded-lg shadow-sm">
            상단에서 이름을 입력하면 핀과 댓글을 남길 수 있습니다.
          </div>
        )}

        <HtmlViewer
          projectId={projectId}
          fileId={fileId}
          pins={pins}
          authorName={authorName || "익명"}
          activePinId={activePinId}
          isPlacingPin={isPlacingPin}
          onPinPlaced={handlePinPlaced}
          onPinSelect={handleSelectPin}
        />

        {isPanelOpen && (
          <div className="fixed top-20 right-4 z-40">
            <CommentPanel
              pins={pins}
              activePinId={activePinId}
              authorName={authorName || "익명"}
              onSelectPin={handleSelectPin}
              onCommentAdded={handleCommentAdded}
              onCommentDeleted={handleCommentDeleted}
              onClose={() => setIsPanelOpen(false)}
            />
          </div>
        )}
      </main>
    </div>
  );
}

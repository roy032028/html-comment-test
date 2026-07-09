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
  const [pinsHidden, setPinsHidden] = useState(false);

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
    // 아직 서버에 확정되지 않은 임시(temp) 핀은 보존(재조회가 낙관적 핀을 지우지 않도록)
    setPins((prev) => {
      const temps = prev.filter((p) => p.id.startsWith("temp-"));
      return [...data.pins, ...temps];
    });
    setLoading(false);
  }, [projectId, fileId]);

  useEffect(() => {
    fetchPins();
    // 주기적 폴링 대신, 탭이 다시 보일 때만 갱신
    // (window 'focus'는 iframe 포커스 변화로 자주 터져 낙관적 핀을 지울 수 있어 제외)
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchPins();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchPins]);

  const listHref =
    projectId === DEFAULT_PROJECT_ID ? "/" : `/review/${projectId}`;

  // 댓글이 하나도 없는 핀(빈 핀)은 그 핀에서 벗어날 때 삭제
  const discardIfEmpty = (pinId: string | null) => {
    if (!pinId) return;
    const p = pins.find((x) => x.id === pinId);
    if (p && p.comments.length === 0) {
      setPins((prev) => prev.filter((x) => x.id !== pinId));
      fetch(`/api/pins/${pinId}`, { method: "DELETE" });
    }
  };

  const handleSelectPin = (pinId: string | null) => {
    if (activePinId && activePinId !== pinId) discardIfEmpty(activePinId);
    setActivePinId(pinId);
    if (pinId) setIsPanelOpen(true);
  };

  const handleTogglePanel = () => {
    if (isPanelOpen) {
      discardIfEmpty(activePinId);
      setActivePinId(null);
      setIsPanelOpen(false);
    } else {
      // "댓글" 버튼은 항상 목록부터 표시
      setActivePinId(null);
      setIsPanelOpen(true);
    }
  };

  const handleClosePanel = () => {
    discardIfEmpty(activePinId);
    setActivePinId(null);
    setIsPanelOpen(false);
  };

  const handlePinDeleted = (pinId: string) => {
    setPins((prev) => prev.filter((p) => p.id !== pinId));
    setActivePinId(null);
  };

  const handlePinPlaced = (pin: Pin) => {
    // 낙관적 추가: 즉시 표시
    setPins((prev) => [...prev, pin]);
    setIsPlacingPin(false);
  };

  const handlePinConfirmed = (tempId: string, pin: Pin) => {
    setPins((prev) =>
      prev.some((p) => p.id === tempId)
        ? prev.map((p) => (p.id === tempId ? pin : p))
        : [...prev, pin]
    );
    setActivePinId((cur) => (cur === tempId ? pin.id : cur));
  };

  const handlePinFailed = (tempId: string) => {
    setPins((prev) => prev.filter((p) => p.id !== tempId));
    setActivePinId((cur) => (cur === tempId ? null : cur));
  };

  const handlePinMoved = (pinId: string, patch: Partial<Pin>) => {
    setPins((prev) =>
      prev.map((p) => (p.id === pinId ? { ...p, ...patch } : p))
    );
  };

  const handleCommentAdded = (pinId: string, comment: Pin["comments"][0]) => {
    setPins((prev) =>
      prev.map((p) =>
        p.id === pinId ? { ...p, comments: [...p.comments, comment] } : p
      )
    );
  };

  const handleCommentEdited = (
    pinId: string,
    commentId: string,
    body: string
  ) => {
    setPins((prev) =>
      prev.map((p) =>
        p.id === pinId
          ? {
              ...p,
              comments: p.comments.map((c) =>
                c.id === commentId ? { ...c, body } : c
              ),
            }
          : p
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
        pinsHidden={pinsHidden}
        onTogglePinsHidden={() => setPinsHidden((v) => !v)}
      />

      <main className="flex-1 min-h-0 relative">
        {!authorName && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-4 py-2 rounded-lg shadow-sm">
            상단에서 이름을 입력하면 댓글을 남길 수 있습니다.
          </div>
        )}

        <HtmlViewer
          projectId={projectId}
          fileId={fileId}
          pins={pins}
          authorName={authorName || "익명"}
          activePinId={activePinId}
          isPlacingPin={isPlacingPin}
          pinsHidden={pinsHidden && !isPlacingPin}
          onPinPlaced={handlePinPlaced}
          onPinConfirmed={handlePinConfirmed}
          onPinFailed={handlePinFailed}
          onPinMoved={handlePinMoved}
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
              onCommentEdited={handleCommentEdited}
              onCommentDeleted={handleCommentDeleted}
              onPinDeleted={handlePinDeleted}
              onClose={handleClosePanel}
            />
          </div>
        )}
      </main>
    </div>
  );
}

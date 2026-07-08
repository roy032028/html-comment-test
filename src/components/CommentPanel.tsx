"use client";

import { useState } from "react";
import type { Pin } from "@/lib/types";

interface CommentPanelProps {
  pins: Pin[];
  activePinId: string | null;
  authorName: string;
  onSelectPin: (pinId: string | null) => void;
  onCommentAdded: (pinId: string, comment: Pin["comments"][0]) => void;
  onCommentEdited: (pinId: string, commentId: string, body: string) => void;
  onCommentDeleted: (pinId: string, commentId: string) => void;
  onPinDeleted: (pinId: string) => void;
  onClose: () => void;
}

const initial = (name: string) => name?.[0]?.toUpperCase() ?? "?";

function Message({
  comment,
  onEdit,
  onDelete,
}: {
  comment: Pin["comments"][0];
  onEdit: (body: string) => Promise<void>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(comment.body);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!value.trim() || saving) return;
    setSaving(true);
    await onEdit(value.trim());
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className="group space-y-1">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
          {initial(comment.authorName)}
        </div>
        <span className="text-sm font-medium text-gray-800">
          {comment.authorName}
        </span>
        <span className="text-xs text-gray-400">
          {new Date(comment.createdAt).toLocaleString("ko-KR", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        {!editing && (
          <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => {
                setValue(comment.body);
                setEditing(true);
              }}
              className="text-gray-300 hover:text-blue-500 p-1 rounded"
              title="수정"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={onDelete}
              className="text-gray-300 hover:text-red-500 p-1 rounded"
              title="삭제"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="pl-8 space-y-2">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={!value.trim() || saving}
              className="text-xs bg-blue-500 text-white font-medium px-3 py-1 rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-xs bg-gray-100 text-gray-600 font-medium px-3 py-1 rounded-lg hover:bg-gray-200"
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-700 pl-8 whitespace-pre-wrap break-words">
          {comment.body}
        </p>
      )}
    </div>
  );
}

export default function CommentPanel({
  pins,
  activePinId,
  authorName,
  onSelectPin,
  onCommentAdded,
  onCommentEdited,
  onCommentDeleted,
  onPinDeleted,
  onClose,
}: CommentPanelProps) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const activePin = pins.find((p) => p.id === activePinId) ?? null;

  // 낙관적으로 방금 찍은 핀은 서버 저장 전(temp id)이라 댓글 등록이 실패할 수 있음
  const pinPending = !!activePin && activePin.id.startsWith("temp-");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePin || pinPending || !body.trim() || submitting) return;

    setSubmitting(true);
    const res = await fetch(`/api/pins/${activePin.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorName, body }),
    });

    if (res.ok) {
      const comment = await res.json();
      onCommentAdded(activePin.id, comment);
      setBody("");
    }
    setSubmitting(false);
  };

  const handleEdit = async (
    pinId: string,
    commentId: string,
    newBody: string
  ) => {
    const res = await fetch(`/api/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newBody }),
    });
    if (res.ok) onCommentEdited(pinId, commentId, newBody);
  };

  const handleDelete = async (pinId: string, commentId: string) => {
    if (!confirm("이 답글을 삭제할까요?")) return;
    const res = await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
    if (res.ok) onCommentDeleted(pinId, commentId);
  };

  // 루트 댓글 삭제 = 핀 삭제(답글 포함 전체 제거)
  const handleDeletePin = async (pinId: string) => {
    if (!confirm("이 댓글을 삭제하면 답글도 모두 사라집니다. 삭제할까요?"))
      return;
    const res = await fetch(`/api/pins/${pinId}`, { method: "DELETE" });
    if (res.ok) onPinDeleted(pinId);
  };

  return (
    <div className="w-80 bg-white border border-gray-200 rounded-xl shadow-xl flex flex-col max-h-[80vh]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          {activePin && (
            <button
              onClick={() => onSelectPin(null)}
              className="text-gray-400 hover:text-gray-600 p-1 rounded -ml-1"
              title="목록으로"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm">댓글</h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {activePin
                ? `${activePin.authorName}의 댓글`
                : `댓글 ${pins.length}개`}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-1 rounded flex-shrink-0"
          title="패널 닫기"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {!activePin ? (
        <div className="flex-1 overflow-y-auto p-2">
          {pins.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              아직 댓글이 없습니다
            </p>
          ) : (
            <ul className="space-y-1">
              {pins.map((pin) => {
                const root = pin.comments[0] ?? null;
                return (
                  <li key={pin.id}>
                    <button
                      onClick={() => onSelectPin(pin.id)}
                      className="w-full flex items-start gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 text-left"
                    >
                      <span className="w-6 h-6 flex-shrink-0 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                        {initial(pin.authorName)}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-gray-800 truncate">
                          {pin.authorName}
                        </span>
                        <span className="block text-sm text-gray-600 line-clamp-1">
                          {root ? root.body : "댓글 없음"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {activePin.comments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                첫 댓글을 남겨보세요
              </p>
            ) : (
              <>
                {/* 루트 댓글: 삭제 시 핀 전체 삭제 */}
                <Message
                  comment={activePin.comments[0]}
                  onEdit={(newBody) =>
                    handleEdit(activePin.id, activePin.comments[0].id, newBody)
                  }
                  onDelete={() => handleDeletePin(activePin.id)}
                />
                {/* 답글들 */}
                {activePin.comments.length > 1 && (
                  <div className="pl-4 border-l-2 border-gray-100 space-y-3">
                    {activePin.comments.slice(1).map((reply) => (
                      <Message
                        key={reply.id}
                        comment={reply}
                        onEdit={(newBody) =>
                          handleEdit(activePin.id, reply.id, newBody)
                        }
                        onDelete={() => handleDelete(activePin.id, reply.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-3 border-t border-gray-100">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                activePin.comments.length > 0
                  ? "답글을 입력하세요..."
                  : "댓글을 입력하세요..."
              }
              className="w-full text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
            />
            <button
              type="submit"
              disabled={!body.trim() || submitting || pinPending}
              className="mt-2 w-full bg-blue-500 text-white text-sm font-medium py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting
                ? "등록 중..."
                : pinPending
                ? "핀 저장 중..."
                : activePin.comments.length > 0
                ? "답글 등록"
                : "댓글 등록"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

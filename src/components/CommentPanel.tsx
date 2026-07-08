"use client";

import { useState } from "react";
import type { Pin } from "@/lib/types";

interface CommentPanelProps {
  pins: Pin[];
  activePinId: string | null;
  authorName: string;
  onSelectPin: (pinId: string | null) => void;
  onCommentAdded: (pinId: string, comment: Pin["comments"][0]) => void;
  onClose: () => void;
}

function Message({ comment }: { comment: Pin["comments"][0] }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
          {comment.authorName[0]?.toUpperCase()}
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
      </div>
      <p className="text-sm text-gray-700 pl-8 whitespace-pre-wrap break-words">
        {comment.body}
      </p>
    </div>
  );
}

export default function CommentPanel({
  pins,
  activePinId,
  authorName,
  onSelectPin,
  onCommentAdded,
  onClose,
}: CommentPanelProps) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent, pinId: string) => {
    e.preventDefault();
    if (!body.trim() || submitting) return;

    setSubmitting(true);
    const res = await fetch(`/api/pins/${pinId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorName, body }),
    });

    if (res.ok) {
      const comment = await res.json();
      onCommentAdded(pinId, comment);
      setBody("");
    }
    setSubmitting(false);
  };

  return (
    <div className="w-80 bg-white border border-gray-200 rounded-xl shadow-xl flex flex-col max-h-[80vh]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm">댓글</h3>
          <p className="text-xs text-gray-500 mt-0.5">핀 {pins.length}개</p>
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

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {pins.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            아직 핀이 없습니다
          </p>
        ) : (
          pins.map((pin, index) => {
            const isActive = pin.id === activePinId;
            const rootComment = pin.comments[0] ?? null;
            const replies = pin.comments.slice(1);
            return (
              <div
                key={pin.id}
                className={`rounded-lg border transition-colors ${
                  isActive
                    ? "border-blue-500 ring-1 ring-blue-200 bg-blue-50/40"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <button
                  onClick={() => onSelectPin(isActive ? null : pin.id)}
                  className="w-full flex items-start gap-3 px-3 py-2.5 text-left"
                >
                  <span
                    className={`w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                      isActive ? "bg-orange-500" : "bg-blue-500"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-gray-800 truncate">
                      {rootComment?.authorName ?? pin.authorName}
                    </span>
                    {rootComment ? (
                      <span className="block text-sm text-gray-600 line-clamp-2">
                        {rootComment.body}
                      </span>
                    ) : (
                      <span className="block text-xs text-gray-400 italic">
                        아직 댓글이 없습니다
                      </span>
                    )}
                    {replies.length > 0 && !isActive && (
                      <span className="block text-xs text-blue-500 mt-0.5">
                        답글 {replies.length}개
                      </span>
                    )}
                  </span>
                </button>

                {isActive && (
                  <div className="px-3 pb-3 border-t border-blue-100 pt-3 space-y-3">
                    {rootComment ? (
                      <>
                        <Message comment={rootComment} />
                        {replies.length > 0 && (
                          <div className="pl-4 border-l-2 border-gray-100 space-y-3">
                            {replies.map((reply) => (
                              <Message key={reply.id} comment={reply} />
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-2">
                        첫 댓글을 남겨보세요
                      </p>
                    )}

                    <form onSubmit={(e) => handleSubmit(e, pin.id)}>
                      <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder={
                          rootComment ? "답글을 입력하세요..." : "댓글을 입력하세요..."
                        }
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={2}
                      />
                      <button
                        type="submit"
                        disabled={!body.trim() || submitting}
                        className="mt-2 w-full bg-blue-500 text-white text-sm font-medium py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {submitting
                          ? "등록 중..."
                          : rootComment
                          ? "답글 등록"
                          : "댓글 등록"}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

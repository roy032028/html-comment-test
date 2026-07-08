"use client";

import { useState } from "react";

interface ShareBarProps {
  backHref: string;
  fileName: string;
  authorName: string;
  onAuthorNameChange: (name: string) => void;
  isPlacingPin: boolean;
  onTogglePlacingPin: () => void;
  pinCount: number;
  isPanelOpen: boolean;
  onTogglePanel: () => void;
  pinsHidden: boolean;
  onTogglePinsHidden: () => void;
}

export default function ShareBar({
  backHref,
  fileName,
  authorName,
  onAuthorNameChange,
  isPlacingPin,
  onTogglePlacingPin,
  pinCount,
  isPanelOpen,
  onTogglePanel,
  pinsHidden,
  onTogglePinsHidden,
}: ShareBarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <a
            href={backHref}
            className="w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-600"
            title="파일 목록으로"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <div className="min-w-0">
            <h1 className="font-semibold text-gray-900 truncate">{fileName}</h1>
            <p className="text-xs text-gray-500">댓글 {pinCount}개</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={authorName}
            onChange={(e) => onAuthorNameChange(e.target.value)}
            placeholder="이름"
            className="text-sm text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-lg px-3 py-1.5 w-28 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            onClick={onTogglePlacingPin}
            className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
              isPlacingPin
                ? "bg-orange-500 text-white hover:bg-orange-600"
                : "bg-blue-500 text-white hover:bg-blue-600"
            }`}
          >
            {isPlacingPin ? "취소" : "댓글 달기"}
          </button>

          <button
            onClick={onTogglePinsHidden}
            className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              pinsHidden
                ? "bg-gray-800 text-white hover:bg-gray-900"
                : "bg-gray-100 hover:bg-gray-200 text-gray-700"
            }`}
            title={pinsHidden ? "댓글 보이기" : "댓글 숨기기"}
          >
            {pinsHidden ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
            {pinsHidden ? "댓글 보이기" : "댓글 숨기기"}
          </button>

          <button
            onClick={onTogglePanel}
            className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              isPanelOpen
                ? "bg-gray-800 text-white hover:bg-gray-900"
                : "bg-gray-100 hover:bg-gray-200 text-gray-700"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {isPanelOpen ? "목록 닫기" : "댓글 목록"}
          </button>

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
  );
}

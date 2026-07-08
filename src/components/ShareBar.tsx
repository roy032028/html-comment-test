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
            <p className="text-xs text-gray-500">핀 {pinCount}개</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={authorName}
            onChange={(e) => onAuthorNameChange(e.target.value)}
            placeholder="이름"
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 w-28 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            onClick={onTogglePlacingPin}
            className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
              isPlacingPin
                ? "bg-orange-500 text-white hover:bg-orange-600"
                : "bg-blue-500 text-white hover:bg-blue-600"
            }`}
          >
            {isPlacingPin ? "핀 추가 취소" : "핀 추가"}
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
            {isPanelOpen ? "댓글 닫기" : "댓글"}
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

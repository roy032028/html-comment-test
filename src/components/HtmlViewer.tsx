"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Pin } from "@/lib/types";

// HTML을 항상 이 고정 폭으로 렌더링한 뒤 화면에 맞춰 축소/확대한다.
// 폭이 고정이라 내부 레이아웃이 리플로우되지 않아 핀이 항상 같은 위치에 붙는다.
const DESIGN_WIDTH = 1440;

interface HtmlViewerProps {
  projectId: string;
  fileId: string;
  pins: Pin[];
  authorName: string;
  activePinId: string | null;
  isPlacingPin: boolean;
  onPinPlaced: (pin: Pin) => void;
  onPinSelect: (pinId: string | null) => void;
}

export default function HtmlViewer({
  projectId,
  fileId,
  pins,
  authorName,
  activePinId,
  isPlacingPin,
  onPinPlaced,
  onPinSelect,
}: HtmlViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [containerWidth, setContainerWidth] = useState(DESIGN_WIDTH);
  const [contentHeight, setContentHeight] = useState(900);

  const scale = containerWidth / DESIGN_WIDTH;

  // 컨테이너 폭 변화를 추적해 스케일을 갱신한다.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const measureHeight = useCallback(() => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc) {
        const h = Math.max(
          doc.documentElement?.scrollHeight ?? 0,
          doc.body?.scrollHeight ?? 0
        );
        if (h > 0) setContentHeight(h);
      }
    } catch {
      // 크로스오리진 등으로 측정 실패 시 기본값 유지
    }
  }, []);

  const handleLoad = () => {
    setLoading(false);
    measureHeight();
    // 이미지·폰트 로딩 후 높이가 바뀔 수 있어 한 번 더 측정
    setTimeout(measureHeight, 400);
  };

  const handleOverlayClick = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isPlacingPin) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
      const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

      const res = await fetch(`/api/projects/${projectId}/pins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xPercent, yPercent, authorName, fileId }),
      });

      if (res.ok) {
        const pin = await res.json();
        onPinPlaced(pin);
        onPinSelect(pin.id);
      }
    },
    [isPlacingPin, projectId, fileId, authorName, onPinPlaced, onPinSelect]
  );

  const handlePinClick = useCallback(
    (e: React.MouseEvent, pinId: string) => {
      e.stopPropagation();
      onPinSelect(activePinId === pinId ? null : pinId);
    },
    [activePinId, onPinSelect]
  );

  const dispW = containerWidth;
  const dispH = contentHeight * scale;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-white overflow-x-hidden overflow-y-auto"
    >
      {/* 화면에 표시되는(축소된) 프레임 크기의 래퍼 */}
      <div className="relative" style={{ width: dispW, height: dispH }}>
        <iframe
          ref={iframeRef}
          src={`/api/projects/${projectId}/files/${fileId}`}
          sandbox="allow-scripts allow-same-origin"
          onLoad={handleLoad}
          title="HTML Preview"
          style={{
            width: DESIGN_WIDTH,
            height: contentHeight,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            position: "absolute",
            top: 0,
            left: 0,
            border: 0,
          }}
        />

        {/* 핀 오버레이: 축소 프레임과 같은 크기라 %좌표가 콘텐츠에 정확히 대응 */}
        <div
          className={`absolute inset-0 ${
            isPlacingPin ? "cursor-crosshair" : "pointer-events-none"
          }`}
          onClick={handleOverlayClick}
        >
          {pins.map((pin, index) => (
            <button
              key={pin.id}
              className={`pointer-events-auto absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md transition-transform hover:scale-110 ${
                activePinId === pin.id
                  ? "bg-orange-500 ring-2 ring-orange-300 scale-110 z-20"
                  : "bg-blue-500 hover:bg-blue-600 z-10"
              }`}
              style={{
                left: `${pin.xPercent}%`,
                top: `${pin.yPercent}%`,
              }}
              onClick={(e) => handlePinClick(e, pin.id)}
              title={`${pin.authorName}의 핀`}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
          <div className="text-gray-400">로딩 중...</div>
        </div>
      )}

      {isPlacingPin && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-30 bg-orange-500 text-white px-4 py-1.5 rounded-full text-sm font-medium shadow-lg pointer-events-none">
          화면을 클릭하여 핀을 추가하세요
        </div>
      )}
    </div>
  );
}

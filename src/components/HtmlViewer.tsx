"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Pin } from "@/lib/types";

interface HtmlViewerProps {
  projectId: string;
  fileId: string;
  pins: Pin[];
  authorName: string;
  activePinId: string | null;
  isPlacingPin: boolean;
  pinsHidden: boolean;
  onPinPlaced: (pin: Pin) => void;
  onPinConfirmed: (tempId: string, pin: Pin) => void;
  onPinFailed: (tempId: string) => void;
  onPinSelect: (pinId: string | null) => void;
}

// 클릭한 요소의 CSS 경로 생성 (id가 있으면 그걸 기준으로)
function cssPath(el: Element | null, doc: Document): string | null {
  if (!el || el.nodeType !== 1) return null;
  const esc = (s: string) =>
    typeof CSS !== "undefined" && CSS.escape ? CSS.escape(s) : s;
  if (el === doc.body) return "body";
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur.nodeType === 1 && cur !== doc.documentElement) {
    if (cur.id) {
      parts.unshift(`#${esc(cur.id)}`);
      break;
    }
    const tag = cur.tagName.toLowerCase();
    const parent: Element | null = cur.parentElement;
    if (!parent) {
      parts.unshift(tag);
      break;
    }
    const sameTag = Array.from(parent.children).filter(
      (c) => c.tagName === cur!.tagName
    );
    parts.unshift(
      sameTag.length > 1
        ? `${tag}:nth-of-type(${sameTag.indexOf(cur) + 1})`
        : tag
    );
    cur = parent;
  }
  return parts.join(" > ");
}

// 요소 식별용 텍스트 서명(공백 정규화 후 앞 80자)
function elText(el: Element): string {
  return (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80);
}

// 선택자 충돌(탭 등 같은 구조) 시 텍스트 서명으로 올바른 요소를 고른다
function findAnchoredEl(doc: Document, pin: Pin): Element | null {
  if (!pin.selector) return null;
  let list: NodeListOf<Element>;
  try {
    list = doc.querySelectorAll(pin.selector);
  } catch {
    return null;
  }
  const cands = Array.from(list);
  if (cands.length === 0) return null;
  if (!pin.anchorText) return cands[0];
  // 텍스트가 일치하는 요소만 유효(없으면 다른 탭 등으로 보고 없음 처리)
  return cands.find((el) => elText(el) === pin.anchorText) ?? null;
}

// 저장된 클릭 경로(탭/모달 등). 저장 순서(처음→끝) 그대로 반환 — 새로고침 후 순서대로 재생
function openerTrail(pin: Pin): string[] {
  if (!pin.openerSelector) return [];
  try {
    const parsed = JSON.parse(pin.openerSelector);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* 일반 문자열 */
  }
  return [pin.openerSelector];
}

export default function HtmlViewer({
  projectId,
  fileId,
  pins,
  authorName,
  activePinId,
  isPlacingPin,
  pinsHidden,
  onPinPlaced,
  onPinConfirmed,
  onPinFailed,
  onPinSelect,
}: HtmlViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pinRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  // 모달 등으로 숨겨진 요소를 강제 표시했을 때 되돌리기 위한 복원 함수들
  const revealRestoreRef = useRef<Array<() => void>>([]);
  // iframe 안 최근 클릭 경로(탭/모달 트리거 재생용, 최신이 마지막)
  const clickTrailRef = useRef<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState({ w: 1000, h: 700 });

  // 최신 값을 rAF 루프에서 읽기 위한 ref 미러
  const pinsRef = useRef<Pin[]>(pins);
  const sizeRef = useRef(size);
  const pinsHiddenRef = useRef(pinsHidden);
  pinsRef.current = pins;
  sizeRef.current = size;
  pinsHiddenRef.current = pinsHidden;

  // 컨테이너 크기 추적
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () =>
      setSize({ w: el.clientWidth || 1000, h: el.clientHeight || 700 });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 매 프레임 각 핀이 붙은 요소의 현재 위치로 핀을 이동/표시/숨김
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const doc = iframeRef.current?.contentDocument;
      const { w: cw, h: ch } = sizeRef.current;
      const view = iframeRef.current?.contentWindow;
      if (doc && view) {
        for (const pin of pinsRef.current) {
          const btn = pinRefs.current.get(pin.id);
          if (!btn) continue;

          if (pinsHiddenRef.current) {
            btn.style.display = "none";
            continue;
          }

          if (pin.selector) {
            const el = findAnchoredEl(doc, pin);
            if (!el) {
              btn.style.display = "none";
              continue;
            }
            const r = el.getBoundingClientRect();
            const cs = view.getComputedStyle(el);
            const hidden =
              (r.width === 0 && r.height === 0) ||
              cs.visibility === "hidden" ||
              cs.display === "none";
            // 앵커 지점(iframe = 실제 뷰포트 좌표, 스케일 없음)
            const x = r.left + (pin.offsetX ?? 0.5) * r.width;
            const y = r.top + (pin.offsetY ?? 0.5) * r.height;
            const inView = x >= 0 && x <= cw && y >= 0 && y <= ch;
            // 가림 검사: 그 지점의 최상단 요소가 앵커 요소가 아니면(모달 등에 가려짐) 숨김
            let occluded = false;
            if (!hidden && inView) {
              const topEl = doc.elementFromPoint(x, y);
              occluded =
                !topEl ||
                !(topEl === el || el.contains(topEl) || topEl.contains(el));
            }
            if (hidden || !inView || occluded) {
              btn.style.display = "none";
            } else {
              btn.style.display = "flex";
              btn.style.left = `${x}px`;
              btn.style.top = `${y}px`;
            }
          } else {
            // 레거시(좌표) 핀: 뷰포트 대비 %로 표시
            btn.style.display = "flex";
            btn.style.left = `${(pin.xPercent / 100) * cw}px`;
            btn.style.top = `${(pin.yPercent / 100) * ch}px`;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // 핀 선택 시: 숨겨진(모달 등) 요소를 강제 표시하고 그 위치로 스크롤
  useEffect(() => {
    // 이전에 강제 표시했던 것 되돌리기
    revealRestoreRef.current.forEach((restore) => restore());
    revealRestoreRef.current = [];

    if (!activePinId) return;
    const pin = pinsRef.current.find((p) => p.id === activePinId);
    if (!pin) return;

    let cancelled = false;
    const delay = (ms: number) =>
      new Promise<void>((res) => window.setTimeout(res, ms));
    const getDoc = () => iframeRef.current?.contentDocument ?? null;
    const getView = () => iframeRef.current?.contentWindow ?? null;
    const query = (sel: string): Element | null => {
      const d = getDoc();
      if (!d) return null;
      try {
        return d.querySelector(sel);
      } catch {
        return null;
      }
    };
    const isVisible = (el: Element | null): boolean => {
      const view = getView();
      if (!el || !view) return false;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false;
      const cs = view.getComputedStyle(el);
      return cs.visibility !== "hidden" && cs.display !== "none";
    };
    const forceReveal = (el: Element) => {
      const doc = getDoc();
      const view = getView();
      if (!doc || !view) return;
      const restores: Array<() => void> = [];
      let cur: HTMLElement | null = el as HTMLElement;
      while (cur && cur !== doc.body && cur !== doc.documentElement) {
        const cs = view.getComputedStyle(cur);
        const node = cur;
        if (cs.display === "none") {
          const prev = node.style.display;
          node.style.setProperty("display", "block", "important");
          restores.push(() => {
            node.style.display = prev;
          });
        }
        if (cs.visibility === "hidden") {
          const prev = node.style.visibility;
          node.style.setProperty("visibility", "visible", "important");
          restores.push(() => {
            node.style.visibility = prev;
          });
        }
        if (node.hasAttribute("hidden")) {
          node.removeAttribute("hidden");
          restores.push(() => node.setAttribute("hidden", ""));
        }
        if (node.getAttribute("aria-hidden") === "true") {
          node.setAttribute("aria-hidden", "false");
          restores.push(() => node.setAttribute("aria-hidden", "true"));
        }
        cur = cur.parentElement;
      }
      revealRestoreRef.current = restores;
    };

    const findTarget = (): Element | null => {
      const d = getDoc();
      return d ? findAnchoredEl(d, pin) : null;
    };

    const scrollToCoord = () => {
      const doc = getDoc();
      const view = getView();
      if (!doc) return;
      const scroller = (doc.scrollingElement ||
        doc.documentElement) as HTMLElement | null;
      if (!scroller) return;
      const top =
        (pin.yPercent / 100) * scroller.scrollHeight -
        (view?.innerHeight ?? scroller.clientHeight) / 2;
      const left =
        (pin.xPercent / 100) * scroller.scrollWidth -
        (view?.innerWidth ?? scroller.clientWidth) / 2;
      scroller.scrollTo({
        top: Math.max(0, top),
        left: Math.max(0, left),
        behavior: "smooth",
      });
    };

    (async () => {
      // 1) 현재 상태에 정확한 요소가 보이면 스크롤만(가장 빠름)
      let el = findTarget();
      if (el && isVisible(el)) {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        return;
      }

      // 2) 새로고침 없이 현재 상태에서 클릭 경로를 처음→끝 순서로 재생.
      //    "다음 단계(또는 최종 대상)가 이미 보이면" 그 단계는 이미 수행된 것으로 보고 건너뛴다
      //    → 이미 열린 detail의 행을 다시 눌러 닫아버리는 토글을 방지
      const trail = pin.selector ? openerTrail(pin) : [];
      for (let i = 0; i < trail.length; i++) {
        if (cancelled) return;
        const cur = findTarget();
        if (cur && isVisible(cur)) break;
        const nextSel = i + 1 < trail.length ? trail[i + 1] : null;
        const nextEl = nextSel ? query(nextSel) : null;
        if (nextEl && isVisible(nextEl)) continue; // 이 단계는 이미 도달함 → 건너뜀
        const step = query(trail[i]);
        if (step) {
          (step as HTMLElement).click();
          await delay(300);
          if (cancelled) return;
        }
      }

      // 3) 정확한 요소 → 없으면 텍스트 무시 첫 요소라도 → 스크롤
      el = findTarget() || (pin.selector ? query(pin.selector) : null);
      if (el) {
        if (!isVisible(el)) forceReveal(el);
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        return;
      }

      // 4) 끝내 못 찾으면 저장된 좌표로 대략 이동 — 무조건 화면 전환
      scrollToCoord();
    })();

    return () => {
      cancelled = true;
    };
  }, [activePinId]);

  // 언마운트 시 강제 표시 복원
  useEffect(() => {
    return () => {
      revealRestoreRef.current.forEach((restore) => restore());
      revealRestoreRef.current = [];
    };
  }, []);

  const handleOverlayClick = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isPlacingPin) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const ix = e.clientX - rect.left; // iframe 좌표계(스케일 없음)
      const iy = e.clientY - rect.top;

      let selector: string | null = null;
      let offsetX = 0.5;
      let offsetY = 0.5;
      let anchorText: string | null = null;
      const doc = iframeRef.current?.contentDocument;
      if (doc) {
        const el = doc.elementFromPoint(ix, iy);
        if (el) {
          selector = cssPath(el, doc);
          anchorText = elText(el);
          const r = el.getBoundingClientRect();
          if (r.width > 0) offsetX = (ix - r.left) / r.width;
          if (r.height > 0) offsetY = (iy - r.top) / r.height;
        }
      }

      const xPercent = rect.width ? (ix / rect.width) * 100 : 0;
      const yPercent = rect.height ? (iy / rect.height) * 100 : 0;
      const openerSelector = clickTrailRef.current.length
        ? JSON.stringify(clickTrailRef.current)
        : null;

      // 낙관적: 즉시 핀을 표시하고 저장은 백그라운드에서 처리(서버 왕복 대기 제거)
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: Pin = {
        id: tempId,
        fileId,
        xPercent,
        yPercent,
        selector,
        offsetX,
        offsetY,
        anchorText,
        openerSelector,
        authorName,
        createdAt: new Date().toISOString(),
        comments: [],
      };
      onPinPlaced(optimistic);
      onPinSelect(tempId);

      try {
        const res = await fetch(`/api/projects/${projectId}/pins`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            xPercent,
            yPercent,
            authorName,
            fileId,
            selector,
            offsetX,
            offsetY,
            anchorText,
            openerSelector,
          }),
        });
        if (res.ok) {
          onPinConfirmed(tempId, await res.json());
        } else {
          onPinFailed(tempId);
        }
      } catch {
        onPinFailed(tempId);
      }
    },
    [
      isPlacingPin,
      projectId,
      fileId,
      authorName,
      onPinPlaced,
      onPinConfirmed,
      onPinFailed,
      onPinSelect,
    ]
  );

  const handlePinClick = useCallback(
    (e: React.MouseEvent, pinId: string) => {
      e.stopPropagation();
      onPinSelect(activePinId === pinId ? null : pinId);
    },
    [activePinId, onPinSelect]
  );

  const handleLoad = useCallback(() => {
    setLoading(false);
    // iframe 내부 클릭을 기록해 모달 트리거를 추정 (캡처 단계)
    const doc = iframeRef.current?.contentDocument;
    if (doc) {
      doc.addEventListener(
        "click",
        (e) => {
          const target = e.target as Element | null;
          if (target && target.nodeType === 1) {
            const sel = cssPath(target, doc);
            if (sel) {
              const t = clickTrailRef.current;
              if (t[t.length - 1] !== sel) t.push(sel);
              if (t.length > 6) t.shift();
            }
          }
        },
        true
      );
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-white overflow-hidden"
    >
      <iframe
        ref={iframeRef}
        src={`/api/projects/${projectId}/files/${fileId}`}
        sandbox="allow-scripts allow-same-origin"
        onLoad={handleLoad}
        title="HTML Preview"
        className="w-full h-full border-0"
      />

      {/* 핀 오버레이: 컨테이너(뷰포트) 크기 고정 레이어. rAF가 위치를 갱신 */}
      <div
        className={`absolute inset-0 ${
          isPlacingPin ? "cursor-crosshair" : "pointer-events-none"
        }`}
        onClick={handleOverlayClick}
      >
        {pins.map((pin) => (
          <button
            key={pin.id}
            ref={(node) => {
              if (node) pinRefs.current.set(pin.id, node);
              else pinRefs.current.delete(pin.id);
            }}
            className={`pointer-events-auto absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md transition-transform hover:scale-110 ${
              activePinId === pin.id
                ? "bg-orange-500 ring-2 ring-orange-300 scale-110 z-20"
                : "bg-blue-500 hover:bg-blue-600 z-10"
            }`}
            style={{ left: 0, top: 0, display: "none" }}
            onClick={(e) => handlePinClick(e, pin.id)}
            title={`${pin.authorName}의 댓글`}
          >
            {pin.authorName[0]?.toUpperCase() ?? "?"}
          </button>
        ))}
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
          <div className="text-gray-400">로딩 중...</div>
        </div>
      )}

      {isPlacingPin && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-30 bg-orange-500 text-white px-4 py-1.5 rounded-full text-sm font-medium shadow-lg pointer-events-none">
          요소를 클릭하여 댓글을 남기세요
        </div>
      )}
    </div>
  );
}

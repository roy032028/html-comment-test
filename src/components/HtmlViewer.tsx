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
  onPinMoved: (pinId: string, patch: Partial<Pin>) => void;
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

// 비교용 정규화: 숫자·기호·공백 제거 → 금액/수량 등 동적 값이 바뀌어도 같은 요소로 인식
function normText(s: string): string {
  return (s || "").replace(/[\s\d.,%₩()\-]/g, "");
}

// 문맥 서명: 요소 자체 텍스트가 없으면(아이콘 등) 가까운 조상의 텍스트를 사용 → 아이콘도 주변 텍스트로 식별
function ctxText(el: Element): string {
  let a: Element | null = el;
  for (let i = 0; a && i < 6; i++) {
    const t = normText(a.textContent || "");
    if (t) return t.slice(0, 60);
    a = a.parentElement;
  }
  return "";
}

// 후보 요소가 이 핀의 앵커와 일치하는지(문맥 서명 우선, 레거시는 요소 텍스트 비교도 허용)
function matchesAnchor(el: Element, pin: Pin): boolean {
  if (!pin.anchorText) return true;
  return (
    ctxText(el) === pin.anchorText ||
    normText(elText(el)) === normText(pin.anchorText)
  );
}

// 클릭 경로의 한 단계: 선택자(힌트) + 라벨 텍스트(견고한 매칭용) + 태그
type TrailStep = { s: string | null; x: string; g: string };

// 라벨 정규화(공백 정리 후 앞 120자) — 클릭 대상 식별/매칭 공용
function normLabel(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim().slice(0, 120);
}

// 두 CSS 경로의 "꼬리에서부터 일치하는 세그먼트 수" — 텍스트 중복 시 구조로 후보 선별
function selectorSuffixScore(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  const pa = a.split(" > ");
  const pb = b.split(" > ");
  let n = 0;
  while (n < pa.length && n < pb.length && pa[pa.length - 1 - n] === pb[pb.length - 1 - n]) n++;
  return n;
}

// 클릭 재생 대상으로 삼을 "행동 가능한" 요소 셀렉터
// (스위치/체크박스/입력 등 텍스트가 없는 컨트롤도 포함)
const ACTIONABLE =
  "button,[role='button'],a,[role='tab'],[role='menuitem'],[role='switch'],[role='checkbox'],input,select,label,tr,td,li,[onclick],[tabindex]";

// 텍스트가 없는 컨트롤(스위치 등)의 라벨 대체값
function controlLabel(el: Element): string {
  const a = el as HTMLElement;
  return normLabel(
    a.getAttribute?.("aria-label") ||
      a.getAttribute?.("title") ||
      a.getAttribute?.("placeholder") ||
      a.getAttribute?.("name") ||
      ""
  );
}

// openerSelector에 저장된 정보 파싱: 클릭 경로(trail)와 "모달 안에서 찍었는지"(inModal)
// 하위호환: 옛 형식(문자열/문자열 배열/{t:string[]})도 TrailStep으로 승격
function parseOpener(pin: Pin): { trail: TrailStep[]; inModal: boolean } {
  if (!pin.openerSelector) return { trail: [], inModal: false };
  const toStep = (v: unknown): TrailStep | null => {
    if (typeof v === "string") return { s: v, x: "", g: "" };
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      return {
        s: typeof o.s === "string" ? o.s : null,
        x: typeof o.x === "string" ? o.x : "",
        g: typeof o.g === "string" ? o.g : "",
      };
    }
    return null;
  };
  const toTrail = (arr: unknown[]): TrailStep[] =>
    arr.map(toStep).filter((s): s is TrailStep => !!s);
  try {
    const p = JSON.parse(pin.openerSelector);
    if (Array.isArray(p)) return { trail: toTrail(p), inModal: false };
    if (p && typeof p === "object")
      return { trail: Array.isArray(p.t) ? toTrail(p.t) : [], inModal: !!p.m };
  } catch {
    /* 일반 문자열(아주 오래된 형식) */
  }
  return { trail: [{ s: pin.openerSelector, x: "", g: "" }], inModal: false };
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
  // 문맥 서명으로 일치하는 것만(다른 탭/화면의 같은 구조 요소 오배치 방지)
  return cands.find((el) => matchesAnchor(el, pin)) ?? null;
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
  onPinMoved,
  onPinSelect,
}: HtmlViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pinRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  // 모달 등으로 숨겨진 요소를 강제 표시했을 때 되돌리기 위한 복원 함수들
  const revealRestoreRef = useRef<Array<() => void>>([]);
  // iframe 안 최근 클릭 경로(탭/모달 트리거 재생용, 최신이 마지막)
  const clickTrailRef = useRef<TrailStep[]>([]);
  // 경로 재생 중에는 프로그램 클릭이 기록되지 않도록 잠근다
  const isReplayingRef = useRef(false);
  // 핀 드래그 이동 상태
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
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

          // 드래그 중인 핀은 위치를 드래그가 제어 → rAF는 건너뜀
          if (dragRef.current?.moved && dragRef.current.id === pin.id) continue;

          let placed = false;
          if (pin.selector) {
            const el = findAnchoredEl(doc, pin);
            if (el) {
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
              // 가림 검사: 그 지점의 최상단 요소가 앵커 요소가 아니면(모달 등에 가려짐)
              let occluded = false;
              if (!hidden && inView) {
                const topEl = doc.elementFromPoint(x, y);
                occluded =
                  !topEl ||
                  !(topEl === el || el.contains(topEl) || topEl.contains(el));
              }
              if (!hidden && inView && !occluded) {
                btn.style.display = "flex";
                btn.style.left = `${x}px`;
                btn.style.top = `${y}px`;
                placed = true;
              }
            }
          }
          if (!placed) {
            // 요소를 못 쓰면(컬럼 사라짐/다른 탭/모달 닫힘) 깔끔하게 숨김.
            // 단, 선택자가 없는 레거시 핀만 좌표로 표시.
            if (pin.selector) {
              btn.style.display = "none";
            } else {
              btn.style.display = "flex";
              btn.style.left = `${(pin.xPercent / 100) * cw}px`;
              btn.style.top = `${(pin.yPercent / 100) * ch}px`;
            }
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
    // "지금 화면에 실제로 떠 있는가" 판정.
    // 닫힌 드로어/모달은 DOM에 남아 transform으로 화면 밖에 밀려 있을 뿐이라
    // isVisible로는 '보인다'가 되어버린다 → 뷰포트 교차 + fixed/sticky 여부로 가려낸다.
    const isOnScreen = (el: Element | null): boolean => {
      const view = getView();
      if (!el || !view || !isVisible(el)) return false;
      const r = el.getBoundingClientRect();
      const vw = view.innerWidth;
      const vh = view.innerHeight;
      const intersects =
        r.right > 0 && r.left < vw && r.bottom > 0 && r.top < vh;
      if (intersects) return true;
      // 뷰포트 밖: 일반 흐름이면 스크롤로 닿으니 OK, fixed/sticky 오버레이면 숨겨진 것으로 간주
      let a: Element | null = el;
      const body = getDoc()?.body;
      while (a && a !== body) {
        const pos = view.getComputedStyle(a).position;
        if (pos === "fixed" || pos === "sticky") return false;
        a = a.parentElement;
      }
      return true;
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

    // 지금 화면에 실제로 떠 있는(뷰포트 안/스크롤로 닿는) 대상 요소. 텍스트 일치 우선.
    const pickVisible = (): Element | null => {
      const d = getDoc();
      if (!d || !pin.selector) return null;
      let list: NodeListOf<Element>;
      try {
        list = d.querySelectorAll(pin.selector);
      } catch {
        return null;
      }
      const vis = Array.from(list).filter((e) => isOnScreen(e));
      if (vis.length === 0) return null;
      if (!pin.anchorText) return vis[0];
      // 문맥 서명으로 일치하는 것만(다른 탭/화면의 같은 구조 요소 오인 방지)
      return vis.find((e) => matchesAnchor(e, pin)) ?? null;
    };

    const goTo = (el: Element) => {
      if (!isVisible(el)) forceReveal(el);
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    };

    // 트레일 한 단계를 현재 DOM에서 다시 찾는다.
    // 절대경로가 안 맞아도(새로고침 후 구조 변화) 라벨 텍스트로 재탐색 → 견고.
    // 같은 텍스트가 여러 개면(예: 표마다 "미확정" 배지) 구조(태그·선택자 꼬리)로 정확히 고른다.
    const resolveStep = (step: TrailStep): Element | null => {
      const d = getDoc();
      // 1) 선택자 힌트가 지금 유효하고 보이면 그대로 사용(가장 정확)
      if (step.s) {
        const el = query(step.s);
        if (el && isVisible(el)) return el;
      }
      // 텍스트가 일치하는 후보들 중 구조(태그·선택자 꼬리)로 가장 가까운 하나를 고른다
      const pick = (cands: Element[]): Element | null => {
        if (cands.length === 0) return null;
        if (cands.length === 1) return cands[0];
        const scored = cands.map((e) => ({
          e,
          tagOk: e.tagName.toLowerCase() === step.g ? 1 : 0,
          suf: step.s ? selectorSuffixScore(cssPath(e, d!), step.s) : 0,
          len: (e.textContent || "").length,
        }));
        scored.sort((a, b) => b.tagOk - a.tagOk || b.suf - a.suf || a.len - b.len);
        return scored[0].e;
      };
      const matchByText = (els: Element[]): Element[] => {
        let c = els.filter((e) => normLabel(e.textContent || "") === step.x);
        if (c.length === 0 && step.x.length > 1)
          c = els.filter((e) => normLabel(e.textContent || "").startsWith(step.x));
        return c;
      };
      if (step.x && d) {
        // 2) 표준 클릭 요소(버튼/링크/탭/행 등)에서 라벨 텍스트로 탐색
        const actionable = Array.from(d.querySelectorAll(ACTIONABLE)).filter(
          (e) => isVisible(e)
        );
        const hit = pick(matchByText(actionable));
        if (hit) return hit;
        // 2.5) 표준 요소로 못 찾으면 임의 태그(예: <div onclick>)까지 넓혀 재탐색.
        //      큰 컨테이너 오클릭 방지를 위해 자식 3개 이하의 말단 요소만 후보로.
        const leafish = Array.from(d.querySelectorAll<Element>("*")).filter(
          (e) => e.childElementCount <= 3 && isVisible(e)
        );
        const hit2 = pick(matchByText(leafish));
        if (hit2) return hit2;
      }
      // 3) 최후: 보이지 않아도 선택자 매치
      return step.s ? query(step.s) : null;
    };

    // 안전한 클릭: SVG 등 .click()이 없는 요소도 처리. 가까운 버튼/링크로 위임
    const clickEl = (el: Element) => {
      const t =
        (el.closest(
          "button,[role='button'],[role='switch'],[role='checkbox'],a,[onclick],[tabindex]"
        ) as HTMLElement | null) ?? (el as HTMLElement);
      if (typeof t.click === "function") {
        t.click();
        return;
      }
      t.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    };

    const waitFor = async (
      test: () => Element | null,
      timeout: number
    ): Promise<Element | null> => {
      const end = Date.now() + timeout;
      for (;;) {
        if (cancelled) return null;
        const el = test();
        if (el) return el;
        if (Date.now() >= end) return null;
        await delay(70);
      }
    };
    const reloadIframe = () =>
      new Promise<void>((resolve) => {
        const ifr = iframeRef.current;
        if (!ifr) return resolve();
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          ifr.removeEventListener("load", finish);
          resolve();
        };
        ifr.addEventListener("load", finish);
        try {
          ifr.contentWindow?.location.reload();
        } catch {
          ifr.src = ifr.src;
        }
        window.setTimeout(finish, 6000);
      });

    const { trail } = parseOpener(pin);
    const log = (...a: unknown[]) => console.log("[핀이동]", ...a);
    log("선택", { trail, sel: pin.selector, txt: pin.anchorText });

    (async () => {
      // 1) 지금 "실제로 보이면" 즉시 스크롤 (새로고침 없음).
      //    DOM엔 있으나 숨겨진(닫힌 모달/드로어 등) 경우는 재구성이 필요하므로 통과시킨다.
      const visibleNow = pickVisible();
      log("1) 지금 보임?", !!visibleNow);
      if (visibleNow) {
        goTo(visibleNow);
        return;
      }

      // 2) 안 보이면(다른 탭/닫힌 모달·드로어/드롭다운 등) 초기화 후 경로를 재생해 상태를 재구성
      log("2) reload 시작");
      await reloadIframe();
      if (cancelled) return;
      // 고정 대기 대신 앱이 렌더될 때까지 적응형으로 대기(준비되면 즉시 진행)
      await waitFor(() => {
        const d = getDoc();
        return d && d.body && d.body.childElementCount > 0 && d.readyState !== "loading"
          ? d.body
          : null;
      }, 5000);
      if (cancelled) return;
      log("2) reload 후 보임?", !!pickVisible(), "trail 길이", trail.length);
      // 새로고침 직후 바로 보이면(기본 목록 댓글) 재생 안 함 → 엉뚱한 클릭 없음
      if (!pickVisible() && trail.length) {
        // 기록된 클릭을 순서대로 재생(탭 전환 → 상세 진입 → 모달/드로어 열기 등).
        // 각 단계는 라벨 텍스트로 재탐색하므로 새 DOM 구조에서도 찾아낸다.
        isReplayingRef.current = true;
        // 전체 재생 예산: 노이즈 많은 경로에서도 과도한 대기(버벅임) 방지
        const replayDeadline = Date.now() + 9000;
        try {
          for (let i = 0; i < trail.length; i++) {
            if (cancelled) return;
            if (pickVisible()) break;
            if (Date.now() > replayDeadline) {
              log("  재생 예산 초과 → 중단");
              break;
            }
            const step = trail[i];
            // 직전 클릭의 렌더가 반영될 때까지 짧게 대기 후 요소 확보
            // (못 찾는 노이즈 단계에서 오래 매달리지 않도록 타임아웃을 줄임)
            const el = await waitFor(() => resolveStep(step), 1200);
            log(`  단계 ${i} 클릭:`, step.x || step.s, "찾음?", !!el);
            if (cancelled) return;
            if (el) {
              clickEl(el);
              const next = i + 1 < trail.length ? trail[i + 1] : null;
              // 대상이 보이거나 다음 단계 요소가 준비되면 즉시 진행
              await waitFor(
                () => pickVisible() ?? (next ? resolveStep(next) : pickVisible()),
                1800
              );
            }
          }
          await waitFor(pickVisible, 2500);
        } finally {
          isReplayingRef.current = false;
        }
        if (cancelled) return;
      }

      // 3) 결과: 보이면 스크롤 / DOM엔 있으나 숨었으면 강제 표시 후 스크롤 / 그래도 없으면 좌표
      const el = pickVisible() ?? findTarget();
      log("3) 최종 요소?", !!el, "보임?", !!pickVisible());
      if (el) {
        goTo(el);
        return;
      }
      scrollToCoord();
    })();

    return () => {
      cancelled = true;
      isReplayingRef.current = false;
    };
  }, [activePinId]);

  // 언마운트 시 강제 표시 복원
  useEffect(() => {
    return () => {
      revealRestoreRef.current.forEach((restore) => restore());
      revealRestoreRef.current = [];
    };
  }, []);

  // 화면 좌표(clientX/Y)의 지점을 iframe 요소 앵커 정보로 계산 (핀 찍기/드래그 이동 공용)
  const computeAnchorAt = useCallback((clientX: number, clientY: number) => {
    const cont = containerRef.current;
    const doc = iframeRef.current?.contentDocument;
    const win = iframeRef.current?.contentWindow;
    if (!cont) return null;
    const rect = cont.getBoundingClientRect();
    const ix = clientX - rect.left; // iframe 좌표계(스케일 없음)
    const iy = clientY - rect.top;

    let selector: string | null = null;
    let offsetX = 0.5;
    let offsetY = 0.5;
    let anchorText: string | null = null;
    let inModal = false;
    if (doc) {
      const el = doc.elementFromPoint(ix, iy);
      if (el) {
        selector = cssPath(el, doc);
        anchorText = ctxText(el);
        const r = el.getBoundingClientRect();
        if (r.width > 0) offsetX = (ix - r.left) / r.width;
        if (r.height > 0) offsetY = (iy - r.top) / r.height;
        if (win) {
          const vw = win.innerWidth;
          const vh = win.innerHeight;
          let a: HTMLElement | null = el.parentElement;
          while (a) {
            const cs = win.getComputedStyle(a);
            if (cs.position === "fixed" || cs.position === "absolute") {
              const z = parseInt(cs.zIndex || "0", 10);
              const ar = a.getBoundingClientRect();
              const large = ar.width > vw * 0.5 && ar.height > vh * 0.4;
              if (cs.position === "fixed" || large || (Number.isFinite(z) && z >= 10)) {
                inModal = true;
                break;
              }
            }
            a = a.parentElement;
          }
        }
      }
    }
    const xPercent = rect.width ? (ix / rect.width) * 100 : 0;
    const yPercent = rect.height ? (iy / rect.height) * 100 : 0;
    const openerSelector = JSON.stringify({
      v: 2,
      t: clickTrailRef.current,
      m: inModal,
    });
    return { selector, offsetX, offsetY, anchorText, xPercent, yPercent, openerSelector };
  }, []);

  const handleOverlayClick = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isPlacingPin) return;
      const a = computeAnchorAt(e.clientX, e.clientY);
      if (!a) return;

      // 낙관적: 즉시 핀을 표시하고 저장은 백그라운드에서 처리
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: Pin = {
        id: tempId,
        fileId,
        xPercent: a.xPercent,
        yPercent: a.yPercent,
        selector: a.selector,
        offsetX: a.offsetX,
        offsetY: a.offsetY,
        anchorText: a.anchorText,
        openerSelector: a.openerSelector,
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
          body: JSON.stringify({ ...a, authorName, fileId }),
        });
        if (res.ok) onPinConfirmed(tempId, await res.json());
        else onPinFailed(tempId);
      } catch {
        onPinFailed(tempId);
      }
    },
    [
      isPlacingPin,
      computeAnchorAt,
      projectId,
      fileId,
      authorName,
      onPinPlaced,
      onPinConfirmed,
      onPinFailed,
      onPinSelect,
    ]
  );

  // 핀 드래그: 이동하면 그 지점 요소로 재부착, 안 움직이면 선택
  const handlePinPointerDown = useCallback(
    (e: React.PointerEvent, pinId: string) => {
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        id: pinId,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
      };
    },
    []
  );

  const handlePinPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 5)
      d.moved = true;
    if (d.moved) {
      const btn = pinRefs.current.get(d.id);
      const cont = containerRef.current;
      if (btn && cont) {
        const r = cont.getBoundingClientRect();
        btn.style.display = "flex";
        btn.style.left = `${e.clientX - r.left}px`;
        btn.style.top = `${e.clientY - r.top}px`;
      }
    }
  }, []);

  const handlePinPointerUp = useCallback(
    async (e: React.PointerEvent, pinId: string) => {
      const d = dragRef.current;
      dragRef.current = null;
      if (!d) return;
      if (!d.moved) {
        onPinSelect(activePinId === pinId ? null : pinId);
        return;
      }
      // 드래그 종료 → 그 지점 요소로 재부착
      const a = computeAnchorAt(e.clientX, e.clientY);
      if (!a) return;
      onPinMoved(pinId, a);
      try {
        await fetch(`/api/pins/${pinId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(a),
        });
      } catch {
        /* 실패해도 로컬은 갱신됨 */
      }
    },
    [activePinId, computeAnchorAt, onPinMoved, onPinSelect]
  );

  const handleLoad = useCallback(() => {
    setLoading(false);
    // iframe 내부 클릭을 기록해 모달 트리거를 추정 (캡처 단계)
    const doc = iframeRef.current?.contentDocument;
    if (doc) {
      doc.addEventListener(
        "click",
        (e) => {
          // 재생 중 발생한 프로그램 클릭은 기록하지 않음(경로 오염 방지)
          if (isReplayingRef.current) return;
          const target = e.target as Element | null;
          if (!target || target.nodeType !== 1) return;
          // 클릭 지점에서 가장 가까운 "행동 가능한" 요소(버튼/탭/행 등)를 트리거로 본다
          const act =
            (target.closest(ACTIONABLE) as Element | null) ?? target;
          const step: TrailStep = {
            s: cssPath(act, doc),
            // 텍스트 라벨(견고 매칭용). 없으면 aria-label 등으로 대체
            x: normLabel(act.textContent || "") || controlLabel(act),
            g: act.tagName.toLowerCase(),
          };
          if (!step.s && !step.x) return;
          const t = clickTrailRef.current;
          const last = t[t.length - 1];
          // 같은 요소 연속 클릭은 한 번만
          if (!last || last.s !== step.s || last.x !== step.x) t.push(step);
          // 깊은 탐색 경로도 담을 수 있게 넉넉히 보관(재생은 시간 예산으로 별도 제한)
          if (t.length > 40) t.shift();
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
            className={`pointer-events-auto absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md transition-transform hover:scale-110 cursor-grab active:cursor-grabbing touch-none ${
              activePinId === pin.id
                ? "bg-orange-500 ring-2 ring-orange-300 scale-110 z-20"
                : "bg-blue-500 hover:bg-blue-600 z-10"
            }`}
            style={{ left: 0, top: 0, display: "none" }}
            onPointerDown={(e) => handlePinPointerDown(e, pin.id)}
            onPointerMove={handlePinPointerMove}
            onPointerUp={(e) => handlePinPointerUp(e, pin.id)}
            title={`${pin.authorName}의 댓글 (드래그로 이동)`}
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

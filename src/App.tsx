import React, { useRef, useEffect, useState, useCallback } from 'react';
import { FILMS, SHEETS, DECADE_FIRST_FILM } from './data/films';
import { DecadeTabId } from './types/film';
import {
  getTapeDimensions,
  getRelativeIndex,
  calcTapeTransform,
  getActiveFilmIndex,
  getShortestLoopTarget,
  smoothstep,
} from './utils/shelfMath';
import { TopBar } from './components/TopBar';
import { DecadeTabs } from './components/DecadeTabs';
import { Shelf3D, ShelfHandle } from './components/Shelf3D';
import { Caption } from './components/Caption';
import { PlayRing } from './components/PlayRing';
import { NavigationArrows } from './components/NavigationArrows';
import { Footer } from './components/Footer';
import { Cursor, CursorState } from './components/Cursor';
import { DetailModal } from './components/DetailModal';
import { PaperGrain } from './components/PaperGrain';

export default function App() {
  // Noon in Ashes is index 5, starting in middle set: s = 5 + 12 = 17
  const sRef = useRef<number>(17);
  const targetRef = useRef<number>(17);
  const shelfRef = useRef<ShelfHandle>(null);

  const [activeFilmIndex, setActiveFilmIndex] = useState<number>(5);
  const [captionDir, setCaptionDir] = useState<number>(0);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [activeCoverRect, setActiveCoverRect] = useState<DOMRect | null>(null);

  // Responsive dimensions
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [dimensions, setDimensions] = useState(() => {
    const isMobile = window.innerWidth <= 767;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const H = isMobile
      ? Math.min(vw * 0.6, vh * 0.4)
      : Math.min(vh * 0.46, vw * 0.31);
    return getTapeDimensions(H);
  });

  // Pointer & Motion state
  const mouseRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const cursorSmoothRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [cursorPos, setCursorPos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [cursorState, setCursorState] = useState<CursorState>('default');

  const tiltRef = useRef({ x: 0, y: 0 });
  const hoverVirtualRef = useRef<number>(-1);
  const liftsRef = useRef<number[]>(new Array(36).fill(0));
  const isDraggingRef = useRef<boolean>(false);
  const hasDraggedRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ clientX: number; target0: number }>({ clientX: 0, target0: 17 });
  const wheelTimerRef = useRef<number | null>(null);

  const [playRingScale, setPlayRingScale] = useState<number>(1);

  // Preload image sheets
  useEffect(() => {
    Object.values(SHEETS).forEach((sheet) => {
      const img = new Image();
      img.src = sheet.url;
    });
  }, []);

  // Resize handler
  useEffect(() => {
    const updateSize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setViewport({ w, h });
      const isMobile = w <= 767;
      const H = isMobile ? Math.min(w * 0.6, h * 0.4) : Math.min(h * 0.46, w * 0.31);
      setDimensions(getTapeDimensions(H));
    };
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Update target safely
  const setTarget = useCallback((newTarget: number) => {
    const currentT = targetRef.current;
    const dir = Math.sign(newTarget - currentT) || 1;
    setCaptionDir(dir);
    targetRef.current = newTarget;
  }, []);

  // Open detail view
  const openDetail = useCallback(() => {
    targetRef.current = Math.round(targetRef.current);
    const rect = shelfRef.current?.getActiveCoverRect() || null;
    setActiveCoverRect(rect);
    setIsDetailOpen(true);
  }, []);

  // Close detail view
  const closeDetail = useCallback(() => {
    const rect = shelfRef.current?.getActiveCoverRect() || null;
    setActiveCoverRect(rect);
    setIsDetailOpen(false);
  }, []);

  // Decade tab selection
  const handleSelectDecade = useCallback(
    (decadeId: DecadeTabId) => {
      const firstFilm = DECADE_FIRST_FILM[decadeId];
      const shortestTarget = getShortestLoopTarget(targetRef.current, firstFilm, 12);
      setTarget(shortestTarget);
    },
    [setTarget]
  );

  // Tape click
  const handleTapeClick = useCallback(
    (virtualIndex: number) => {
      if (hasDraggedRef.current) {
        hasDraggedRef.current = false;
        return;
      }
      const r = getRelativeIndex(virtualIndex, sRef.current, 36);
      if (Math.abs(r) < 0.5) {
        openDetail();
      } else {
        const nextTarget = Math.round(targetRef.current + r);
        setTarget(nextTarget);
      }
    },
    [openDetail, setTarget]
  );

  // Wheel scrubbing
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (isDetailOpen) return;
      e.preventDefault();

      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const step = (delta / (dimensions.ws + dimensions.gap)) * 0.5;
      targetRef.current += step;

      const dir = Math.sign(step) || 1;
      setCaptionDir(dir);

      if (wheelTimerRef.current !== null) {
        window.clearTimeout(wheelTimerRef.current);
      }
      wheelTimerRef.current = window.setTimeout(() => {
        targetRef.current = Math.round(targetRef.current);
      }, 160);
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleWheel);
      if (wheelTimerRef.current !== null) window.clearTimeout(wheelTimerRef.current);
    };
  }, [isDetailOpen, dimensions.ws, dimensions.gap]);

  // Pointer drag on shelf section
  useEffect(() => {
    const sectionEl = shelfRef.current?.getSectionElement();
    if (!sectionEl) return;

    const onPointerDown = (e: PointerEvent) => {
      if (isDetailOpen) return;
      // Only primary mouse button or touch
      if (e.button !== 0 && e.pointerType === 'mouse') return;

      isDraggingRef.current = true;
      hasDraggedRef.current = false;
      dragStartRef.current = {
        clientX: e.clientX,
        target0: targetRef.current,
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };

      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.clientX;
      if (Math.abs(dx) > 5) {
        hasDraggedRef.current = true;
      }
      const tapeStep = dimensions.ws + dimensions.gap;
      targetRef.current = dragStartRef.current.target0 - dx / tapeStep;
    };

    const onPointerUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        targetRef.current = Math.round(targetRef.current);
      }
    };

    sectionEl.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      sectionEl.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [isDetailOpen, dimensions.ws, dimensions.gap]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isDetailOpen) {
        if (e.key === 'Escape') closeDetail();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setTarget(Math.round(targetRef.current) - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setTarget(Math.round(targetRef.current) + 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        openDetail();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDetailOpen, closeDetail, setTarget, openDetail]);

  // Main Motion Engine requestAnimationFrame loop
  useEffect(() => {
    let lastTime = performance.now();
    let animId: number;

    const loop = (now: number) => {
      animId = requestAnimationFrame(loop);
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(0.05, Math.max(0.001, rawDt));

      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // 1. Spring physics for scroll s towards target T
      const isDragging = isDraggingRef.current;
      const k = prefersReducedMotion ? 100 : isDragging ? 18 : 5.2;
      const diff = targetRef.current - sRef.current;

      if (Math.abs(diff) < 1e-4 || prefersReducedMotion) {
        sRef.current = targetRef.current;
      } else {
        sRef.current += diff * (1 - Math.exp(-k * dt));
      }

      // Normalise if s drifts beyond 4 loops
      if (sRef.current > 48 || sRef.current < -48) {
        const loops = Math.floor(sRef.current / 12);
        sRef.current -= loops * 12;
        targetRef.current -= loops * 12;
      }

      // 2. Caption active film index check
      const currentActiveFilm = getActiveFilmIndex(sRef.current, 12);
      if (currentActiveFilm !== activeFilmIndex) {
        setActiveFilmIndex(currentActiveFilm);
      }

      // 3. Smooth cursor position (1 - e^(-16*dt))
      const cursorLerp = 1 - Math.exp(-16 * dt);
      cursorSmoothRef.current.x += (mouseRef.current.x - cursorSmoothRef.current.x) * cursorLerp;
      cursorSmoothRef.current.y += (mouseRef.current.y - cursorSmoothRef.current.y) * cursorLerp;
      setCursorPos({ x: cursorSmoothRef.current.x, y: cursorSmoothRef.current.y });

      // 4. Cursor state & Tilt towards mouse
      const W = window.innerWidth;
      const H = dimensions.H;
      const d = dimensions.d;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const shelfCenterY = window.innerHeight / 2;

      const isAlmostSettled = Math.abs(targetRef.current - sRef.current) < 0.3;
      const onCover =
        Math.abs(mx - W / 2) <= 0.55 * d &&
        Math.abs(my - shelfCenterY) <= 0.55 * H &&
        !isDetailOpen &&
        isAlmostSettled;

      let targetTiltY = 0;
      let targetTiltX = 0;

      if (onCover) {
        targetTiltY = ((mx - W / 2) / (0.55 * d)) * 9;
        targetTiltX = -((my - shelfCenterY) / (H / 2)) * 6;
      } else {
        targetTiltY = ((mx - W / 2) / W) * 5;
        targetTiltX = 0;
      }

      const tiltLerp = 1 - Math.exp(-7 * dt);
      tiltRef.current.x += (targetTiltX - tiltRef.current.x) * tiltLerp;
      tiltRef.current.y += (targetTiltY - tiltRef.current.y) * tiltLerp;

      // Cursor state resolution
      if (isDetailOpen) {
        setCursorState('default');
      } else if (onCover) {
        setCursorState('open');
      } else if (hoverVirtualRef.current !== -1) {
        const hoverR = getRelativeIndex(hoverVirtualRef.current, sRef.current, 36);
        if (Math.abs(hoverR) > 0.5) {
          setCursorState('spine');
        } else {
          setCursorState('default');
        }
      } else {
        // Check if cursor is over a button or link
        const hoveredEl = document.elementFromPoint(mx, my);
        if (hoveredEl && (hoveredEl.closest('button') || hoveredEl.closest('a'))) {
          setCursorState('btn');
        } else {
          setCursorState('default');
        }
      }

      // 5. Play ring scale calculation
      const ringScale = smoothstep(Math.max(0, 1 - Math.abs(targetRef.current - sRef.current) * 3));
      setPlayRingScale(ringScale);

      // 6. Update hover lifts (1 - e^(-12*dt))
      const liftLerp = 1 - Math.exp(-12 * dt);
      for (let v = 0; v < 36; v++) {
        const r = getRelativeIndex(v, sRef.current, 36);
        const targetLift = hoverVirtualRef.current === v && Math.abs(r) > 0.5 ? 1 : 0;
        liftsRef.current[v] += (targetLift - liftsRef.current[v]) * liftLerp;
      }

      // 7. Calculate and apply all tape transforms
      const transforms = [];
      for (let v = 0; v < 36; v++) {
        const r = getRelativeIndex(v, sRef.current, 36);
        const res = calcTapeTransform(
          r,
          dimensions.H,
          dimensions.ws,
          dimensions.d,
          dimensions.gap,
          W,
          tiltRef.current.x,
          tiltRef.current.y,
          liftsRef.current[v]
        );
        transforms.push({
          transform: res.transformString,
          zIndex: res.zIndex,
          visible: res.visible,
          spineShade: res.spineShade,
          coverShade: res.coverShade,
        });
      }

      shelfRef.current?.updateTapes(transforms);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [dimensions, activeFilmIndex, isDetailOpen]);

  // Current active film and active decade
  const currentFilm = FILMS[activeFilmIndex] || FILMS[5];
  const activeVirtualIndex = (Math.round(sRef.current) % 36 + 36) % 36;

  // Play ring position: centered on cover's lower-left corner
  const playRingLeft = viewport.w / 2 - 0.5 * dimensions.d - 6;
  const playRingTop = viewport.h / 2 + 0.36 * dimensions.H;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[var(--paper)]">
      {/* 1. Paper grain full-screen overlay */}
      <PaperGrain />

      {/* 2. Top bar */}
      <TopBar onBackClick={() => setTarget(17)} />

      {/* 3. Decade tabs */}
      <DecadeTabs
        activeDecade={currentFilm.decade}
        onSelectDecade={handleSelectDecade}
        H={dimensions.H}
      />

      {/* 4. 3D Shelf with 36 VHS tapes */}
      <Shelf3D
        ref={shelfRef}
        films={FILMS}
        H={dimensions.H}
        ws={dimensions.ws}
        d={dimensions.d}
        activeVirtualIndex={activeVirtualIndex}
        onTapeClick={handleTapeClick}
        onTapePointerEnter={(v) => {
          hoverVirtualRef.current = v;
        }}
        onTapePointerLeave={(v) => {
          if (hoverVirtualRef.current === v) {
            hoverVirtualRef.current = -1;
          }
        }}
      />

      {/* 5. Play ring button on active cover */}
      <PlayRing
        left={playRingLeft}
        top={playRingTop}
        scale={playRingScale}
        onClick={openDetail}
        isOpen={isDetailOpen}
      />

      {/* 6. Caption with directional masked slide */}
      <Caption
        film={currentFilm}
        direction={captionDir}
        H={dimensions.H}
      />

      {/* 7. Previous and Next arrows */}
      <NavigationArrows
        onPrev={() => setTarget(Math.round(targetRef.current) - 1)}
        onNext={() => setTarget(Math.round(targetRef.current) + 1)}
        H={dimensions.H}
      />

      {/* 8. Footer */}
      <Footer />

      {/* 9. Detail modal with ink-blot SVG poster reveal */}
      <DetailModal
        film={currentFilm}
        isOpen={isDetailOpen}
        onClose={closeDetail}
        coverRect={activeCoverRect}
      />

      {/* 10. Custom pointer cursor */}
      <Cursor cursorPos={cursorPos} state={cursorState} />
    </div>
  );
}

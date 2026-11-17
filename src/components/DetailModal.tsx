import React, { useRef, useEffect, useState } from 'react';
import { FilmData } from '../types/film';
import { SHEETS } from '../data/films';

interface DetailModalProps {
  film: FilmData;
  isOpen: boolean;
  onClose: () => void;
  coverRect: DOMRect | null;
}

const BLOBS = [
  { id: 1, cx: 150, cy: 330, delay: 0 },
  { id: 2, cx: 340, cy: 600, delay: 120 },
  { id: 3, cx: 250, cy: 120, delay: 220 },
  { id: 4, cx: 90, cy: 760, delay: 300 },
  { id: 5, cx: 400, cy: 250, delay: 360 },
  { id: 6, cx: 260, cy: 860, delay: 420 },
  { id: 7, cx: 230, cy: 470, delay: 180 },
];

export const DetailModal: React.FC<DetailModalProps> = ({ film, isOpen, onClose, coverRect }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const textLinesRef = useRef<(HTMLDivElement | null)[]>([]);
  const circlesRef = useRef<(SVGCircleElement | null)[]>([]);
  const animRef = useRef<Animation | null>(null);
  const inkRafRef = useRef<number | null>(null);
  const [isRendered, setIsRendered] = useState(false);

  // Cover image crop dimensions for SVG <image>
  const coverSheet = SHEETS[film.coverCrop.sheetId];
  const { x, y, w, h } = film.coverCrop;
  const W = coverSheet.w;
  const H_sheet = coverSheet.h;
  const imgX = (-x * 474) / w;
  const imgY = (-y * 900) / h;
  const imgW = (W * 474) / w;
  const imgH = (H_sheet * 900) / h;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Open / Close animation flow
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      setIsRendered(true);
      dialog.style.visibility = 'visible';

      // Reset blobs
      circlesRef.current.forEach(c => {
        if (c) c.setAttribute('r', prefersReducedMotion ? '720' : '0');
      });

      // Calculate initial inset from cover rect
      let startInset = 'inset(20% 20% 20% 20% round 3px)';
      let originX = '50%';
      let originY = '50%';

      if (coverRect) {
        const top = Math.max(0, coverRect.top);
        const right = Math.max(0, window.innerWidth - coverRect.right);
        const bottom = Math.max(0, window.innerHeight - coverRect.bottom);
        const left = Math.max(0, coverRect.left);
        startInset = `inset(${top}px ${right}px ${bottom}px ${left}px round 3px)`;
        originX = `${coverRect.left + coverRect.width / 2}px`;
        originY = `${coverRect.top + coverRect.height / 2}px`;
      }

      dialog.style.transformOrigin = `${originX} ${originY}`;

      const openDuration = prefersReducedMotion ? 1 : 1050;

      // Animate paper sheet growing out of cover
      if (animRef.current) animRef.current.cancel();

      animRef.current = dialog.animate(
        [
          {
            clipPath: startInset,
            transform: 'rotate(-4.5deg)',
          },
          {
            clipPath: 'inset(0px 0px 0px 0px round 0px)',
            transform: 'rotate(0deg)',
          },
        ],
        {
          duration: openDuration,
          easing: 'cubic-bezier(0.76, 0, 0.18, 1)',
          fill: 'both',
        }
      );

      // Animate text lines rising
      textLinesRef.current.forEach((line, idx) => {
        if (!line) return;
        const lineDelay = prefersReducedMotion ? 0 : 620 + idx * 75;
        const lineDuration = prefersReducedMotion ? 1 : 900;

        line.animate(
          [
            { transform: 'translateY(110%)' },
            { transform: 'translateY(0%)' },
          ],
          {
            duration: lineDuration,
            delay: lineDelay,
            easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
            fill: 'both',
          }
        );
      });

      // Ink bleed animation
      if (inkRafRef.current) cancelAnimationFrame(inkRafRef.current);

      if (prefersReducedMotion) {
        circlesRef.current.forEach(c => {
          if (c) c.setAttribute('r', '720');
        });
      } else {
        const inkStartTime = performance.now() + 520;
        const inkDuration = 1250;

        const stepBlobs = (now: number) => {
          if (now < inkStartTime) {
            inkRafRef.current = requestAnimationFrame(stepBlobs);
            return;
          }

          let allDone = true;
          BLOBS.forEach((blob, i) => {
            const circle = circlesRef.current[i];
            if (!circle) return;

            const elapsed = now - (inkStartTime + blob.delay);
            if (elapsed <= 0) {
              circle.setAttribute('r', '0');
              allDone = false;
            } else if (elapsed < inkDuration) {
              allDone = false;
              const p = Math.min(1, elapsed / inkDuration);
              // ease-out cubic: 1 - (1 - p)^3
              const eased = 1 - Math.pow(1 - p, 3);
              const rVal = eased * 720;
              circle.setAttribute('r', rVal.toFixed(2));
            } else {
              circle.setAttribute('r', '720');
            }
          });

          if (!allDone || now - inkStartTime < 2400) {
            inkRafRef.current = requestAnimationFrame(stepBlobs);
          }
        };

        inkRafRef.current = requestAnimationFrame(stepBlobs);
      }
    } else if (isRendered) {
      // Close sequence
      if (inkRafRef.current) cancelAnimationFrame(inkRafRef.current);

      let targetInset = 'inset(20% 20% 20% 20% round 3px)';
      if (coverRect) {
        const top = Math.max(0, coverRect.top);
        const right = Math.max(0, window.innerWidth - coverRect.right);
        const bottom = Math.max(0, window.innerHeight - coverRect.bottom);
        const left = Math.max(0, coverRect.left);
        targetInset = `inset(${top}px ${right}px ${bottom}px ${left}px round 3px)`;
      }

      const closeDuration = prefersReducedMotion ? 1 : 850;

      if (animRef.current) animRef.current.cancel();

      animRef.current = dialog.animate(
        [
          {
            clipPath: 'inset(0px 0px 0px 0px round 0px)',
            transform: 'rotate(0deg)',
          },
          {
            clipPath: targetInset,
            transform: 'rotate(-4.5deg)',
          },
        ],
        {
          duration: closeDuration,
          easing: 'cubic-bezier(0.76, 0, 0.18, 1)',
          fill: 'both',
        }
      );

      animRef.current.onfinish = () => {
        dialog.style.visibility = 'hidden';
        setIsRendered(false);
        if (animRef.current) animRef.current.cancel();
      };
    }
  }, [isOpen, coverRect]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${film.title} Details`}
      className="detail-modal"
      data-open={isOpen ? 'true' : 'false'}
    >
      {/* Top bar with close button & logo */}
      <div className="fixed top-0 left-0 right-0 h-[84px] max-md:h-[64px] px-8 max-md:px-4 flex items-center justify-between z-70 pointer-events-none">
        <button
          type="button"
          onClick={onClose}
          className="box lbl cursor-pointer pointer-events-auto hover:bg-[var(--ink)] hover:text-[var(--sheet)] transition-colors duration-200"
          aria-label="Close dialog"
        >
          CLOSE / 閉じる
        </button>

        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-[5px] text-[var(--cobalt)] pointer-events-auto select-none">
          <span className="font-sc font-bold text-[22px] max-md:text-[17px] leading-none tracking-[0.04em]">
            莱昂·瓦萨里
          </span>
          <span
            className="lbl text-[9px] max-md:text-[7.5px] leading-none tracking-[0.34em] pl-[0.34em]"
            style={{ letterSpacing: '0.34em' }}
          >
            LEON VASARI
          </span>
        </div>

        <div className="w-[100px] max-md:hidden" />
      </div>

      {/* Main detail content grid */}
      <div className="w-full min-h-screen grid grid-cols-2 max-md:flex max-md:flex-col gap-[4vw] max-md:gap-6 pt-[110px] max-md:pt-[84px] pb-[56px] max-md:pb-10 px-[7vw] max-md:px-[22px] items-center">
        {/* Poster (on mobile, moves first per prompt) */}
        <div className="flex items-center justify-center order-2 max-md:order-1 h-[min(100%,78vh)] max-md:h-[46svh] w-full">
          <div className="h-full aspect-[474/900] max-w-full shadow-2xl relative">
            <svg
              viewBox="0 0 474 900"
              className="w-full h-full block"
              aria-hidden="true"
            >
              <defs>
                <filter id="ink-filter" x="-50%" y="-50%" width="200%" height="200%">
                  <feTurbulence
                    type="fractalNoise"
                    baseFrequency="0.011"
                    numOctaves="3"
                    seed="7"
                    result="noise"
                  />
                  <feDisplacementMap
                    in="SourceGraphic"
                    in2="noise"
                    scale="120"
                    xChannelSelector="R"
                    yChannelSelector="G"
                  />
                </filter>

                <clipPath id="poster-clip">
                  <rect x="0" y="0" width="474" height="900" rx="3" ry="3" />
                </clipPath>

                <mask
                  id="ink-mask"
                  maskUnits="userSpaceOnUse"
                  x="-200"
                  y="-200"
                  width="874"
                  height="1300"
                >
                  <rect x="-200" y="-200" width="874" height="1300" fill="black" />
                  <g filter="url(#ink-filter)" fill="white">
                    {BLOBS.map((blob, idx) => (
                      <circle
                        key={blob.id}
                        ref={el => {
                          circlesRef.current[idx] = el;
                        }}
                        cx={blob.cx}
                        cy={blob.cy}
                        r="0"
                      />
                    ))}
                  </g>
                </mask>
              </defs>

              {/* The clipped cover crop image, masked by ink blobs */}
              <g clipPath="url(#poster-clip)" mask="url(#ink-mask)">
                <image
                  href={coverSheet.url}
                  x={imgX}
                  y={imgY}
                  width={imgW}
                  height={imgH}
                  preserveAspectRatio="none"
                />
              </g>
            </svg>
          </div>
        </div>

        {/* Info Column */}
        <div className="flex flex-col justify-center order-1 max-md:order-2 max-w-[520px] gap-[18px]">
          {/* 1. Subtitle */}
          <div className="mask-line">
            <div
              ref={el => {
                textLinesRef.current[0] = el;
              }}
              className="lbl text-[var(--cobalt)] font-medium"
            >
              {film.romaji} / {film.kanji}
            </div>
          </div>

          {/* 2. Title */}
          <div className="mask-line">
            <h1
              ref={el => {
                textLinesRef.current[1] = el;
              }}
              className="font-serif text-[clamp(44px,5.4vw,84px)] max-md:text-[42px] leading-[1] tracking-[-0.025em] text-[var(--ink)]"
            >
              {film.title}
            </h1>
          </div>

          {/* 3. Meta */}
          <div className="mask-line">
            <div
              ref={el => {
                textLinesRef.current[2] = el;
              }}
              className="lbl text-[var(--muted)] font-medium"
            >
              {film.year} / {film.genre.toUpperCase()} / {film.minutes} MIN
            </div>
          </div>

          {/* 4. Synopsis */}
          <div className="mask-line">
            <p
              ref={el => {
                textLinesRef.current[3] = el;
              }}
              className="font-serif text-[17px] max-md:text-[16px] leading-[1.5] max-w-[42ch] text-[var(--ink)]"
            >
              {film.synopsis}
            </p>
          </div>

          {/* 5. Italic credit */}
          <div className="mask-line">
            <p
              ref={el => {
                textLinesRef.current[4] = el;
              }}
              className="font-serif italic text-[15px] text-[var(--muted)]"
            >
              Written and directed by Leon Vasari. 監督作品
            </p>
          </div>

          {/* 6. Watch button */}
          <div className="mask-line pt-[10px]">
            <div
              ref={el => {
                textLinesRef.current[5] = el;
              }}
            >
              <button
                type="button"
                onClick={() => {
                  const btn = document.getElementById('watch-btn');
                  if (btn) {
                    btn.textContent = 'STREAMING NOW / 再生中…';
                    setTimeout(() => {
                      if (btn) btn.textContent = 'WATCH THE FILM / 映画を見る';
                    }, 2500);
                  }
                }}
                id="watch-btn"
                className="box lbl h-[44px] px-5 border-[var(--cobalt)] text-[var(--cobalt)] hover:bg-[var(--cobalt)] hover:text-white transition-colors duration-200 cursor-pointer select-none"
              >
                WATCH THE FILM / 映画を見る
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

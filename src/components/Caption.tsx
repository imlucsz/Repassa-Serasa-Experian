import React, { useRef, useEffect } from 'react';
import { FilmData } from '../types/film';

interface CaptionProps {
  film: FilmData;
  direction: number; // +1 right, -1 left, 0 init
  H: number;
}

export const Caption: React.FC<CaptionProps> = ({ film, direction, H }) => {
  const titleContainerRef = useRef<HTMLDivElement>(null);
  const subtitleContainerRef = useRef<HTMLDivElement>(null);
  const yearContainerRef = useRef<HTMLDivElement>(null);
  const currentFilmIdRef = useRef<string>(film.id);

  const swapLine = (
    container: HTMLDivElement | null,
    text: string,
    dir: number,
    className: string,
    isInitial: boolean
  ) => {
    if (!container) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (isInitial || prefersReducedMotion || dir === 0) {
      container.innerHTML = '';
      const span = document.createElement('span');
      span.className = className;
      span.textContent = text;
      span.style.display = 'block';
      container.appendChild(span);
      return;
    }

    // Existing spans
    const oldSpans = Array.from(container.children) as HTMLElement[];
    oldSpans.forEach(oldSpan => {
      if (oldSpan.dataset.leaving === 'true') return;
      oldSpan.dataset.leaving = 'true';
      oldSpan.style.position = 'absolute';
      oldSpan.style.top = '0';
      oldSpan.style.left = '0';
      oldSpan.style.width = '100%';

      const anim = oldSpan.animate(
        [
          { transform: 'translateY(0%)' },
          { transform: `translateY(${-dir * 105}%)` },
        ],
        {
          duration: 650,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          fill: 'both',
        }
      );
      anim.onfinish = () => {
        if (oldSpan.parentNode === container) {
          container.removeChild(oldSpan);
        }
      };
    });

    // New span
    const newSpan = document.createElement('span');
    newSpan.className = className;
    newSpan.textContent = text;
    newSpan.style.display = 'block';
    newSpan.style.position = 'relative';
    newSpan.style.width = '100%';
    container.appendChild(newSpan);

    newSpan.animate(
      [
        { transform: `translateY(${dir * 105}%)` },
        { transform: 'translateY(0%)' },
      ],
      {
        duration: 650,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        fill: 'both',
      }
    );
  };

  useEffect(() => {
    const isInitial = currentFilmIdRef.current === film.id && !titleContainerRef.current?.children.length;
    currentFilmIdRef.current = film.id;

    swapLine(
      titleContainerRef.current,
      film.title,
      direction,
      'font-serif text-[31px] max-md:text-[24px] leading-[1.12] tracking-[-0.01em] text-center text-[var(--ink)] block select-none',
      isInitial
    );

    const subText = `${film.romaji} / ${film.kanji}`;
    swapLine(
      subtitleContainerRef.current,
      subText,
      direction,
      'lbl font-medium text-[var(--cobalt)] text-center block select-none',
      isInitial
    );

    swapLine(
      yearContainerRef.current,
      film.year.toString(),
      direction,
      'font-sans font-medium text-[11px] tracking-[0.08em] text-[var(--ink)] text-center block select-none',
      isInitial
    );
  }, [film.id, direction]);

  return (
    <div
      aria-live="polite"
      className="fixed left-1/2 -translate-x-1/2 flex flex-col items-center gap-[9px] pointer-events-none z-30 select-none w-[min(92vw,760px)]"
      style={{
        top: `calc(50% + ${H / 2}px + 30px)`,
      }}
    >
      {/* Title */}
      <div ref={titleContainerRef} className="mask-line w-full text-center min-h-[38px] max-md:min-h-[30px]" />

      {/* Subtitle */}
      <div ref={subtitleContainerRef} className="mask-line w-full text-center min-h-[16px]" />

      {/* Year */}
      <div ref={yearContainerRef} className="mask-line w-full text-center min-h-[16px]" />
    </div>
  );
};

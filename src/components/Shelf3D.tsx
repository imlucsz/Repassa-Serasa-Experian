import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { FilmData } from '../types/film';
import { SHEETS } from '../data/films';
import { getCropBackgroundStyle } from '../utils/shelfMath';

export interface ShelfHandle {
  getActiveCoverRect: () => DOMRect | null;
  updateTapes: (
    tapeTransforms: {
      transform: string;
      zIndex: number;
      visible: boolean;
      spineShade: number;
      coverShade: number;
    }[]
  ) => void;
  getSectionElement: () => HTMLElement | null;
}

interface Shelf3DProps {
  films: FilmData[];
  H: number;
  ws: number;
  d: number;
  activeVirtualIndex: number;
  onTapeClick: (virtualIndex: number, e: React.MouseEvent) => void;
  onTapePointerEnter: (virtualIndex: number) => void;
  onTapePointerLeave: (virtualIndex: number) => void;
}

export const Shelf3D = forwardRef<ShelfHandle, Shelf3DProps>(({
  films,
  H,
  ws,
  d,
  activeVirtualIndex,
  onTapeClick,
  onTapePointerEnter,
  onTapePointerLeave,
}, ref) => {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const tapeElsRef = useRef<(HTMLDivElement | null)[]>([]);
  const spineElsRef = useRef<(HTMLDivElement | null)[]>([]);
  const coverElsRef = useRef<(HTMLDivElement | null)[]>([]);

  // 3 copies = 36 tapes
  const tapes = Array.from({ length: 36 }, (_, v) => {
    const filmIndex = v % 12;
    const film = films[filmIndex];
    return {
      virtualIndex: v,
      film,
    };
  });

  useImperativeHandle(ref, () => ({
    getActiveCoverRect: () => {
      const activeCoverEl = coverElsRef.current[activeVirtualIndex];
      if (activeCoverEl) {
        return activeCoverEl.getBoundingClientRect();
      }
      return null;
    },
    updateTapes: (transforms) => {
      for (let i = 0; i < transforms.length; i++) {
        const el = tapeElsRef.current[i];
        const data = transforms[i];
        if (!el || !data) continue;

        if (!data.visible) {
          if (el.style.visibility !== 'hidden') {
            el.style.visibility = 'hidden';
          }
          continue;
        }

        if (el.style.visibility !== 'visible') {
          el.style.visibility = 'visible';
        }

        el.style.transform = data.transform;
        el.style.zIndex = data.zIndex.toString();

        const spEl = spineElsRef.current[i];
        if (spEl) {
          spEl.style.setProperty('--shade', data.spineShade.toFixed(3));
        }

        const cvEl = coverElsRef.current[i];
        if (cvEl) {
          cvEl.style.setProperty('--shade', data.coverShade.toFixed(3));
        }
      }
    },
    getSectionElement: () => sectionRef.current,
  }), [activeVirtualIndex]);

  return (
    <section
      ref={sectionRef}
      aria-label="Filmography shelf"
      className="shelf-section"
      style={{
        top: `calc(50% - ${H / 2}px - 40px)`,
        height: `${H + 80}px`,
        '--ws': `${ws}px`,
        '--d': `${d}px`,
        '--H': `${H}px`,
      } as React.CSSProperties}
    >
      <div ref={stageRef} className="stage-origin">
        {tapes.map(({ virtualIndex, film }) => {
          const spineSheet = SHEETS[film.spineCrop.sheetId];
          const coverSheet = SHEETS[film.coverCrop.sheetId];
          const spineStyle = getCropBackgroundStyle(film.spineCrop, spineSheet);
          const coverStyle = getCropBackgroundStyle(film.coverCrop, coverSheet);

          return (
            <div
              key={virtualIndex}
              ref={el => {
                tapeElsRef.current[virtualIndex] = el;
              }}
              data-virtual-index={virtualIndex}
              className="tape cursor-pointer"
              onClick={(e) => onTapeClick(virtualIndex, e)}
              onPointerEnter={() => onTapePointerEnter(virtualIndex)}
              onPointerLeave={() => onTapePointerLeave(virtualIndex)}
            >
              {/* Spine face */}
              <div
                ref={el => {
                  spineElsRef.current[virtualIndex] = el;
                }}
                className="tape-face sp"
                style={spineStyle}
              />

              {/* Cover face */}
              <div
                ref={el => {
                  coverElsRef.current[virtualIndex] = el;
                }}
                className="tape-face cv"
                style={coverStyle}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
});

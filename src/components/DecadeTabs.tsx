import React, { useRef, useEffect, useState } from 'react';
import { DecadeTabId } from '../types/film';

interface DecadeTabsProps {
  activeDecade: string; // '1950s' | '1960s' | '1970s' | '1980s'
  onSelectDecade: (decade: DecadeTabId) => void;
  H: number;
}

const TABS: { id: DecadeTabId; label: string }[] = [
  { id: 'all', label: 'ALL / すべて' },
  { id: '1950s', label: '1950s' },
  { id: '1960s', label: '1960s' },
  { id: '1970s', label: '1970s' },
  { id: '1980s', label: '1980s' },
];

export const DecadeTabs: React.FC<DecadeTabsProps> = ({ activeDecade, onSelectDecade, H }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number; opacity: number }>({
    left: 0,
    width: 0,
    opacity: 0,
  });

  useEffect(() => {
    // "ALL" is never highlighted per prompt specification:
    // "always the decade of the active film. For example, Noon in Ashes (1971) highlights '1970s'. 'ALL' is never highlighted."
    const activeBtn = tabRefs.current[activeDecade];
    if (activeBtn && containerRef.current) {
      setIndicatorStyle({
        left: activeBtn.offsetLeft,
        width: activeBtn.offsetWidth,
        opacity: 1,
      });
    } else {
      setIndicatorStyle(prev => ({ ...prev, opacity: 0 }));
    }
  }, [activeDecade]);

  return (
    <nav
      aria-label="Decades"
      className="fixed left-1/2 -translate-x-1/2 z-30 pointer-events-auto"
      style={{
        top: `calc(50% - ${H / 2}px - 86px)`,
      }}
    >
      <div ref={containerRef} className="relative flex items-center">
        {/* Cobalt sliding indicator */}
        <div
          className="absolute top-0 h-[23px] bg-[var(--cobalt)] pointer-events-none z-0"
          style={{
            transform: `translateX(${indicatorStyle.left}px)`,
            width: `${indicatorStyle.width}px`,
            opacity: indicatorStyle.opacity,
            transition: 'transform 0.6s var(--ease), width 0.6s var(--ease), opacity 0.3s var(--ease)',
          }}
        />

        {TABS.map((tab, idx) => {
          const isActive = tab.id === activeDecade && tab.id !== 'all';
          return (
            <button
              key={tab.id}
              ref={el => {
                tabRefs.current[tab.id] = el;
              }}
              type="button"
              onClick={() => onSelectDecade(tab.id)}
              className={`box lbl h-[23px] px-[11px] max-md:px-[7px] max-md:text-[9px] relative z-10 cursor-pointer select-none whitespace-nowrap transition-colors duration-450 ${
                idx > 0 ? '-ml-[1px]' : ''
              } ${isActive ? 'text-white' : 'text-[var(--ink)] hover:text-[var(--cobalt)]'}`}
              aria-current={isActive ? 'true' : undefined}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

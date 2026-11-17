import React from 'react';

interface NavigationArrowsProps {
  onPrev: () => void;
  onNext: () => void;
  H: number;
}

export const NavigationArrows: React.FC<NavigationArrowsProps> = ({ onPrev, onNext, H }) => {
  return (
    <>
      <button
        type="button"
        onClick={onPrev}
        aria-label="Previous film"
        className="fixed left-5 max-md:left-1.5 w-11 h-11 flex items-center justify-center text-[var(--ink)] hover:text-[var(--cobalt)] transition-colors duration-200 cursor-pointer z-30 select-none"
        style={{
          top: `calc(50% + ${H / 2}px + 40px)`,
        }}
      >
        <svg width="18" height="10" viewBox="0 0 18 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 1 L1 5 L5 9" />
          <path d="M1 5 L17 5" />
        </svg>
      </button>

      <button
        type="button"
        onClick={onNext}
        aria-label="Next film"
        className="fixed right-5 max-md:right-1.5 w-11 h-11 flex items-center justify-center text-[var(--ink)] hover:text-[var(--cobalt)] transition-colors duration-200 cursor-pointer z-30 select-none"
        style={{
          top: `calc(50% + ${H / 2}px + 40px)`,
        }}
      >
        <svg width="18" height="10" viewBox="0 0 18 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M13 1 L17 5 L13 9" />
          <path d="M1 5 L17 5" />
        </svg>
      </button>
    </>
  );
};

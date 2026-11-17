import React from 'react';

interface TopBarProps {
  onBackClick?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onBackClick }) => {
  return (
    <header className="fixed top-0 left-0 right-0 h-[84px] max-md:h-[64px] px-8 max-md:px-4 grid grid-cols-[1fr_auto_1fr] items-center z-30 pointer-events-none">
      <div className="justify-self-start pointer-events-auto">
        <button
          type="button"
          onClick={onBackClick}
          className="box lbl cursor-pointer hover:bg-[var(--ink)] hover:text-[var(--paper)] transition-colors duration-200"
          aria-label="Back"
        >
          BACK / 戻る
        </button>
      </div>

      <div className="flex flex-col items-center gap-[5px] text-[var(--cobalt)] pointer-events-auto select-none">
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

      <div className="justify-self-end pointer-events-auto max-md:hidden">
        <span className="lbl text-[var(--ink)]">
          CAREER 1958年〜1989年
        </span>
      </div>
    </header>
  );
};

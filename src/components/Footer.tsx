import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="fixed bottom-[26px] max-md:bottom-[18px] left-8 max-md:left-4 right-8 max-md:right-4 flex justify-between items-center z-30 pointer-events-none select-none">
      <span className="lbl text-[var(--ink)] text-[10.5px] max-md:text-[9px]">
        © LEON VASARI. ALL RIGHTS RESERVED.
      </span>

      <div className="flex items-center gap-2 pointer-events-auto">
        <a
          href="#facebook"
          onClick={e => e.preventDefault()}
          className="lbl text-[var(--ink)] hover:text-[var(--cobalt)] transition-colors duration-200 no-underline text-[10.5px] max-md:text-[9px]"
        >
          FB
        </a>
        <span className="lbl text-[var(--ink)] text-[10.5px] max-md:text-[9px]">/</span>
        <a
          href="#twitter"
          onClick={e => e.preventDefault()}
          className="lbl text-[var(--ink)] hover:text-[var(--cobalt)] transition-colors duration-200 no-underline text-[10.5px] max-md:text-[9px]"
        >
          TW
        </a>
      </div>
    </footer>
  );
};

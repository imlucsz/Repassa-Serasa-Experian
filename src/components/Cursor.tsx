import React, { useRef, useEffect } from 'react';

export type CursorState = 'default' | 'spine' | 'btn' | 'open';

interface CursorProps {
  cursorPos: { x: number; y: number };
  state: CursorState;
}

export const Cursor: React.FC<CursorProps> = ({ cursorPos, state }) => {
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate3d(${cursorPos.x}px, ${cursorPos.y}px, 0)`;
    }
  }, [cursorPos.x, cursorPos.y]);

  return (
    <div
      ref={cursorRef}
      className="custom-cursor"
      data-state={state}
      aria-hidden="true"
    >
      <div className="cursor-ring">
        <div className="cursor-dot" />
        <div className="cursor-label flex flex-col items-center">
          <span>OPEN</span>
          <span>開く</span>
        </div>
      </div>
    </div>
  );
};

import React from 'react';

interface PlayRingProps {
  left: number;
  top: number;
  scale: number;
  onClick: () => void;
  isOpen: boolean;
}

export const PlayRing: React.FC<PlayRingProps> = ({ left, top, scale, onClick, isOpen }) => {
  const actualScale = isOpen ? 0 : scale;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open film"
      className="play-ring cursor-pointer"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        transform: `translate(-50%, -50%) scale(${actualScale.toFixed(3)})`,
        pointerEvents: actualScale > 0.1 ? 'auto' : 'none',
        opacity: actualScale > 0.05 ? 1 : 0,
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="currentColor"
        style={{ transform: 'translateX(2px)' }}
        aria-hidden="true"
      >
        <polygon points="2,1 10,6 2,11" />
      </svg>
    </button>
  );
};

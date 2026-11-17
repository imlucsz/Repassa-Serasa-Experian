import { CropBox, SheetDef } from '../types/film';

/**
 * Standard cubic smoothstep: x * x * (3 - 2 * x) clamped to [0, 1]
 */
export function smoothstep(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x * x * (3 - 2 * x);
}

/**
 * Continuous smooth step function B(r) for horizontal tape spreading.
 * When |r| < 1: (r + sin(π*r)/π) / 2
 * otherwise: sign(r) * 0.5
 */
export function B(r: number): number {
  if (Math.abs(r) < 1) {
    return (r + Math.sin(Math.PI * r) / Math.PI) / 2;
  }
  return r > 0 ? 0.5 : -0.5;
}

/**
 * Horizontal placement formula F(r) from prompt:
 * x = F(r) = r * (ws + gap) + (d - ws + 1.6 * gap) * B(r)
 */
export function F(r: number, ws: number, gap: number, d: number): number {
  return r * (ws + gap) + (d - ws + 1.6 * gap) * B(r);
}

/**
 * Compute relative index r = (v - s) modulo count (36), normalized to [-count/2, count/2)
 */
export function getRelativeIndex(v: number, s: number, count = 36): number {
  let r = (v - s) % count;
  if (r > count / 2) r -= count;
  if (r <= -count / 2) r += count;
  return r;
}

/**
 * Tape dimensions given real pixel height H
 */
export function getTapeDimensions(H: number) {
  const ws = (H * 142) / 840;
  const d = (H * 474) / 900;
  const gap = H * 0.03;
  return { H, ws, d, gap };
}

/**
 * Openness of tape based on relative position r
 */
export function getOpenness(r: number): number {
  return smoothstep(Math.max(0, 1 - Math.abs(r)));
}

/**
 * Active film index in [0, 11] given scroll s
 */
export function getActiveFilmIndex(s: number, total = 12): number {
  const rounded = Math.round(s);
  return ((rounded % total) + total) % total;
}

/**
 * Find the closest target on the endless loop for a desired film index
 */
export function getShortestLoopTarget(currentT: number, targetFilmIndex: number, total = 12): number {
  const currentBase = Math.round(currentT);
  const currentFilm = ((currentBase % total) + total) % total;
  let diff = (targetFilmIndex - currentFilm) % total;
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  return currentBase + diff;
}

/**
 * Calculate 3D transforms and shading for a tape
 */
export interface TapeTransformResult {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  zIndex: number;
  openness: number;
  spineShade: number;
  coverShade: number;
  visible: boolean;
  transformString: string;
}

export function calcTapeTransform(
  r: number,
  H: number,
  ws: number,
  d: number,
  gap: number,
  viewportW: number,
  tiltX: number,
  tiltY: number,
  lift: number
): TapeTransformResult {
  const x = F(r, ws, gap, d);
  const isOffscreen = Math.abs(x) > viewportW / 2 + 1.5 * d;
  if (isOffscreen) {
    return {
      x,
      y: 0,
      z: 0,
      rx: 0,
      ry: 0,
      rz: 0,
      zIndex: 1,
      openness: 0,
      spineShade: 0,
      coverShade: 0.5,
      visible: false,
      transformString: `translate3d(${x.toFixed(1)}px, 0px, 0px)`,
    };
  }

  const o = getOpenness(r);
  const ry = -90 * o + tiltY * o;
  const rx = tiltX * o;
  const rz = -4.5 * o;
  const z = o * 0.2 * H;
  const y = -o * 0.025 * H - lift * 0.045 * H;
  const zIndex = Math.round(100 - Math.abs(r) * 4);
  const spineShade = o * 0.55;
  const coverShade = (1 - o) * 0.5;

  const transformString = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px) rotateZ(${rz.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;

  return {
    x,
    y,
    z,
    rx,
    ry,
    rz,
    zIndex,
    openness: o,
    spineShade,
    coverShade,
    visible: true,
    transformString,
  };
}

/**
 * CSS background crop calculation
 */
export function getCropBackgroundStyle(crop: CropBox, sheet: SheetDef) {
  const sizeX = (sheet.w / crop.w) * 100;
  const sizeY = (sheet.h / crop.h) * 100;
  const posX = (crop.x / (sheet.w - crop.w)) * 100;
  const posY = (crop.y / (sheet.h - crop.h)) * 100;
  return {
    backgroundImage: `url("${sheet.url}")`,
    backgroundSize: `${sizeX}% ${sizeY}%`,
    backgroundPosition: `${posX}% ${posY}%`,
    backgroundRepeat: 'no-repeat',
  };
}

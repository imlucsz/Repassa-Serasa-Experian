import test from 'node:test';
import assert from 'node:assert/strict';
import {
  smoothstep,
  B,
  F,
  getRelativeIndex,
  getTapeDimensions,
  getOpenness,
  getActiveFilmIndex,
  getShortestLoopTarget,
  calcTapeTransform,
} from './shelfMath';

test('smoothstep boundary and midpoint values', () => {
  assert.equal(smoothstep(0), 0);
  assert.equal(smoothstep(1), 1);
  assert.equal(smoothstep(-0.5), 0);
  assert.equal(smoothstep(1.5), 1);
  assert.equal(smoothstep(0.5), 0.5);
});

test('B(r) continuous smooth step', () => {
  assert.equal(B(0), 0);
  // for r = 1, should be 0.5
  assert.equal(B(1), 0.5);
  // for r = -1, should be -0.5
  assert.equal(B(-1), -0.5);
  assert.equal(B(2), 0.5);
  assert.equal(B(-2), -0.5);
  // symmetry check
  assert.ok(Math.abs(B(0.3) + B(-0.3)) < 1e-6);
});

test('horizontal placement formula F(r)', () => {
  const { H, ws, d, gap } = getTapeDimensions(400);
  assert.equal(F(0, ws, gap, d), 0);
  // At r = 1: 1*(ws+gap) + (d - ws + 1.6*gap)*0.5
  const expectedR1 = (ws + gap) + (d - ws + 1.6 * gap) * 0.5;
  assert.ok(Math.abs(F(1, ws, gap, d) - expectedR1) < 1e-6);
  // Negative symmetry
  assert.ok(Math.abs(F(-1, ws, gap, d) + expectedR1) < 1e-6);
});

test('relativeIndex correctly wraps 36 items into [-18, 18)', () => {
  assert.equal(getRelativeIndex(17, 17), 0);
  assert.equal(getRelativeIndex(18, 17), 1);
  assert.equal(getRelativeIndex(16, 17), -1);
  // Loop wrap
  assert.equal(getRelativeIndex(0, 35), 1);
  assert.equal(getRelativeIndex(35, 0), -1);
});

test('getActiveFilmIndex maps scroll positions to 0-11 films', () => {
  assert.equal(getActiveFilmIndex(5), 5);
  assert.equal(getActiveFilmIndex(17), 5); // 17 = 12 + 5 (Noon in Ashes)
  assert.equal(getActiveFilmIndex(29), 5); // 29 = 24 + 5
  assert.equal(getActiveFilmIndex(-7), 5);
  assert.equal(getActiveFilmIndex(0), 0);
  assert.equal(getActiveFilmIndex(11.9), 0);
  assert.equal(getActiveFilmIndex(11.2), 11);
});

test('getShortestLoopTarget finds closest decade or film target', () => {
  // Noon in Ashes is index 5, starting at s = 17
  // Target 1950s (index 0, Valley): shortest from 17 is 12 (diff -5), rather than 24 (diff +7)
  assert.equal(getShortestLoopTarget(17, 0), 12);
  // Target 1980s (index 9, Long Tide): from 17 to 9 diff is +4 -> 21
  assert.equal(getShortestLoopTarget(17, 9), 21);
});

test('calcTapeTransform computes active tape and offscreen culling', () => {
  const { H, ws, d, gap } = getTapeDimensions(400);
  // Center active tape (r = 0)
  const active = calcTapeTransform(0, H, ws, d, gap, 1440, 0, 0, 0);
  assert.equal(active.visible, true);
  assert.equal(active.openness, 1);
  assert.equal(active.ry, -90);
  assert.equal(active.rz, -4.5);
  assert.equal(active.zIndex, 100);

  // Far tape offscreen culling
  const offscreen = calcTapeTransform(15, H, ws, d, gap, 1000, 0, 0, 0);
  assert.equal(offscreen.visible, false);
});

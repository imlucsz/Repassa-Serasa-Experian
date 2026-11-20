import assert from 'node:assert/strict';
import test from 'node:test';
import { findOwnReservation, parseOwnReservation } from './reservation.ts';

const materialId = '39ea38aa-78f3-4870-b586-000000000001';
const active = {
  id: '84f38c09-2ceb-4fa4-8c38-d513bf8bad10',
  material: { id: materialId },
  status: 'ACTIVE',
  expiresAt: '2026-12-01T12:00:00Z',
  pickupCode: 'ABCD-2345-EFGH',
  createdAt: '2026-11-20T12:00:00Z',
  completedAt: null,
};

test('reservation parser accepts only contract-shaped pickup details', () => {
  assert.equal(parseOwnReservation(active)?.pickupCode, active.pickupCode);
  assert.equal(
    parseOwnReservation({ ...active, pickupCode: 'not-a-code' }),
    null,
  );
  assert.equal(
    parseOwnReservation({ ...active, expiresAt: 'yesterday' }),
    null,
  );
  assert.equal(parseOwnReservation({ ...active, material: null }), null);
});

test('recovery matches an active reservation by material id only', () => {
  assert.equal(
    findOwnReservation({ items: [active] }, materialId)?.id,
    active.id,
  );
  assert.equal(
    findOwnReservation(
      { items: [active] },
      '39ea38aa-78f3-4870-b586-000000000002',
    ),
    null,
  );
  assert.equal(
    findOwnReservation(
      { items: [{ ...active, status: 'COMPLETED' }] },
      materialId,
    ),
    null,
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { parseOwnReservation } from './reservationModel.ts';

const now = Date.parse('2026-11-22T12:00:00Z');
const active = {
  id: '84f38c09-2ceb-4fa4-8c38-d513bf8bad10',
  material: {
    id: '39ea38aa-78f3-4870-b586-000000000001',
    title: 'Livro de teste',
    description: 'Exemplar fictício.',
    category: 'BOOK',
    condition: 'GOOD',
    imageUrl: null,
    status: 'RESERVED',
    institution: {
      id: '39ea38aa-78f3-4870-b586-000000000002',
      name: 'Instituição fictícia',
      publicAddress: 'Rua de teste',
      pickupInstructions: 'Procure a biblioteca.',
    },
    createdAt: '2026-11-20T12:00:00Z',
  },
  status: 'ACTIVE',
  expiresAt: '2026-11-24T12:00:00Z',
  pickupCode: 'ABCD-2345-EFGH',
  createdAt: '2026-11-21T12:00:00Z',
  completedAt: null,
};

test('owner reservation requires valid material, deadline and code', () => {
  assert.equal(parseOwnReservation(active, now)?.pickupCode, active.pickupCode);
  for (const override of [
    { pickupCode: 'not-a-code' },
    { expiresAt: 'yesterday' },
    { material: null },
    { material: { ...active.material, institution: {} } },
    { status: 'OTHER' },
  ]) {
    assert.equal(parseOwnReservation({ ...active, ...override }, now), null);
  }
});

test('a code cannot survive a terminal status or the exact deadline', () => {
  const deadline = Date.parse(active.expiresAt);
  assert.equal(
    parseOwnReservation(active, deadline - 1)?.pickupCode,
    active.pickupCode,
  );
  assert.equal(parseOwnReservation(active, deadline)?.pickupCode, null);
  for (const status of ['EXPIRED', 'CANCELED', 'COMPLETED']) {
    assert.equal(
      parseOwnReservation({ ...active, status }, now)?.pickupCode,
      null,
    );
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { expireReservationForHarness } from './expire-reservation.mjs';

const id = '123e4567-e89b-42d3-a456-426614174000';
const db = 'postgresql://postgres:postgres@127.0.0.1:55434/repassa_test';

function fakeClient(execute) {
  const state = { disconnected: 0, calls: [] };
  return {
    state,
    client: {
      async $executeRaw(strings, ...values) {
        state.calls.push({ strings: [...strings], values });
        return execute();
      },
      async $disconnect() {
        state.disconnected += 1;
      },
    },
  };
}

test('expiry helper parameterizes the reservation id and disconnects on success', async () => {
  const fake = fakeClient(() => 1);
  const updated = await expireReservationForHarness({
    databaseUrl: db,
    reservationId: id,
    createClient: () => fake.client,
  });
  assert.equal(updated, 1);
  assert.equal(fake.state.disconnected, 1);
  assert.deepEqual(fake.state.calls[0].values, [id]);
  assert.equal(fake.state.calls[0].strings.join('').includes(id), false);
  assert.equal(fake.state.calls[0].strings.join('').includes('CAST('), true);
});

test('expiry helper disconnects when the mutation fails', async () => {
  const fake = fakeClient(() => {
    throw new Error('synthetic database failure');
  });
  await assert.rejects(
    expireReservationForHarness({
      databaseUrl: db,
      reservationId: id,
      createClient: () => fake.client,
    }),
    /synthetic database failure/,
  );
  assert.equal(fake.state.disconnected, 1);
});

test('expiry helper rejects malformed ids before opening a client', async () => {
  let opened = 0;
  await assert.rejects(
    expireReservationForHarness({
      databaseUrl: db,
      reservationId: "1'; DROP TABLE reservations; --",
      createClient: () => {
        opened += 1;
        return fakeClient(() => 1).client;
      },
    }),
    /UUID/,
  );
  assert.equal(opened, 0);
});

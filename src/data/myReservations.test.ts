import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mockCatalog } from './mockCatalog.ts';
import { cancelReservation, listMyReservations } from './myReservations.ts';

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
before(() =>
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { origin: 'http://localhost' } },
  }),
);
after(() => {
  if (originalWindow)
    Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
});

const [fixture] = (await mockCatalog.listMaterials()).items;
const active = {
  id: 'bdb48397-c409-4d97-998f-15a62198915a',
  material: { ...fixture, status: 'RESERVED' },
  status: 'ACTIVE',
  expiresAt: new Date(Date.now() + 72 * 3600_000).toISOString(),
  createdAt: new Date().toISOString(),
  completedAt: null,
  pickupCode: 'TEST-2345-ABCD',
};

test('own history requests the chosen page and status; material may be reserved', async (t) => {
  t.mock.method(globalThis, 'fetch', async (request: Request) => {
    assert.equal(request.method, 'GET');
    assert.equal(request.cache, 'no-store');
    assert.equal(
      request.url,
      'http://localhost/api/v1/me/reservations?page=2&pageSize=1&status=ACTIVE',
    );
    return Response.json({ items: [active], total: 2, pageSize: 1, page: 2 });
  });
  const page = await listMyReservations(2, 1, undefined, 'ACTIVE');
  assert.equal(
    page.items[0].material.institution.name,
    fixture.institution.name,
  );
  assert.equal(page.items[0].material.status, 'RESERVED');
  assert.equal(page.items[0].materialId, fixture.id);
});

test('history rejects invalid material, wrong page, and mismatched filter', async (t) => {
  const reply = { items: [active], page: 1, pageSize: 10, total: 1 };
  const fetch = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({
      ...reply,
      items: [{ ...active, material: { id: fixture.id } }],
    }),
  );
  await assert.rejects(listMyReservations(), { status: 502 });
  fetch.mock.mockImplementation(async () =>
    Response.json({ ...reply, page: 2 }),
  );
  await assert.rejects(listMyReservations(), { status: 502 });
  fetch.mock.mockImplementation(async () => Response.json(reply));
  await assert.rejects(listMyReservations(1, 10, undefined, 'COMPLETED'), {
    status: 502,
  });
});

test('cancel requires the expected reservation and confirmed terminal status', async (t) => {
  const canceled = { ...active, status: 'CANCELED', pickupCode: null };
  const fetch = t.mock.method(globalThis, 'fetch', async (request: Request) => {
    assert.equal(request.method, 'POST');
    assert.equal(
      request.url,
      'http://localhost/api/v1/reservations/' + active.id + '/cancel',
    );
    assert.equal(request.body, null);
    return Response.json(canceled);
  });
  assert.equal((await cancelReservation(active.id)).pickupCode, null);
  fetch.mock.mockImplementation(async () => Response.json(active));
  await assert.rejects(cancelReservation(active.id), { status: 502 });
  fetch.mock.mockImplementation(async () =>
    Response.json({ ...canceled, id: fixture.id }),
  );
  await assert.rejects(cancelReservation(active.id), { status: 502 });
  fetch.mock.mockImplementation(
    async () => new Response(null, { status: 409 }),
  );
  await assert.rejects(cancelReservation(active.id), { status: 409 });
});

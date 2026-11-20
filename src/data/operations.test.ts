import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mockCatalog } from './mockCatalog.ts';
import {
  cancelDonation,
  createDonation,
  getDashboard,
  listDonations,
  listManagedMaterials,
  listMemberships,
  receiveMaterial,
  rejectMaterial,
  upload,
} from './operations.ts';

const origin = 'http://localhost';
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
before(() =>
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { origin } },
  }),
);
after(() => {
  if (originalWindow)
    Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
});

const [book] = (await mockCatalog.listMaterials()).items;
const pending = {
  ...book,
  status: 'PENDING_RECEIPT',
  updatedAt: book.createdAt,
  receivedAt: null,
  rejectReason: null,
};
const institutionId = book.institution.id;
const input = {
  title: book.title,
  description: book.description,
  condition: book.condition,
  category: book.category,
  institutionId,
};
const endpoint =
  '/api/v1/institutions/' + institutionId + '/materials/' + book.id;

test('photo is multipart and donation sends only permitted fields', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (request: Request) => {
    assert.equal(new URL(request.url).pathname, '/api/v1/uploads');
    assert.equal(request.method, 'POST');
    const file = (await request.formData()).get('file');
    assert.ok(file instanceof File);
    assert.equal(file.name, 'capa.jpg');
    return Response.json({ uploadId: book.id }, { status: 201 });
  });
  const uploadId = await upload(
    new File(['illustration'], 'capa.jpg', { type: 'image/jpeg' }),
  );
  assert.equal(uploadId, book.id);
  fetch.mock.mockImplementation(async (request: Request) => {
    assert.equal(new URL(request.url).pathname, '/api/v1/donations');
    assert.deepEqual(await request.json(), { ...input, uploadId });
    return Response.json(pending, { status: 201 });
  });
  const overSpecified = {
    ...input,
    uploadId,
    donorId: 'untrusted',
    status: 'AVAILABLE',
  };
  assert.deepEqual(await createDonation(overSpecified), pending);
});

test('history preserves pagination and rejects an unexpected status', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (request: Request) => {
    const url = new URL(request.url);
    assert.equal(url.pathname, '/api/v1/me/donations');
    assert.equal(url.searchParams.get('page'), '2');
    assert.equal(url.searchParams.get('pageSize'), '1');
    assert.equal(url.searchParams.get('status'), 'PENDING_RECEIPT');
    return Response.json({ items: [pending], total: 2, page: 2, pageSize: 1 });
  });
  assert.deepEqual(
    (await listDonations(2, 1, undefined, 'PENDING_RECEIPT')).items,
    [pending],
  );
  fetch.mock.mockImplementation(async () =>
    Response.json({ items: [book], page: 1, pageSize: 20, total: 1 }),
  );
  await assert.rejects(listDonations(), { status: 502 });
});

test('cancel, receive and reject validate returned transition and target', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (request: Request) => {
    assert.equal(request.method, 'POST');
    assert.equal(
      new URL(request.url).pathname,
      '/api/v1/donations/' + book.id + '/cancel',
    );
    return Response.json({ ...pending, status: 'CANCELED' });
  });
  assert.equal((await cancelDonation(book.id)).status, 'CANCELED');
  fetch.mock.mockImplementation(async (request: Request) => {
    assert.equal(new URL(request.url).pathname, endpoint + '/receive');
    return Response.json({
      ...pending,
      receivedAt: pending.createdAt,
      status: 'AVAILABLE',
    });
  });
  assert.equal(
    (await receiveMaterial(institutionId, book.id)).status,
    'AVAILABLE',
  );
  fetch.mock.mockImplementation(async (request: Request) => {
    assert.equal(new URL(request.url).pathname, endpoint + '/reject');
    assert.deepEqual(await request.json(), { reason: 'Faltam páginas.' });
    return Response.json({
      ...pending,
      status: 'REJECTED',
      rejectReason: 'Faltam páginas.',
    });
  });
  assert.equal(
    (await rejectMaterial(institutionId, book.id, 'Faltam páginas.'))
      .rejectReason,
    'Faltam páginas.',
  );
  fetch.mock.mockImplementation(async () => Response.json(pending));
  await assert.rejects(receiveMaterial(institutionId, book.id), {
    status: 502,
  });
});

test('memberships consume each authenticated page; stock rows must match the requested institution', async (t) => {
  const institutions = await mockCatalog.listInstitutions();
  const fetch = t.mock.method(globalThis, 'fetch', async (request: Request) => {
    const url = new URL(request.url);
    assert.equal(url.pathname, '/api/v1/me/institutions');
    const page = Number(url.searchParams.get('page'));
    return Response.json({
      items: [institutions[page - 1]],
      page,
      pageSize: 1,
      total: institutions.length,
    });
  });
  assert.deepEqual(await listMemberships(), institutions);
  fetch.mock.mockImplementation(async () =>
    Response.json({
      items: [{ ...pending, institution: institutions[1] }],
      total: 1,
      page: 1,
      pageSize: 20,
    }),
  );
  await assert.rejects(listManagedMaterials(institutionId), { status: 502 });
});

test('dashboard reads scoped stock totals, fails when a counter is denied', async (t) => {
  const totals = {
    PENDING_RECEIPT: 4,
    AVAILABLE: 20,
    DELIVERED: 13,
    RESERVED: 1,
  };
  const fetch = t.mock.method(globalThis, 'fetch', async (request: Request) => {
    const url = new URL(request.url);
    assert.equal(
      url.pathname,
      '/api/v1/institutions/' + institutionId + '/materials',
    );
    assert.equal(url.searchParams.get('pageSize'), '1');
    const status = url.searchParams.get('status') as keyof typeof totals;
    return Response.json({
      total: totals[status],
      page: 1,
      pageSize: 1,
      items: [{ ...pending, status }],
    });
  });
  assert.deepEqual(await getDashboard(institutionId), {
    pendingReceipt: 4,
    available: 20,
    delivered: 13,
    reserved: 1,
  });
  fetch.mock.mockImplementation(
    async () => new Response(null, { status: 403 }),
  );
  await assert.rejects(getDashboard(institutionId), { status: 403 });
});

test('validation and conflict remain distinguishable from uncertain network outcomes', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () =>
    Response.json(
      {
        fieldErrors: {
          institutionId: ['must reference an active institution'],
        },
      },
      { status: 400 },
    ),
  );
  await assert.rejects(createDonation(input), {
    status: 400,
    fieldErrors: { institutionId: ['Selecione uma instituição ativa.'] },
  });
  fetch.mock.mockImplementation(
    async () => new Response(null, { status: 409 }),
  );
  await assert.rejects(cancelDonation(book.id), { status: 409 });
  fetch.mock.mockImplementation(async () => {
    throw new TypeError('offline');
  });
  await assert.rejects(createDonation(input), { status: 0 });
  assert.equal(fetch.mock.callCount(), 3);
});

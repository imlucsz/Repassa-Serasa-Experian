import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CatalogError,
  getMaterial,
  listInstitutions,
  listMaterials,
} from './catalog.ts';
import { mockCatalog } from './mockCatalog.ts';

test('demo filters before paging and resolves the same material by id', async () => {
  const page = await mockCatalog.listMaterials({ pageSize: 2 });
  assert.equal(page.items.length, 2);
  assert.equal(page.total, 6);
  const [book] = page.items;
  const query = {
    category: book.category,
    institutionId: book.institution.id,
    q: 'botanica',
  };
  assert.deepEqual((await mockCatalog.listMaterials(query)).items, [book]);
  assert.deepEqual(await mockCatalog.getMaterial(book.id), book);
  assert.equal(
    (await mockCatalog.listMaterials({ q: 'inexistente' })).total,
    0,
  );
  assert.equal(
    (await mockCatalog.listMaterials({ pageSize: 2, page: 4 })).items.length,
    0,
  );
});

test('demo reports bad pagination, unavailable material and cancellation', async () => {
  await assert.rejects(mockCatalog.listMaterials({ pageSize: 51 }), {
    status: 400,
  });
  await assert.rejects(
    mockCatalog.getMaterial('00000000-0000-4000-8000-000000000000'),
    { status: 404 },
  );
  await assert.rejects(mockCatalog.listMaterials({}, AbortSignal.abort()), {
    name: 'AbortError',
  });
});

test('live catalog sends encoded filters and the abort signal', async (t) => {
  const page = await mockCatalog.listMaterials({ pageSize: 1 });
  const controller = new AbortController();
  t.mock.method(
    globalThis,
    'fetch',
    async (url: string, options: RequestInit) => {
      const request = new URL(url, 'http://localhost');
      assert.equal(request.pathname, '/api/v1/materials');
      assert.equal(request.searchParams.get('q'), 'forma & cor');
      assert.equal(request.searchParams.get('category'), 'BOOK');
      assert.equal(request.searchParams.get('pageSize'), '1');
      assert.equal(options.signal, controller.signal);
      return Response.json(page);
    },
  );
  assert.deepEqual(
    await listMaterials(
      { q: 'forma & cor', category: 'BOOK', pageSize: 1 },
      controller.signal,
    ),
    page,
  );
});

test('live rejects inaccessible, malformed and non-available records', async (t) => {
  const [book] = (await mockCatalog.listMaterials()).items;
  const fetch = t.mock.method(
    globalThis,
    'fetch',
    async () => new Response(null, { status: 403 }),
  );
  await assert.rejects(
    getMaterial(book.id),
    (error: unknown) => error instanceof CatalogError && error.status === 403,
  );
  fetch.mock.mockImplementation(async () =>
    Response.json({ ...book, status: 'RESERVED' }),
  );
  await assert.rejects(getMaterial(book.id), { status: 502 });
  fetch.mock.mockImplementation(async () => new Response('<!doctype html>'));
  await assert.rejects(listMaterials(), { status: 502 });
  fetch.mock.mockImplementation(async () => {
    throw new TypeError('offline');
  });
  await assert.rejects(listMaterials(), { status: 0 });
});

test('institutions loader follows page metadata', async (t) => {
  const institutions = await mockCatalog.listInstitutions();
  const fetch = t.mock.method(globalThis, 'fetch', async (url: string) => {
    const page = Number(
      new URL(url, 'http://localhost').searchParams.get('page'),
    );
    return Response.json({
      items: [institutions[page - 1]],
      page,
      pageSize: 1,
      total: institutions.length,
    });
  });
  assert.deepEqual(await listInstitutions(), institutions);
  assert.equal(fetch.mock.callCount(), institutions.length);
});

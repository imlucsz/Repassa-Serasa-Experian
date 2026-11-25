import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mockCatalog } from './mockCatalog.ts';
import {
  approveInstitution,
  assignInstitutionMember,
  findAdminInstitution,
  listAdminAuditEvents,
  listAllAdminInstitutions,
  listAdminInstitutions,
  listAdminMaterials,
  listAdminReservations,
  listAdminUsers,
  listInstitutionMembers,
  registerInstitution,
  rejectInstitution,
  revokeInstitutionMember,
  setInstitutionActive,
  setUserActive,
  setUserRole,
} from './admin.ts';

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
const institution = {
  ...book.institution,
  status: 'PENDING',
  isActive: false,
  memberCount: 0,
  materialCount: 0,
  createdAt: book.createdAt,
  updatedAt: book.createdAt,
};
const admin = {
  id: '8b1f1d43-7b4c-4a9e-8a4b-7a6b2b3c4d5d',
  email: 'admin.demo@example.invalid',
  displayName: 'Admin Demo',
  role: 'ADMIN',
  isActive: true,
  membershipCount: 0,
  createdAt: book.createdAt,
  updatedAt: book.createdAt,
};
const member = {
  userId: admin.id,
  institutionId: institution.id,
  email: 'equipe@example.invalid',
  displayName: 'Equipe',
  createdAt: book.createdAt,
};

function pageOf(items: unknown[], page = 1, pageSize = 20) {
  return { items, page, pageSize, total: items.length };
}

test('institutions list sends filters and requires the admin shape', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (request: Request) => {
    const url = new URL(request.url);
    assert.equal(url.pathname, '/api/v1/admin/institutions');
    assert.equal(url.searchParams.get('status'), 'PENDING');
    assert.equal(url.searchParams.get('isActive'), 'false');
    assert.equal(url.searchParams.get('q'), 'aurora');
    assert.equal(url.searchParams.get('page'), '2');
    return Response.json(pageOf([institution]));
  });
  const result = await listAdminInstitutions({
    status: 'PENDING',
    isActive: false,
    q: 'aurora',
    page: 2,
  });
  assert.equal(result.items[0].status, 'PENDING');
  fetch.mock.mockImplementation(async () =>
    Response.json(pageOf([{ ...institution, status: 'ARCHIVED' }])),
  );
  await assert.rejects(listAdminInstitutions(), { status: 502 });
});

test('approve, reject with reason and activate hit the lifecycle endpoints', async (t) => {
  const calls: string[] = [];
  const fetch = t.mock.method(globalThis, 'fetch', async (request: Request) => {
    const url = new URL(request.url);
    calls.push(request.method + ' ' + url.pathname);
    assert.equal(request.method, 'POST');
    if (url.pathname.endsWith('/reject'))
      assert.deepEqual(await request.json(), { reason: 'Endereço incompleto' });
    return Response.json({ ...institution, status: 'APPROVED', isActive: true });
  });
  await approveInstitution(institution.id);
  await rejectInstitution(institution.id, 'Endereço incompleto');
  await setInstitutionActive(institution.id, true);
  await setInstitutionActive(institution.id, false);
  assert.deepEqual(calls, [
    'POST /api/v1/admin/institutions/' + institution.id + '/approve',
    'POST /api/v1/admin/institutions/' + institution.id + '/reject',
    'POST /api/v1/admin/institutions/' + institution.id + '/activate',
    'POST /api/v1/admin/institutions/' + institution.id + '/deactivate',
  ]);
  fetch.mock.mockImplementation(async () =>
    Response.json({ ...institution, status: 'GHOST' }),
  );
  await assert.rejects(approveInstitution(institution.id), { status: 502 });
});

test('listAllAdminInstitutions aggregates every page for dropdowns', async (t) => {
  let reads = 0;
  t.mock.method(globalThis, 'fetch', async (request: Request) => {
    const url = new URL(request.url);
    reads++;
    const page = Number(url.searchParams.get('page'));
    assert.equal(url.searchParams.get('pageSize'), '50');
    if (page === 1)
      return Response.json({
        items: Array.from({ length: 50 }, (_, i) => ({
          ...institution,
          id: book.id.slice(0, -2) + String(i % 10) + String((i / 10) | 0),
        })),
        page: 1,
        pageSize: 50,
        total: 51,
      });
    return Response.json(pageOf([institution], 2, 50));
  });
  const all = await listAllAdminInstitutions();
  assert.equal(all.length, 51);
  assert.equal(reads, 2);
});

test('findAdminInstitution pages until the id or the list ends', async (t) => {
  let reads = 0;
  t.mock.method(globalThis, 'fetch', async (request: Request) => {
    const url = new URL(request.url);
    reads++;
    const page = Number(url.searchParams.get('page'));
    assert.equal(url.searchParams.get('pageSize'), '50');
    if (page === 1)
      return Response.json({
        items: [{ ...institution, id: book.id }],
        page: 1,
        pageSize: 50,
        total: 51,
      });
    return Response.json(pageOf([institution], 2, 50));
  });
  const found = await findAdminInstitution(institution.id);
  assert.equal(found?.id, institution.id);
  assert.equal(reads, 2);
});

test('members list, assign posts only userId and revoke accepts 204', async (t) => {
  const calls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (request: Request) => {
    const url = new URL(request.url);
    calls.push(request.method + ' ' + url.pathname);
    if (url.pathname.endsWith('/members') && request.method === 'GET')
      return Response.json([member]);
    if (url.pathname.endsWith('/members')) {
      assert.deepEqual(await request.json(), { userId: admin.id });
      return Response.json(member, { status: 201 });
    }
    assert.ok(url.pathname.endsWith('/revoke'));
    return new Response(null, { status: 204 });
  });
  assert.deepEqual(await listInstitutionMembers(institution.id), [member]);
  assert.deepEqual(
    await assignInstitutionMember(institution.id, admin.id),
    member,
  );
  await revokeInstitutionMember(institution.id, admin.id);
  assert.deepEqual(calls, [
    'GET /api/v1/admin/institutions/' + institution.id + '/members',
    'POST /api/v1/admin/institutions/' + institution.id + '/members',
    'POST /api/v1/admin/institutions/' +
      institution.id +
      '/members/' +
      admin.id +
      '/revoke',
  ]);
});

test('users list filters and role changes never send ADMIN', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (request: Request) => {
    const url = new URL(request.url);
    if (url.pathname === '/api/v1/admin/users') {
      assert.equal(url.searchParams.get('role'), 'STUDENT');
      assert.equal(url.searchParams.get('isActive'), 'true');
      return Response.json(
        pageOf([{ ...admin, role: 'STUDENT', displayName: 'Aluna Demo' }]),
      );
    }
    assert.equal(url.pathname, '/api/v1/admin/users/' + admin.id + '/role');
    assert.deepEqual(await request.json(), { role: 'STAFF' });
    return Response.json({ ...admin, role: 'STAFF' });
  });
  const result = await listAdminUsers({ role: 'STUDENT', isActive: true });
  assert.equal(result.items[0].role, 'STUDENT');
  const updated = await setUserRole(admin.id, 'STAFF');
  assert.equal(updated.role, 'STAFF');
  fetch.mock.mockImplementation(async () =>
    Response.json({ ...admin, role: 'SUPERUSER' }),
  );
  await assert.rejects(setUserRole(admin.id, 'STAFF'), { status: 502 });
});

test('user activation endpoints revoke and restore access', async (t) => {
  const calls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (request: Request) => {
    const url = new URL(request.url);
    calls.push(request.method + ' ' + url.pathname);
    return Response.json({ ...admin, isActive: url.pathname.endsWith('/activate') });
  });
  const restored = await setUserActive(admin.id, true);
  const suspended = await setUserActive(admin.id, false);
  assert.equal(restored.isActive, true);
  assert.equal(suspended.isActive, false);
  assert.deepEqual(calls, [
    'POST /api/v1/admin/users/' + admin.id + '/activate',
    'POST /api/v1/admin/users/' + admin.id + '/deactivate',
  ]);
});

test('read-only views forward filters and reject unexpected rows', async (t) => {
  const reservation = {
    id: 'ce6472b1-6183-4ee9-98d9-e9365856ab3c',
    status: 'ACTIVE',
    materialId: book.id,
    material: { ...book, status: 'RESERVED' },
    institutionId: institution.id,
    studentId: admin.id,
    expiresAt: '2026-12-01T12:00:00Z',
    completedAt: null,
    createdAt: book.createdAt,
  };
  const audit = {
    id: book.id,
    action: 'admin.institution_approve',
    actorId: admin.id,
    institutionId: institution.id,
    materialId: null,
    reservationId: null,
    metadata: { reason: null },
    createdAt: book.createdAt,
  };
  const seen: string[] = [];
  t.mock.method(globalThis, 'fetch', async (request: Request) => {
    const url = new URL(request.url);
    seen.push(url.pathname + url.search);
    if (url.pathname === '/api/v1/admin/materials') {
      assert.equal(url.searchParams.get('status'), 'RESERVED');
      assert.equal(url.searchParams.get('institutionId'), institution.id);
      return Response.json(
        pageOf([{ ...book, status: 'RESERVED' }]),
      );
    }
    if (url.pathname === '/api/v1/admin/reservations') {
      assert.equal(url.searchParams.get('studentId'), admin.id);
      return Response.json(pageOf([reservation]));
    }
    assert.equal(url.pathname, '/api/v1/admin/audit-events');
    assert.equal(url.searchParams.get('action'), 'admin.');
    return Response.json(pageOf([audit]));
  });
  const materials = await listAdminMaterials({
    status: 'RESERVED',
    institutionId: institution.id,
  });
  assert.equal(materials.items[0].status, 'RESERVED');
  const reservations = await listAdminReservations({ studentId: admin.id });
  assert.equal(reservations.items[0].status, 'ACTIVE');
  assert.equal('pickupCode' in reservations.items[0], false);
  const events = await listAdminAuditEvents({ action: 'admin.' });
  assert.equal(events.items[0].action, 'admin.institution_approve');
  assert.equal(seen.length, 3);
});

test('institution registration posts the three public fields to /institutions', async (t) => {
  const input = {
    name: 'Biblioteca Comunitária Fictícia',
    publicAddress: 'Rua dos Testes, 10 — Centro',
    pickupInstructions: 'Balcão da entrada, seg–sex 9h–17h.',
  };
  const fetch = t.mock.method(globalThis, 'fetch', async (request: Request) => {
    const url = new URL(request.url);
    assert.equal(url.pathname, '/api/v1/institutions');
    assert.equal(request.method, 'POST');
    assert.deepEqual(await request.json(), input);
    return Response.json(
      { id: institution.id, ...input },
      { status: 201 },
    );
  });
  const created = await registerInstitution(input);
  assert.equal(created.id, institution.id);
  fetch.mock.mockImplementation(
    async () => new Response(null, { status: 401 }),
  );
  await assert.rejects(registerInstitution(input), { status: 401 });
});

import { expect } from '@playwright/test';

// Synthetic admin fixtures for the intercepted API. No real credentials.
export const admin = {
  id: '8b1f1d43-7b4c-4a9e-8a4b-7a6b2b3c4d5d',
  email: 'admin@example.invalid',
  displayName: 'Administração de teste',
  role: 'ADMIN',
};

const base = {
  publicAddress: 'Alameda de Teste, 10 — Centro',
  pickupInstructions: 'Balcão da entrada, seg–sex 9h–17h.',
  createdAt: '2026-11-10T12:00:00Z',
  updatedAt: '2026-11-12T12:00:00Z',
};

export const pending = {
  ...base,
  id: '7a0f0c32-6a3b-4f8d-9f3a-6f5a1a2b3c4f',
  name: 'Escola Horizonte (teste)',
  status: 'PENDING',
  isActive: false,
  memberCount: 0,
  materialCount: 0,
};

export const approved = {
  ...base,
  id: '51e739bc-d744-49a3-9aa8-8e64f3835831',
  name: 'Biblioteca Sul (teste)',
  status: 'APPROVED',
  isActive: true,
  memberCount: 1,
  materialCount: 3,
};

export const member = {
  userId: '672abf72-5df3-420b-855c-76f964a5e6ae',
  institutionId: approved.id,
  email: 'equipe@example.invalid',
  displayName: 'Equipe de teste',
  createdAt: '2026-11-11T09:00:00Z',
};

export const student = {
  id: '07fee3e9-35a3-42c7-b263-42976afa9eda',
  email: 'aluna@example.invalid',
  displayName: 'Estudante de teste',
  role: 'STUDENT',
  isActive: true,
  membershipCount: 0,
  createdAt: '2026-11-01T12:00:00Z',
  updatedAt: '2026-11-01T12:00:00Z',
};

export const material = {
  id: '3628026f-1052-412e-b75e-6aa5387662db',
  title: 'Gramática sintética',
  description: 'Livro de apoio para testes.',
  category: 'BOOK',
  condition: 'GOOD',
  imageUrl: null,
  institution: {
    id: approved.id,
    name: approved.name,
    publicAddress: approved.publicAddress,
    pickupInstructions: approved.pickupInstructions,
  },
  status: 'RESERVED',
  createdAt: '2026-11-09T12:00:00Z',
};

export const reservation = {
  id: 'ce6472b1-6183-4ee9-98d9-e9365856ab3c',
  status: 'ACTIVE',
  materialId: material.id,
  material,
  institutionId: approved.id,
  studentId: student.id,
  expiresAt: '2026-12-01T12:00:00Z',
  completedAt: null,
  createdAt: '2026-11-15T12:00:00Z',
};

export const auditEvent = {
  id: 'e1b2c3d4-5f6a-4b7c-8d9e-0f1a2b3c4d5e',
  action: 'admin.institution_approve',
  actorId: admin.id,
  institutionId: approved.id,
  materialId: null,
  reservationId: null,
  metadata: {},
  createdAt: '2026-11-12T12:00:00Z',
};

export function page(items, page = 1, pageSize = 20) {
  return { items, page, pageSize, total: items.length };
}

export async function adminSession(page, handler) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.slice('/api/v1'.length);
    if (path === '/auth/refresh') {
      return route.fulfill({
        json: { user: admin, accessToken: 'synthetic-admin', expiresIn: 900 },
      });
    }
    expect(route.request().headers().authorization).toBe(
      'Bearer synthetic-admin',
    );
    return handler(route, path, url.searchParams);
  });
}

export async function sessionAs(page, role) {
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    expect(path).toBe('/api/v1/auth/refresh');
    return route.fulfill({
      json: {
        user: { ...admin, role },
        accessToken: 'synthetic-' + role.toLowerCase(),
        expiresIn: 900,
      },
    });
  });
}

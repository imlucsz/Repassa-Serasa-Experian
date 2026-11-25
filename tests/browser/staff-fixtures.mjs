import { expect } from '@playwright/test';

// Synthetic staff and institution fixtures for the intercepted API.
export const north = {
  id: '9825c2f3-9b29-41df-b92c-03f78ec8a810',
  name: 'Biblioteca Norte',
  publicAddress: 'Alameda de Teste, 10',
  pickupInstructions: 'Procure o balcão.',
};
export const south = {
  ...north,
  id: '51e739bc-d744-49a3-9aa8-8e64f3835831',
  name: 'Biblioteca Sul',
};
const user = {
  id: '672abf72-5df3-420b-855c-76f964a5e6ae',
  email: 'equipe@example.invalid',
  displayName: 'Equipe de teste',
  role: 'STAFF',
};

export async function staffSession(page, handler) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.slice('/api/v1'.length);
    if (path === '/auth/refresh') {
      return route.fulfill({
        json: { user, accessToken: 'synthetic-staff', expiresIn: 900 },
      });
    }
    expect(route.request().headers().authorization).toBe(
      'Bearer synthetic-staff',
    );
    if (path === '/me/institutions') {
      return route.fulfill({
        json: { items: [north, south], page: 1, pageSize: 50, total: 2 },
      });
    }
    return handler(route, path, url.searchParams);
  });
}

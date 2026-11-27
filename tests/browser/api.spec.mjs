import { expect, test } from '@playwright/test';

const id = '39ea38aa-78f3-4870-b586-000000000001';
const detail = '/materiais/' + id;
const user = {
  id: '84f38c09-2ceb-4fa4-8c38-d513bf8bad11',
  displayName: 'Estudante de teste',
  email: 'estudante@example.invalid',
  role: 'STUDENT',
};
const material = {
  id,
  title: 'Botânica ilustrada',
  description: 'Guia ilustrado de botânica.',
  category: 'BOOK',
  condition: 'GOOD',
  imageUrl: null,
  status: 'AVAILABLE',
  institution: {
    id: '84f38c09-2ceb-4fa4-8c38-d513bf8bad10',
    name: 'Instituto Folha Nova',
    publicAddress: 'Alameda das Folhas, 24',
    pickupInstructions: 'Procure a biblioteca.',
  },
  createdAt: '2026-11-10T12:00:00Z',
};

test('reservation returns to the same material after login and handles conflict', async ({
  page,
}) => {
  const unexpected = [];
  let reservations = 0;
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.slice('/api/v1'.length);
    if (path === '/auth/refresh')
      return route.fulfill({ status: 401, json: {} });
    if (path === '/materials/' + id) return route.fulfill({ json: material });
    if (path === '/auth/login') {
      expect(request.method()).toBe('POST');
      expect(request.headers()['x-repassa-request']).toBe('1');
      expect(request.postDataJSON().email).toBe(user.email);
      return route.fulfill({
        json: { user, accessToken: 'test_browser_session', expiresIn: 900 },
      });
    }
    if (path === '/materials/' + id + '/reservations') {
      expect(request.headers()['x-repassa-request']).toBe('1');
      expect(request.headers().authorization).toBe(
        'Bearer test_browser_session',
      );
      reservations++;
      return route.fulfill({ status: 409, json: { code: 'CONFLICT' } });
    }
    unexpected.push(path);
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto(detail);
  await page.getByRole('button', { name: /Entrar para reservar/i }).click();
  await expect(page).toHaveURL(/entrar\?returnTo=/);
  await page.getByLabel('E-mail', { exact: true }).fill(user.email);
  await page
    .locator('input[autocomplete="current-password"]')
    .fill('test_browser_password');
  await page.getByRole('button', { name: /mostrar senha/i }).click();
  await expect(
    page.locator('input[autocomplete="current-password"]'),
  ).toHaveAttribute('type', 'text');
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(new RegExp(detail + '$'));
  await page.getByRole('button', { name: /Reservar este material/i }).click();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: /reservado|disponível|disponibilidade/i }),
  ).toBeVisible();
  expect(reservations).toBe(1);
  expect(unexpected).toEqual([]);
});

test('public registration validates before sending and reports an unavailable API', async ({
  page,
}) => {
  let registrations = 0;
  await page.route('**/api/v1/auth/**', async (route) => {
    if (route.request().url().endsWith('/register')) {
      registrations++;
      expect(Object.keys(route.request().postDataJSON()).sort()).toEqual([
        'displayName',
        'email',
        'password',
      ]);
      return route.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } });
    }
    return route.fulfill({ status: 401, json: {} });
  });
  await page.goto('/cadastro');
  await page.locator('button[type="submit"]').click();
  expect(registrations).toBe(0);
  await page.locator('input[autocomplete="name"]').fill(user.displayName);
  await page.locator('input[type="email"]').fill(user.email);
  for (const field of await page
    .locator('input[autocomplete="new-password"]')
    .all()) {
    await field.fill('test_browser_password');
  }
  await page.getByRole('checkbox').check();
  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole('alert')).toContainText(/indisponível/i);
  expect(registrations).toBe(1);
  await expect(page).toHaveURL(/\/cadastro$/);
});

test('lost reservation response is recovered with a read and cleared on logout', async ({
  page,
}) => {
  let posts = 0;
  let reads = 0;
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.slice(
      '/api/v1'.length,
    );
    if (path === '/auth/refresh') {
      return route.fulfill({
        json: { user, accessToken: 'test_browser_session', expiresIn: 900 },
      });
    }
    if (path === '/auth/logout') return route.fulfill({ status: 204 });
    if (path === '/materials/' + id) return route.fulfill({ json: material });
    if (path === '/materials/' + id + '/reservations') {
      posts++;
      return route.abort('connectionreset');
    }
    if (path === '/me/reservations') {
      reads++;
      const now = Date.now();
      const reservation = {
        id: user.id,
        status: 'ACTIVE',
        material: { ...material, status: 'RESERVED' },
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + 3600_000).toISOString(),
        completedAt: null,
        pickupCode: 'TEST-2345-ABCD',
      };
      return route.fulfill({
        json: { page: 1, pageSize: 50, total: 1, items: [reservation] },
      });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto(detail);
  await page.getByRole('button', { name: 'Reservar este material' }).click();
  await expect(
    page.getByText('Reservado por você', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Ver minhas reservas' }),
  ).toHaveAttribute('href', '/minhas-reservas');
  await expect(page.getByText('TEST-2345-ABCD')).toHaveCount(0);
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Entrar para reservar' }),
  ).toBeVisible();
  await expect(page.getByText('Código para retirada')).toHaveCount(0);
  expect({ posts, reads }).toEqual({ posts: 1, reads: 1 });
});

test('unavailable catalog shows loading, retry and the server permission state', async ({
  page,
}) => {
  let respond;
  const gate = new Promise((resolve) => {
    respond = resolve;
  });
  let requests = 0;
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/materials')) {
      requests++;
      await gate;
      return route.fulfill({ status: requests === 1 ? 503 : 401, json: {} });
    }
    if (path.endsWith('/institutions'))
      return route.fulfill({
        json: { items: [], total: 0, page: 1, pageSize: 50 },
      });
    return route.fulfill({ status: 401, json: {} });
  });
  await page.goto('/catalogo');
  await expect(page.getByText('Consultando o acervo…')).toBeVisible();
  respond();
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(
    page.getByRole('heading', { name: 'Sessão necessária' }),
  ).toBeVisible();
});

test('solicitação sem resposta permite consultar novamente sem repetir o POST', async ({
  page,
}) => {
  let posts = 0;
  let reads = 0;
  const reservation = {
    id: user.id,
    status: 'ACTIVE',
    material: { ...material, status: 'RESERVED' },
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    completedAt: null,
    pickupCode: 'TEST-2345-ABCD',
  };
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/refresh'))
      return route.fulfill({
        json: { user, accessToken: 'synthetic-session', expiresIn: 900 },
      });
    if (url.pathname.endsWith('/materials/' + id))
      return route.fulfill({ json: material });
    if (url.pathname.endsWith('/materials/' + id + '/reservations')) {
      posts++;
      return route.fulfill({ status: 503, json: {} });
    }
    if (url.pathname.endsWith('/me/reservations')) {
      expect(url.searchParams.get('status')).toBe('ACTIVE');
      reads++;
      if (reads === 1) return route.abort('connectionreset');
      return route.fulfill({
        json: { items: [reservation], page: 1, pageSize: 50, total: 1 },
      });
    }
    throw Error('Rota de teste inesperada');
  });
  await page.goto(detail);
  // Two activations before React has a chance to repaint.
  await page
    .getByRole('button', { name: 'Reservar este material' })
    .evaluate((button) => {
      button.click();
      button.click();
    });
  await expect(page.getByRole('status')).toContainText(
    'Ainda não foi possível confirmar',
  );
  await expect(page.getByText('Reservado por você')).toHaveCount(0);
  await page.getByRole('button', { name: 'Consultar minha reserva' }).click();
  await expect(page.getByRole('status')).toContainText('Reserva confirmada');
  await expect(page.getByText(reservation.pickupCode)).toHaveCount(0);
  expect({ posts, reads }).toEqual({ posts: 1, reads: 2 });
});

for (const role of ['STAFF', 'ADMIN']) {
  test(role + ' pode consultar o material sem reservá-lo', async ({ page }) => {
    await page.route('**/api/v1/auth/refresh', (route) => route.fulfill({
      json: { user: { ...user, role }, accessToken: 'test_session', expiresIn: 900 },
    }));
    await page.route('**/materials/' + id, (route) => route.fulfill({ json: material }));
    await page.goto(detail);
    await expect(page.getByRole('button', { name: 'Reserva indisponível' })).toBeDisabled();
    await expect(page.getByText('Somente estudantes podem reservar materiais.')).toBeVisible();
  });
}

test('keyboard reservation keeps one request, transfers focus and expires in place', async ({ page }) => {
  const now = new Date('2026-11-27T14:00:00Z');
  const expiresAt = '2026-11-27T14:05:00Z';
  await page.clock.install({ time: now });
  await page.route('**/api/v1/auth/refresh', (route) => route.fulfill({
    json: { user, accessToken: 'test_session', expiresIn: 900 },
  }));
  await page.route('**/materials/' + id, (route) => route.fulfill({ json: material }));
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let posts = 0;
  await page.route('**/materials/' + id + '/reservations', async (route) => {
    posts++;
    await gate;
    await route.fulfill({ status: 201, json: {
      id: user.id, status: 'ACTIVE', material: { ...material, status: 'RESERVED' },
      createdAt: now.toISOString(), expiresAt, completedAt: null, pickupCode: null,
    } });
  });
  await page.goto(detail);
  await page.getByRole('link', { name: 'Voltar ao acervo' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Reservar este material' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Consultando…' })).toBeDisabled();
  await page.keyboard.press('Enter');
  release();
  await expect(page.getByRole('link', { name: 'Ver minhas reservas' })).toBeFocused();
  await expect(page.locator('time')).toHaveText(/11:05/);
  await page.clock.fastForward('05:01');
  await expect(page.getByText('Prazo encerrado', { exact: true })).toBeVisible();
  await expect(page.locator('time')).toHaveCount(0);
  expect(posts).toBe(1);
});

test('long records reflow with a supplied image and with a failed upload', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const imageUrl = '/api/v1/uploads/' + id + '.jpg';
  const record = {
    ...material, category: 'SUPPLIES', condition: 'FAIR', imageUrl,
    title: 'Conjunto de materiais para desenho e composição geométrica',
    description: material.description.repeat(15),
    institution: { ...material.institution, name: 'Biblioteca' + 'Universitária'.repeat(7),
      pickupInstructions: material.institution.pickupInstructions.repeat(12) },
  };
  await page.route('**/api/v1/auth/refresh', (route) => route.fulfill({ status: 401, json: {} }));
  await page.route('**/materials/' + id, (route) => route.fulfill({ json: record }));
  await page.route('**' + imageUrl, (route) => route.fulfill({
    path: 'public/brand/livros-mobile.webp', contentType: 'image/webp',
  }));
  await page.goto(detail);
  const photo = page.locator('.detail-cover img');
  await expect.poll(() => photo.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole('heading', { name: record.title })).toBeVisible();
  await expect(page.getByRole('heading', { name: record.institution.name })).toBeVisible();
  await expect(page.getByText(record.description, { exact: true })).toBeVisible();
  await expect(page.getByText(record.institution.pickupInstructions)).toBeVisible();
  await expect(page.getByText('Com marcas de uso')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.route('**' + imageUrl, (route) => route.fulfill({ status: 404 }));
  await page.reload();
  await expect(photo).toHaveAttribute('hidden', '');
  await expect(page.locator('.detail-cover [data-artwork="tools"] .jacket-art')).toBeVisible();
});

test('leaving the detail cancels an in-flight reservation', async ({ page }) => {
  await page.route('**/api/v1/auth/refresh', (route) => route.fulfill({
    json: { user, accessToken: 'test_session', expiresIn: 900 },
  }));
  await page.route('**/materials/' + id, (route) => route.fulfill({ json: material }));
  await page.route('**/api/v1/materials?*', (route) => route.fulfill({
    json: { items: [], page: 1, pageSize: 24, total: 0 },
  }));
  await page.route('**/api/v1/institutions*', (route) => route.fulfill({
    json: { items: [], page: 1, pageSize: 50, total: 0 },
  }));
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route('**/materials/' + id + '/reservations', async (route) => {
    await gate;
    await route.fulfill({ status: 409, json: {} });
  });
  await page.addInitScript(() => {
    const fetchRequest = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if (input instanceof Request && input.url.endsWith('/reservations') && input.method === 'POST') {
        window.reservationSignal = input.signal;
      }
      return fetchRequest(input, init);
    };
  });
  await page.goto(detail);
  await page.getByRole('button', { name: 'Reservar este material' }).click();
  await expect(page.getByRole('button', { name: 'Consultando…' })).toBeDisabled();
  try {
    await page.getByRole('link', { name: 'Voltar ao acervo' }).click();
    await expect(page).toHaveURL(/\/catalogo$/);
    await expect.poll(() => page.evaluate(() => window.reservationSignal?.aborted)).toBe(true);
  } finally {
    release();
  }
});

test('official home navigation matches anonymous, student, staff and administrator roles', async ({
  page,
}) => {
  let role = null;
  await page.route('**/api/v1/auth/refresh', (route) => {
    if (!role) return route.fulfill({ status: 401, json: {} });
    return route.fulfill({
      json: {
        user: { ...user, role, displayName: role + ' de teste' },
        accessToken: 'synthetic-home-' + role,
        expiresIn: 900,
      },
    });
  });

  role = null;
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Entrar' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Criar conta estudantil' })).toHaveAttribute(
    'href',
    '/cadastro?intent=doar',
  );

  role = 'STUDENT';
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Área da conta' }).getByRole('link', { name: 'Doar material' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Doar material' }).last()).toHaveAttribute('href', '/doar');

  role = 'STAFF';
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Área da conta' }).getByRole('link', { name: 'Instituição' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Doar material' })).toHaveCount(0);

  role = 'ADMIN';
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Área da conta' }).getByRole('link', { name: 'Administração' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Doar material' })).toHaveCount(0);
});

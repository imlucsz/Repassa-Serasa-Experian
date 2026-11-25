import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Fictional student, location, material and pickup code used exclusively in API fixtures.
const student = {
  id: '135c0a77-198a-4544-a161-2fc07de61511',
  displayName: 'Estudante de teste',
  email: 'estudante@example.invalid',
  role: 'STUDENT',
};
const material = {
  id: '32d487d8-bdf5-41ec-988e-26858789c051',
  title: 'Geometria do cotidiano',
  description: 'Exercícios de geometria com objetos do dia a dia.',
  category: 'BOOK',
  condition: 'GOOD',
  status: 'RESERVED',
  imageUrl: null,
  institution: {
    id: '3098c82b-9daa-44b4-a1d6-48b082a488f1',
    name: 'Biblioteca do Ipê',
    publicAddress: 'Praça das Letras, 15',
    pickupInstructions: 'Procure a equipe no balcão da biblioteca.',
  },
  createdAt: '2032-04-02T10:30:00Z',
};
const active = {
  id: 'ce6472b1-6183-4ee9-98d9-e9365856ab3c',
  status: 'ACTIVE',
  material,
  createdAt: '2032-04-03T10:30:00Z',
  expiresAt: '2032-04-06T10:30:00Z',
  pickupCode: 'TEST-2345-ABCD',
  completedAt: null,
};
const canceled = { ...active, status: 'CANCELED', pickupCode: null };

function pageOf(items, { page = 1, total = items.length } = {}) {
  return { items, page, pageSize: 10, total };
}

async function serve(page, { list, cancel, authenticated = () => true }) {
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith('/auth/refresh'))
      return route.fulfill(
        authenticated()
          ? {
              json: {
                accessToken: 'synthetic-reservation-session',
                user: student,
                expiresIn: 900,
              },
            }
          : { status: 401, json: {} },
      );
    if (url.pathname === '/api/v1/me/reservations')
      return list(route, Number(url.searchParams.get('page')));
    if (
      url.pathname === '/api/v1/reservations/' + active.id + '/cancel' &&
      cancel
    ) {
      expect(request.method()).toBe('POST');
      return cancel(route);
    }
    throw new Error('Chamada inesperada à API da fixture.');
  });
}

test('student can reveal and copy the private code, keep a reservation by keyboard, then cancel with confirmation', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: 'http://127.0.0.1:4272',
  });
  let posts = 0;
  await serve(page, {
    list: (route) =>
      route.fulfill({ json: pageOf([posts ? canceled : active]) }),
    cancel: (route) => {
      posts++;
      return route.fulfill({ json: canceled });
    },
  });
  await page.goto('/minhas-reservas');
  await expect(
    page.getByRole('heading', { name: material.title, exact: true }),
  ).toBeVisible();
  await expect(page.getByText(active.pickupCode)).toHaveCount(0);
  const reveal = page.getByRole('button', { name: 'Mostrar código' });
  await reveal.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText(active.pickupCode)).toBeVisible();
  const copy = page.getByRole('button', { name: 'Copiar código' });
  await page.keyboard.press('Tab');
  await expect(copy).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Código copiado.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    active.pickupCode,
  );
  await expect(page.getByText(/horário de São Paulo/)).toContainText('07:30');
  const cancel = page.getByRole('button', { name: 'Cancelar reserva' });
  await cancel.click();
  const keep = page.getByRole('button', { name: 'Manter reserva' });
  await expect(keep).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click();
  await expect(page.getByRole('status')).toContainText('Reserva cancelada');
  await expect(page.getByText('Cancelada', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /Minhas reservas/ }),
  ).toBeFocused();
  await expect(reveal).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Cancelada', { exact: true })).toBeVisible();
  expect(posts).toBe(1);
});

test('rechecks owner history before revealing a code after pickup on another device', async ({
  page,
}) => {
  let reads = 0;
  const completed = {
    ...active,
    status: 'COMPLETED',
    completedAt: active.createdAt,
    pickupCode: null,
  };
  await serve(page, {
    list: (route) =>
      route.fulfill({ json: pageOf([++reads === 1 ? active : completed]) }),
  });
  await page.goto('/minhas-reservas');
  await page.getByRole('button', { name: 'Mostrar código' }).click();
  await expect(page.getByText('Retirada concluída')).toBeVisible();
  await expect(page.getByText(active.pickupCode)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Copiar código' })).toHaveCount(
    0,
  );
  expect(reads).toBe(2);
});

test('an open code disappears at the deadline, with no cancellation available', async ({
  page,
}) => {
  const epoch = new Date('2032-04-06T10:29:45Z');
  await page.clock.install({ time: epoch });
  await serve(page, {
    list: (route) => route.fulfill({ json: pageOf([active]) }),
  });
  await page.goto('/minhas-reservas');
  await page.getByRole('button', { name: 'Mostrar código' }).click();
  await expect(page.getByText(active.pickupCode)).toBeVisible();
  await page.clock.fastForward(16_000);
  await expect(page.getByText('Prazo encerrado')).toBeVisible();
  await expect(page.getByText(active.pickupCode)).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Cancelar reserva' }),
  ).toHaveCount(0);
});

for (const outcome of ['conflict', 'network']) {
  test(
    'cancellation reads current state after ' +
      outcome +
      ' and never repeats the write',
    async ({ page }) => {
      let posts = 0;
      let reads = 0;
      await serve(page, {
        list: (route) => {
          reads++;
          const latest =
            outcome === 'conflict'
              ? {
                  ...canceled,
                  status: 'COMPLETED',
                  completedAt: active.createdAt,
                }
              : canceled;
          return route.fulfill({ json: pageOf([posts ? latest : active]) });
        },
        cancel: (route) => {
          posts++;
          return outcome === 'conflict'
            ? route.fulfill({ status: 409, json: {} })
            : route.abort('connectionreset');
        },
      });
      await page.goto('/minhas-reservas');
      await page.getByRole('button', { name: 'Cancelar reserva' }).click();
      await page
        .getByRole('button', { name: 'Confirmar cancelamento' })
        .click();
      await expect(
        page.getByText(
          outcome === 'conflict' ? 'Retirada concluída' : 'Cancelada',
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        page.getByText('Reserva cancelada.', { exact: true }),
      ).toHaveCount(0);
      expect({ reads, posts }).toEqual({ reads: 2, posts: 1 });
    },
  );
}

test('page changes drop private data and refresh failure takes the student back to login', async ({
  page,
}) => {
  let signedIn = true;
  await serve(page, {
    authenticated: () => signedIn,
    list: (route, number) => {
      if (!signedIn) return route.fulfill({ status: 401, json: {} });
      return route.fulfill({
        json: pageOf([number === 1 ? active : canceled], {
          page: number,
          total: 11,
        }),
      });
    },
  });
  await page.goto('/minhas-reservas');
  await page.getByRole('button', { name: 'Mostrar código' }).click();
  await page.getByRole('button', { name: 'Próxima' }).click();
  await expect(page.getByText('Página 2 de 2')).toBeVisible();
  await expect(page.getByText(active.pickupCode)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Próxima' })).toBeDisabled();
  signedIn = false;
  await page.getByRole('button', { name: 'Anterior' }).click();
  await expect(page).toHaveURL(/entrar\?returnTo=%2Fminhas-reservas/);
  await expect(page.getByText(material.title)).toHaveCount(0);
});

test('loading, error and empty states give the student a retry and catalog path', async ({
  page,
}) => {
  let resolve;
  const gate = new Promise((r) => {
    resolve = r;
  });
  let reads = 0;
  await serve(page, {
    list: async (route) => {
      if (++reads === 1) {
        await gate;
        return route.fulfill({ status: 503, json: {} });
      }
      return route.fulfill({ json: pageOf([]) });
    },
  });
  await page.goto('/minhas-reservas');
  await expect(page.getByText('Carregando suas reservas…')).toBeVisible();
  resolve();
  await expect(page.getByRole('alert')).toContainText('indisponível');
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(
    page.getByRole('heading', { name: 'Você ainda não fez uma reserva' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Explorar o acervo' }),
  ).toHaveAttribute('href', '/catalogo');
});

for (const width of [390, 768, 1440]) {
  test(
    'history is accessible at ' + width + 'px with reduced motion',
    async ({ page }) => {
      await page.setViewportSize({ width, height: 850 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await serve(page, {
        list: (route) => route.fulfill({ json: pageOf([active]) }),
      });
      await page.goto('/minhas-reservas');
      await page.getByRole('button', { name: 'Mostrar código' }).click();
      await expect(page.getByText(active.pickupCode)).toBeVisible();
      const audit = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(audit.violations.map((v) => v.id)).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    },
  );
}

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  adminSession,
  approved,
  auditEvent,
  material,
  member,
  page as pageOf,
  pending,
  reservation,
  student,
} from './admin-fixtures.mjs';

const routes = [
  '/admin',
  '/admin/instituicoes',
  '/admin/instituicoes/' + approved.id,
  '/admin/usuarios',
  '/admin/materiais',
  '/admin/reservas',
  '/admin/auditoria',
  '/instituicoes/nova',
];

function handler(route, path, params) {
  if (route.request().method() === 'POST')
    return route.fulfill({ status: 204 });
  if (path === '/admin/institutions') {
    const status = params.get('status');
    return route.fulfill({
      json: pageOf(
        [pending, approved].filter(
          (item) => !status || item.status === status,
        ),
      ),
    });
  }
  if (path === '/admin/institutions/' + approved.id + '/members')
    return route.fulfill({ json: [member] });
  if (path === '/admin/users')
    return route.fulfill({ json: pageOf([student]) });
  if (path === '/admin/materials')
    return route.fulfill({ json: pageOf([material].filter((item) => !params.has('status') || item.status === params.get('status'))) });
  if (path === '/admin/reservations')
    return route.fulfill({ json: pageOf([reservation].filter((item) => !params.has('status') || item.status === params.get('status'))) });
  if (path === '/admin/audit-events')
    return route.fulfill({ json: pageOf([auditEvent]) });
  expect.unreachable('unhandled path ' + path);
}

for (const width of [390, 1440]) {
  test.describe('admin routes at ' + width + 'px', () => {
    for (const routePath of routes) {
      test(routePath + ' has no axe violations or horizontal overflow', async ({
        page,
      }) => {
        await adminSession(page, handler);
        await page.setViewportSize({ width, height: 844 });
        await page.goto(routePath);
        await expect(page.locator('main h1').first()).toBeVisible({
          timeout: 15000,
        });
        if (routePath === '/instituicoes/nova') {
          await expect(page.getByLabel('Instruções de retirada')).toBeVisible();
        } else {
          await expect(page.getByRole('table').first()).toBeVisible();
        }
        await expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        const result = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(
          result.violations.map(({ id, nodes }) => ({
            id,
            targets: nodes.map((n) => n.target),
          })),
        ).toEqual([]);
      });
    }
  });
}

test('admin nav and confirm buttons are reachable by keyboard', async ({
  page,
}) => {
  await adminSession(page, handler);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/admin/instituicoes?status=PENDING');
  const tabs = page.getByRole('navigation', { name: 'Administração' });
  await tabs.getByRole('link', { name: 'Usuários' }).focus();
  await expect(tabs.getByRole('link', { name: 'Usuários' })).toBeFocused();
  const approve = page
    .getByRole('row', { name: /Escola Horizonte/ })
    .getByRole('button', { name: 'Aprovar' });
  await approve.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Aprovar instituição' }),
  ).toBeVisible();
  const confirmation = page.getByRole('group', { name: /Aprovar Escola Horizonte/ });
  await expect(confirmation.locator('p')).toBeFocused();
  expect(await confirmation.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  await page.keyboard.press('Tab');
  await expect(confirmation.getByRole('button', { name: 'Aprovar instituição' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(confirmation).toHaveCount(0);
  await expect(approve).toBeFocused();
});

import { expect, test } from '@playwright/test';
import {
  admin,
  adminSession,
  approved,
  auditEvent,
  material,
  member,
  page as pageOf,
  pending,
  reservation,
  sessionAs,
  student,
} from './admin-fixtures.mjs';

test('o painel mostra métricas, pendências e atividade e leva à revisão', async ({
  page,
}) => {
  const reads = [];
  await adminSession(page, (route, path, params) => {
    reads.push(path);
    if (path === '/admin/institutions')
      return route.fulfill({
        json:
          params.get('status') === 'PENDING'
            ? pageOf([pending], 1, 5)
            : pageOf([approved], 1, 1),
      });
    if (path === '/admin/users') return route.fulfill({ json: pageOf([], 1, 1) });
    if (path === '/admin/materials')
      return route.fulfill({
        json: pageOf([{ ...material, status: 'AVAILABLE' }], 1, 1),
      });
    if (path === '/admin/reservations')
      return route.fulfill({
        json: pageOf(
          [
            {
              ...reservation,
              status: 'COMPLETED',
              completedAt: '2026-11-20T12:00:00Z',
            },
          ],
          1,
          1,
        ),
      });
    expect(path).toBe('/admin/audit-events');
    return route.fulfill({ json: pageOf([auditEvent], 1, 8) });
  });
  await page.goto('/admin');
  await expect(
    page.getByRole('heading', { name: 'Visão geral' }),
  ).toBeVisible({ timeout: 15000 });
  const metrics = page.locator('.admin-metrics');
  await expect(metrics.getByText('Aprovações pendentes')).toBeVisible();
  await expect(
    page.getByText('Uma instituição aguarda análise'),
  ).toBeVisible();
  await expect(
    page.getByRole('row', { name: /Instituição aprovada/ }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Revisar cadastros pendentes' }).click();
  await expect(page).toHaveURL(/\/admin\/instituicoes\?status=PENDING/);
  expect(reads).toContain('/admin/audit-events');
});

test('instituições pendentes são aprovadas ou recusadas com justificativa', async ({
  page,
}) => {
  let state = 'PENDING';
  const posts = [];
  await adminSession(page, async (route, path) => {
    if (route.request().method() === 'POST') {
      posts.push(path);
      if (path.endsWith('/reject'))
        expect(route.request().postDataJSON()).toEqual({
          reason: 'Endereço fora da área atendida',
        });
      state = path.endsWith('/approve') ? 'APPROVED' : 'REJECTED';
      return route.fulfill({
        json: {
          ...pending,
          status: state,
          isActive: state === 'APPROVED',
        },
      });
    }
    expect(path).toBe('/admin/institutions');
    return route.fulfill({
      json: pageOf([
        { ...pending, status: state, isActive: state === 'APPROVED' },
      ]),
    });
  });
  await page.goto('/admin/instituicoes?status=PENDING');
  const row = page.getByRole('row', { name: /Escola Horizonte/ });
  await expect(row.getByText('Pendente')).toBeVisible();
  await row.getByRole('button', { name: 'Aprovar' }).click();
  await page
    .getByRole('button', { name: 'Aprovar instituição' })
    .click();
  await expect(posts).toEqual([
    '/admin/institutions/' + pending.id + '/approve',
  ]);
  await page.getByLabel('Situação do cadastro').selectOption('');
  const row2 = page.getByRole('row', { name: /Escola Horizonte/ });
  await expect(row2.getByText('Ativa')).toBeVisible();

  state = 'PENDING';
  await page.getByLabel('Situação do cadastro').selectOption('PENDING');
  await page
    .getByRole('row', { name: /Escola Horizonte/ })
    .getByRole('button', { name: 'Recusar' })
    .click();
  await page.getByLabel('Justificativa').fill('Endereço fora da área atendida');
  await page.getByRole('button', { name: 'Recusar cadastro' }).click();
  await expect(posts).toEqual([
    '/admin/institutions/' + pending.id + '/approve',
    '/admin/institutions/' + pending.id + '/reject',
  ]);
});

test('o detalhe gerencia ciclo de vida e membros da equipe', async ({
  page,
}) => {
  const posts = [];
  await adminSession(page, async (route, path, params) => {
    if (route.request().method() === 'POST') {
      posts.push(path);
      if (path.endsWith('/members')) {
        expect(route.request().postDataJSON()).toEqual({ userId: student.id });
        return route.fulfill({ status: 201, json: member });
      }
      return route.fulfill({ status: 204 });
    }
    if (path === '/admin/institutions')
      return route.fulfill({ json: pageOf([approved]) });
    if (path === '/admin/institutions/' + approved.id + '/members')
      return route.fulfill({ json: [member] });
    expect(path).toBe('/admin/users');
    expect(params.get('q')).toBe('aluna');
    return route.fulfill({ json: pageOf([student], 1, 5) });
  });
  await page.goto('/admin/instituicoes/' + approved.id);
  await expect(
    page.getByRole('heading', { name: approved.name }),
  ).toBeVisible();
  await expect(page.getByText('Equipe de teste')).toBeVisible();

  await page.getByLabel('Buscar por nome ou e-mail').fill('aluna');
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page.getByText('Estudante de teste')).toBeVisible();
  await page.getByRole('button', { name: 'Vincular', exact: true }).click();
  await expect(posts).toEqual([
    '/admin/institutions/' + approved.id + '/members',
  ]);

  await page
    .getByRole('row', { name: /Equipe de teste/ })
    .getByRole('button', { name: 'Desvincular' })
    .click();
  await page.getByRole('button', { name: 'Desvincular membro' }).click();
  await expect(posts).toEqual([
    '/admin/institutions/' + approved.id + '/members',
    '/admin/institutions/' + approved.id + '/members/' + member.userId + '/revoke',
  ]);

  await page
    .getByRole('button', { name: 'Suspender instituição' })
    .click();
  await page
    .locator('.donation-confirm')
    .getByRole('button', { name: 'Suspender instituição' })
    .click();
  await expect(posts).toContain(
    '/admin/institutions/' + approved.id + '/deactivate',
  );
});

test('usuários mudam de função e acesso; admin e a própria conta ficam protegidos', async ({
  page,
}) => {
  const posts = [];
  await adminSession(page, async (route, path) => {
    if (route.request().method() === 'POST') {
      posts.push(path);
      if (path.endsWith('/role'))
        expect(route.request().postDataJSON()).toEqual({ role: 'STAFF' });
      return route.fulfill({
        json: { ...student, role: 'STAFF', isActive: !path.endsWith('/deactivate') },
      });
    }
    expect(path).toBe('/admin/users');
    return route.fulfill({
      json: pageOf([student, { ...member, membershipCount: 1, isActive: true, updatedAt: member.createdAt, id: member.userId, displayName: member.displayName, role: 'ADMIN', email: admin.email }]),
    });
  });
  await page.goto('/admin/usuarios');
  const studentRow = page.getByRole('row', { name: /Estudante de teste/ });
  await studentRow.getByRole('button', { name: 'Tornar equipe' }).click();
  await studentRow
    .locator('.donation-confirm')
    .getByRole('button', { name: 'Tornar equipe' })
    .click();
  await expect(posts).toEqual(['/admin/users/' + student.id + '/role']);
  await expect(
    page.getByRole('row', { name: /Administração de teste|admin@example/ }).getByText('Gerida fora da plataforma'),
  ).toBeVisible();
});

test('materiais, reservas e auditoria são consultas sem códigos de retirada', async ({
  page,
}) => {
  await adminSession(page, (route, path) => {
    if (path === '/admin/materials')
      return route.fulfill({ json: pageOf([material]) });
    if (path === '/admin/reservations')
      return route.fulfill({
        json: pageOf([{ ...reservation, pickupCode: '1234-5678-90' }]),
      });
    if (path === '/admin/audit-events')
      return route.fulfill({ json: pageOf([auditEvent]) });
    expect(path).toBe('/admin/institutions');
    return route.fulfill({ json: pageOf([approved]) });
  });
  await page.goto('/admin/materiais');
  await expect(
    page.getByRole('cell', { name: /Gramática sintética/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'Reservado' }),
  ).toBeVisible();
  await page.goto('/admin/reservas');
  await expect(
    page.getByRole('cell', { name: 'Aguardando retirada' }),
  ).toBeVisible();
  await expect(page.getByText('1234-5678-90')).toHaveCount(0);
  await page.goto('/admin/auditoria');
  await expect(page.getByText('Instituição aprovada')).toBeVisible();
  await page.getByLabel('Filtrar por ação').fill('admin.institution_');
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await expect(page).toHaveURL(/acao=admin\.institution_/);
});

test('estudantes e equipe não acessam a administração; cadastro institucional é aberto', async ({
  page,
}) => {
  await sessionAs(page, 'STUDENT');
  await page.goto('/admin');
  await expect(
    page.getByRole('heading', { name: 'Acesso restrito' }),
  ).toBeVisible();
  await page.goto('/instituicoes/nova');
  await expect(
    page.getByRole('heading', { name: 'Cadastrar instituição' }),
  ).toBeVisible();
});

test('o cadastro institucional envia os três campos públicos e confirma a análise', async ({
  page,
}) => {
  let posted;
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.slice('/api/v1'.length);
    if (path === '/auth/refresh')
      return route.fulfill({
        json: {
          user: { ...admin, role: 'STUDENT' },
          accessToken: 'synthetic-student',
          expiresIn: 900,
        },
      });
    expect(path).toBe('/institutions');
    expect(route.request().method()).toBe('POST');
    posted = route.request().postDataJSON();
    return route.fulfill({
      status: 201,
      json: { id: pending.id, ...posted },
    });
  });
  await page.goto('/instituicoes/nova');
  await page.getByLabel('Nome da instituição').fill('Biblioteca Comunitária X');
  await page.getByLabel('Endereço público').fill('Rua dos Testes, 10 — Centro');
  await page
    .getByLabel('Instruções de retirada')
    .fill('Balcão da entrada, seg–sex 9h–17h.');
  await page.getByRole('button', { name: 'Enviar para análise' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Cadastro enviado para análise',
  );
  expect(posted).toEqual({
    name: 'Biblioteca Comunitária X',
    publicAddress: 'Rua dos Testes, 10 — Centro',
    pickupInstructions: 'Balcão da entrada, seg–sex 9h–17h.',
  });
});

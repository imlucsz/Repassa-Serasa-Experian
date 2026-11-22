import { expect, test } from '@playwright/test';

const account = {
  id: '085f7cb8-4558-412c-bec2-5c76294779c4',
  role: 'STUDENT',
  email: 'estudante@example.invalid',
  displayName: 'Estudante',
};

test('perfil restaura sessão, edita somente o nome e encerra o acesso', async ({
  page,
}) => {
  let user = { ...account };
  let signedOut = false;
  const writes = [];
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/auth/refresh'))
      return route.fulfill(
        signedOut
          ? { status: 401, json: {} }
          : { json: { user, accessToken: 'test-profile', expiresIn: 900 } },
      );
    if (path.endsWith('/auth/logout')) {
      expect(request.headers()['x-repassa-request']).toBe('1');
      signedOut = true;
      return route.fulfill({ status: 204 });
    }
    if (path.endsWith('/me')) {
      expect(request.headers().authorization).toBe('Bearer test-profile');
      if (request.method() === 'PATCH') {
        writes.push(request.postDataJSON());
        user = { ...user, displayName: request.postDataJSON().displayName };
      }
      return route.fulfill({ json: user });
    }
    throw Error('Requisição inesperada ' + path);
  });
  await page.goto('/perfil');
  await page.getByLabel('Nome de exibição').fill('Estudante de teste');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByText('Nome atualizado.')).toBeVisible();
  expect(writes).toEqual([{ displayName: 'Estudante de teste' }]);
  await page.reload();
  await expect(page.getByLabel('Nome de exibição')).toHaveValue(
    'Estudante de teste',
  );
  await page.getByRole('button', { name: 'Encerrar sessão' }).click();
  await expect(page).toHaveURL(/entrar\?returnTo=%2Fperfil/);
  await expect.poll(() => signedOut).toBe(true);
});

test('sessão indisponível pode ser consultada novamente antes do redirecionamento', async ({
  page,
}) => {
  let attempts = 0;
  await page.route('**/api/v1/auth/refresh', (route) =>
    route.fulfill({ status: ++attempts === 1 ? 503 : 401, json: {} }),
  );
  await page.goto('/doar');
  await expect(
    page.getByRole('heading', {
      name: 'Não foi possível verificar sua sessão',
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page).toHaveURL(/entrar\?returnTo=%2Fdoar/);
});

for (const [role, path] of [['STUDENT', '/instituicao/recebimentos'], ['STAFF', '/doar']]) {
  test(role + ' recebe acesso restrito em ' + path, async ({ page }) => {
    const privateCalls = [];
    await page.route('**/api/v1/**', route => {
      if (new URL(route.request().url()).pathname.endsWith('/auth/refresh'))
        return route.fulfill({ json: { user: {...account, role}, accessToken: 'test-role', expiresIn: 900 } });
      privateCalls.push(route.request().method());
      return route.fulfill({status:403,json:{}});
    });
    await page.goto(path);
    await expect(page.getByRole('heading',{name:'Acesso restrito'})).toBeVisible();
    expect(privateCalls).toEqual([]);
  });
}

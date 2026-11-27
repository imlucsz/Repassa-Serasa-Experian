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
  await page.setViewportSize({ width: 320, height: 844 });
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
  const navigation = page.getByRole('navigation', { name: 'Área da conta' });
  const links = navigation.getByRole('link');
  await expect(links).toHaveCount(4);
  await expect(navigation.getByRole('link', { name: 'Meu perfil' })).toHaveAttribute('aria-current', 'page');
  expect(await links.evaluateAll(items => new Set(items.map(item => item.offsetTop)).size)).toBe(1);
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

test('a missing page restores its title after client-side navigation', async ({ page }) => {
  await page.route('**/api/v1/auth/refresh', route => route.fulfill({ status: 401, json: {} }));
  await page.goto('/pagina-desconhecida');
  await page.getByRole('link', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveTitle('Entrar | RePassa');
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'Página indisponível' })).toBeVisible();
  await expect(page).toHaveTitle('Página indisponível · RePassa');
});

test('registration associates password and consent guidance with the relevant input', async ({ page }) => {
  await page.route('**/api/v1/auth/refresh', route => route.fulfill({ status: 401, json: {} }));
  let posts = 0;
  await page.route('**/api/v1/auth/register', route => {
    posts++;
    return route.fulfill({ status: 201, json: { user: account, accessToken: 'synthetic-registration', expiresIn: 900 } });
  });
  await page.route('**/api/v1/me', route => route.fulfill({ json: account }));
  await page.goto('/cadastro?returnTo=%2Fperfil');
  await page.getByLabel('Nome de exibição').fill(account.displayName);
  await page.getByLabel('E-mail', { exact: true }).fill(account.email);
  const password = page.getByLabel('Crie uma senha', { exact: true });
  const confirmation = page.getByLabel('Confirme sua senha', { exact: true });
  await password.fill('amostra-de-teste');
  await confirmation.fill('diferente');
  await expect(confirmation).toHaveAccessibleDescription('As senhas precisam ser iguais.');
  const toggle = page.getByRole('button', { name: 'Mostrar senha' });
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(password).toHaveAttribute('type', 'text');
  await confirmation.fill('amostra-de-teste');
  await expect(confirmation).toHaveAttribute('aria-invalid', 'false');
  const consent = page.getByRole('checkbox');
  await expect(consent).toHaveAccessibleDescription(/nome e e-mail/);
  const submit = page.getByRole('button', { name: 'Criar conta de estudante' });
  await submit.click();
  await expect(consent).toBeFocused();
  expect(posts).toBe(0);
  await consent.check();
  await submit.click();
  await expect(page).toHaveURL(/\/perfil$/);
  expect(posts).toBe(1);
});

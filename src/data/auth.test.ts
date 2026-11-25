import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authenticatedFetch,
  getAuthUser,
  login,
  logout,
  safeReturnTo,
} from './auth.ts';

test('safeReturnTo accepts local destinations and rejects external and auth-loop targets', () => {
  assert.equal(
    safeReturnTo('/materiais/123?tab=details#pickup'),
    '/materiais/123?tab=details#pickup',
  );
  assert.equal(safeReturnTo('https://example.com'), '/catalogo');
  assert.equal(safeReturnTo('//example.com/path'), '/catalogo');
  assert.equal(safeReturnTo('/entrar?returnTo=/entrar'), '/catalogo');
  assert.equal(safeReturnTo('/cadastro?next=/cadastro'), '/catalogo');
  assert.equal(safeReturnTo('/\u005c\u005cexample.com'), '/catalogo');
  assert.equal(safeReturnTo('/materiais/123', '/'), '/materiais/123');
  assert.equal(safeReturnTo('/admin'), '/catalogo');
  assert.equal(safeReturnTo('/minhas-reservas'), '/minhas-reservas');
  assert.equal(
    safeReturnTo('/instituicao/retirada?instituicao=A'),
    '/instituicao/retirada?instituicao=A',
  );
  assert.equal(safeReturnTo('///example.com'), '/catalogo');
  assert.equal(safeReturnTo('/catalogo/../entrar'), '/catalogo');
  assert.equal(safeReturnTo('/materiais/123/extra'), '/catalogo');
});

test('concurrent 401 responses share one refresh and retry each request once', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  let refreshCount = 0;
  const requestCounts = new Map<string, number>();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { origin: 'http://localhost' } },
  });
  globalThis.fetch = async (input, init) => {
    const request =
      input instanceof Request
        ? new Request(input, init)
        : new Request(new URL(String(input), 'http://localhost'), init);
    const path = new URL(request.url).pathname;
    if (path.endsWith('/auth/login')) {
      return Response.json({
        accessToken: 'first-token',
        expiresIn: 900,
        user: {
          id: 'student-1',
          displayName: 'Estudante',
          email: 'aluno@example.com',
          role: 'STUDENT',
        },
      });
    }
    if (path.endsWith('/auth/refresh')) {
      refreshCount++;
      await new Promise((resolve) => setTimeout(resolve, 15));
      return Response.json({
        accessToken: 'second-token',
        expiresIn: 900,
        user: {
          id: 'student-1',
          displayName: 'Estudante',
          email: 'aluno@example.com',
          role: 'STUDENT',
        },
      });
    }
    const count = (requestCounts.get(path) ?? 0) + 1;
    requestCounts.set(path, count);
    if (request.headers.get('Authorization') !== 'Bearer second-token')
      return new Response(null, { status: 401 });
    return Response.json({ ok: true, count });
  };
  try {
    await login({ email: 'aluno@example.com', password: 'password' });
    const responses = await Promise.all([
      authenticatedFetch('/api/v1/private/a'),
      authenticatedFetch('/api/v1/private/b'),
    ]);
    assert.equal(refreshCount, 1);
    assert.deepEqual(
      responses.map((response) => response.status),
      [200, 200],
    );
    assert.deepEqual([...requestCounts.values()], [2, 2]);
    await assert.rejects(
      authenticatedFetch('https://outside.example/api/v1/private'),
      /API segura/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
  }
});

test('a refresh response arriving after logout cannot restore the old session', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  let releaseRefresh: (() => void) | undefined;
  let notifyRefreshStarted: (() => void) | undefined;
  const refreshStarted = new Promise<void>(
    (resolve) => (notifyRefreshStarted = resolve),
  );
  let privateRetries = 0;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { origin: 'http://localhost' } },
  });
  globalThis.fetch = async (input, init) => {
    const request =
      input instanceof Request
        ? new Request(input, init)
        : new Request(new URL(String(input), 'http://localhost'), init);
    const path = new URL(request.url).pathname;
    if (path.endsWith('/auth/login'))
      return Response.json({
        accessToken: 'session-token',
        expiresIn: 900,
        user: {
          id: 'student-2',
          displayName: 'Estudante',
          email: 'aluno@example.com',
          role: 'STUDENT',
        },
      });
    if (path.endsWith('/auth/refresh')) {
      notifyRefreshStarted?.();
      await new Promise<void>((resolve) => (releaseRefresh = resolve));
      return Response.json({
        accessToken: 'stale-token',
        expiresIn: 900,
        user: {
          id: 'student-2',
          displayName: 'Estudante',
          email: 'aluno@example.com',
          role: 'STUDENT',
        },
      });
    }
    if (path.endsWith('/auth/logout'))
      return new Response(null, { status: 204 });
    privateRetries++;
    return new Response(null, { status: 401 });
  };
  try {
    await login({ email: 'aluno@example.com', password: 'password' });
    const pendingRequest = authenticatedFetch('/api/v1/private');
    await refreshStarted;
    await logout();
    releaseRefresh?.();
    const response = await pendingRequest;
    assert.equal(response.status, 401);
    assert.equal(privateRetries, 1);
  } finally {
    releaseRefresh?.();
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
  }
});

test('a second 401 clears only the rejected session and stops retrying', async (t) => {
  const previous = globalThis.window;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { origin: 'http://localhost' } },
  });
  const calls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: Request | string) => {
    const path = new URL(
      input instanceof Request ? input.url : input,
      'http://localhost',
    ).pathname;
    calls.push(path);
    if (path.includes('/auth/'))
      return Response.json({
        accessToken: path.endsWith('/refresh')
          ? 'synthetic-new'
          : 'synthetic-old',
        expiresIn: 900,
        user: {
          id: 'student-test',
          displayName: 'Teste',
          email: 'teste@example.invalid',
          role: 'STUDENT',
        },
      });
    return new Response(null, { status: 401 });
  });
  try {
    await login({ email: 'teste@example.invalid', password: 'synthetic' });
    const path = '/api/v1/me/reservations';
    assert.equal((await authenticatedFetch(path)).status, 401);
    assert.equal(getAuthUser(), null);
    assert.deepEqual(calls, [
      '/api/v1/auth/login',
      path,
      '/api/v1/auth/refresh',
      path,
    ]);
  } finally {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: previous,
    });
  }
});

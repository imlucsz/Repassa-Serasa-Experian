import { useSyncExternalStore } from 'react';
import { isDemo } from './catalog.ts';

export type AuthUser = {
  id: string;
  displayName: string;
  email: string;
  role: 'STUDENT' | 'STAFF' | 'ADMIN';
};

export type AuthResponse = {
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
};

export type LoginInput = { email: string; password: string };
export type RegisterInput = LoginInput & { displayName: string };

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status = 0,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

let accessToken: string | null = null;
let currentUser: AuthUser | null = null;
let refreshFlight: Promise<string | null> | null = null;
let sessionVersion = 0;
const listeners = new Set<() => void>();

function publish() {
  listeners.forEach((listener) => listener());
}

export function subscribeAuth(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAuthUser() {
  return currentUser;
}

export function useAuthUser() {
  return useSyncExternalStore(subscribeAuth, getAuthUser, () => null);
}

export function getAccessToken() {
  return accessToken;
}

function saveSession(session: AuthResponse) {
  if (!session || typeof session !== 'object')
    throw new AuthError('A resposta de autenticação é inválida.', 502);
  const user = session.user as Partial<AuthUser> | undefined;
  if (
    typeof session.accessToken !== 'string' ||
    !session.accessToken ||
    !Number.isSafeInteger(session.expiresIn) ||
    session.expiresIn < 1 ||
    !user ||
    typeof user.id !== 'string' ||
    typeof user.email !== 'string' ||
    typeof user.displayName !== 'string' ||
    !['STUDENT', 'STAFF', 'ADMIN'].includes(user.role ?? '')
  )
    throw new AuthError('A resposta de autenticação é inválida.', 502);
  accessToken = session.accessToken;
  currentUser = session.user;
  publish();
  return session;
}

function requestHeaders(json = false) {
  return {
    Accept: 'application/json',
    'X-Repassa-Request': '1',
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      // Use the status-specific message when an intermediary returns no JSON.
    }
    const messages: Record<number, string> = {
      400: 'Revise os dados informados.',
      401: 'E-mail ou senha não conferem.',
      403: 'A solicitação não foi autorizada.',
      409: 'Este e-mail já possui cadastro.',
      429: 'Muitas tentativas. Aguarde um pouco e tente novamente.',
      503: 'O serviço está temporariamente indisponível.',
    };
    const errorBody =
      payload && typeof payload === 'object'
        ? (payload as Record<string, unknown>)
        : {};
    const fieldErrors =
      errorBody.fieldErrors && typeof errorBody.fieldErrors === 'object'
        ? Object.fromEntries(
            Object.entries(errorBody.fieldErrors).filter(
              (entry): entry is [string, string[]] =>
                Array.isArray(entry[1]) &&
                entry[1].every((message) => typeof message === 'string'),
            ),
          )
        : undefined;
    throw new AuthError(
      (typeof errorBody.message === 'string' ? errorBody.message : undefined) ??
        messages[response.status] ??
        'Não foi possível concluir. Tente novamente.',
      response.status,
      fieldErrors,
    );
  }
  if (response.status === 204) return undefined as T;
  try {
    return (await response.json()) as T;
  } catch {
    throw new AuthError('A resposta de autenticação é inválida.', 502);
  }
}

async function authPost<T>(route: string, body?: object): Promise<T> {
  if (isDemo)
    throw new AuthError(
      'A autenticação real ainda não está disponível nesta demonstração.',
      503,
    );
  try {
    const response = await fetch(`/api/v1/auth/${route}`, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      headers: requestHeaders(body !== undefined),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return await parseResponse<T>(response);
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError(
      'Não foi possível conectar ao serviço. Tente novamente.',
    );
  }
}

export async function login(input: LoginInput) {
  const version = ++sessionVersion;
  const session = await authPost<AuthResponse>('login', input);
  if (version !== sessionVersion)
    throw new AuthError('A sessão foi encerrada. Tente entrar novamente.', 401);
  return saveSession(session);
}

export async function register(input: RegisterInput) {
  const version = ++sessionVersion;
  const session = await authPost<AuthResponse>('register', input);
  if (version !== sessionVersion)
    throw new AuthError('A sessão foi encerrada. Tente entrar novamente.', 401);
  return saveSession(session);
}

async function refresh(): Promise<string | null> {
  if (isDemo) return null;
  if (!refreshFlight) {
    const version = sessionVersion;
    refreshFlight = authPost<AuthResponse>('refresh')
      .then((session) => {
        if (version !== sessionVersion) return null;
        return saveSession(session).accessToken;
      })
      .catch((error: unknown) => {
        if (!(error instanceof AuthError) || ![401, 403].includes(error.status))
          throw error;
        if (version === sessionVersion) clearSession();
        return null;
      })
      .finally(() => {
        refreshFlight = null;
      });
  }
  return refreshFlight;
}

export async function restoreSession() {
  if (isDemo) return null;
  await refresh();
  return currentUser;
}

function clearSession() {
  sessionVersion++;
  accessToken = null;
  currentUser = null;
  publish();
}

export async function logout() {
  clearSession();
  if (!isDemo) {
    await authPost<void>('logout');
  }
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  if (isDemo)
    throw new AuthError(
      'Esta ação exige autenticação real, indisponível na demonstração.',
      503,
    );
  const request =
    input instanceof Request
      ? new Request(input, init)
      : new Request(new URL(String(input), window.location.origin), init);
  const requestUrl = new URL(request.url);
  const canAuthenticate =
    requestUrl.origin === window.location.origin &&
    requestUrl.pathname.startsWith('/api/v1/');
  if (!canAuthenticate)
    throw new AuthError(
      'A solicitação precisa usar a API segura do RePassa.',
      400,
    );
  const send = (token: string | null) => {
    const headers = new Headers(request.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method))
      headers.set('X-Repassa-Request', '1');
    return fetch(
      new Request(request.clone(), {
        headers,
        cache: 'no-store',
        redirect: 'error',
      }),
    );
  };
  const startingVersion = sessionVersion;
  const startingUserId = currentUser?.id ?? null;
  const tokenAtRequest = accessToken;
  let response = await send(tokenAtRequest);
  if (response.status === 401) {
    if (
      startingVersion !== sessionVersion ||
      startingUserId !== (currentUser?.id ?? null)
    )
      return response;
    const token =
      accessToken !== tokenAtRequest && accessToken
        ? accessToken
        : await refresh();
    if (
      token &&
      startingVersion === sessionVersion &&
      startingUserId === (currentUser?.id ?? null)
    ) {
      response = await send(token);
      if (
        response.status === 401 &&
        token === accessToken &&
        startingVersion === sessionVersion &&
        startingUserId === (currentUser?.id ?? null)
      )
        clearSession();
    }
  }
  return response;
}

export function safeReturnTo(value: string | null, fallback = '/catalogo') {
  if (
    !value ||
    !value.startsWith('/') ||
    value.includes('\\') ||
    value.includes('\u0000')
  )
    return fallback;
  try {
    const url = new URL(value, 'https://repassa.invalid');
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    const implementedPath =
      pathname === '/' ||
      [
        '/catalogo',
        '/perfil',
        '/doar',
        '/minhas-doacoes',
        '/minhas-reservas',
        '/instituicao',
        '/instituicao/recebimentos',
        '/instituicao/estoque',
        '/instituicao/retirada',
        '/instituicoes/nova',
        '/admin',
        '/admin/instituicoes',
        '/admin/usuarios',
        '/admin/materiais',
        '/admin/reservas',
        '/admin/auditoria',
      ].includes(pathname) ||
      /^\/materiais\/[a-z\d_-]+$/i.test(pathname) ||
      /^\/admin\/instituicoes\/[a-z\d_-]+$/i.test(pathname);
    return url.origin === 'https://repassa.invalid' && implementedPath
      ? `${pathname}${url.search}${url.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}

export async function requestProfile(
  signal: AbortSignal,
  displayName?: string,
): Promise<AuthUser> {
  const owner = currentUser?.id;
  const version = sessionVersion;
  const response = await authenticatedFetch('/api/v1/me', {
    method: displayName === undefined ? 'GET' : 'PATCH',
    headers: requestHeaders(displayName !== undefined),
    body:
      displayName === undefined ? undefined : JSON.stringify({ displayName }),
    signal,
  });
  const profile = await parseResponse<AuthUser>(response);
  if (
    !owner ||
    profile?.id !== owner ||
    typeof profile.displayName !== 'string' ||
    typeof profile.email !== 'string' ||
    !['STUDENT', 'STAFF', 'ADMIN'].includes(profile.role)
  )
    throw new AuthError('Resposta de perfil inválida.', 502);
  signal.throwIfAborted();
  if (version !== sessionVersion || owner !== currentUser?.id)
    throw new AuthError('Sessão alterada.', 401);
  currentUser = profile;
  publish();
  return profile;
}

import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../src/config/env.validation';
import {
  SupabaseObjectStore,
  type FetchLike,
} from '../../src/uploads/supabase-object-store';

const KEY = '3f4f8a2a-1111-4222-8333-9abcdef01234.jpg';

function configStub(values: Partial<EnvConfig>): ConfigService<EnvConfig, true> {
  return {
    get: (k: keyof EnvConfig) => values[k],
  } as unknown as ConfigService<EnvConfig, true>;
}

const CONFIG = configStub({
  supabaseUrl: 'https://proj.supabase.co/',
  supabaseServiceRoleKey: 'service-role-secret',
  supabaseStorageBucket: 'repassa-uploads',
});

interface Call {
  url: string;
  method?: string;
  headers?: Record<string, string>;
}

function fakeFetch(impl: (url: string, init?: Call) => { ok: boolean; status: number; body?: string }) {
  const calls: Call[] = [];
  const fetch: FetchLike = (url, init) => {
    calls.push({ url, method: init?.method, headers: init?.headers });
    const r = impl(url, { url, method: init?.method, headers: init?.headers });
    return Promise.resolve({
      ok: r.ok,
      status: r.status,
      arrayBuffer: () => {
        const b = Buffer.from(r.body ?? '');
        return Promise.resolve(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
      },
    });
  };
  return { fetch, calls };
}

describe('SupabaseObjectStore', () => {
  it('put() posts the object with service-role auth and no upsert', async () => {
    const { fetch, calls } = fakeFetch(() => ({ ok: true, status: 200 }));
    const store = new SupabaseObjectStore(CONFIG, fetch);
    await store.put(KEY, Buffer.from('img'), 'image/jpeg');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      'https://proj.supabase.co/storage/v1/object/repassa-uploads/' + KEY,
    );
    expect(calls[0].method).toBe('POST');
    expect(calls[0].headers?.authorization).toBe('Bearer service-role-secret');
    expect(calls[0].headers?.['x-upsert']).toBe('false');
    expect(calls[0].headers?.['content-type']).toBe('image/jpeg');
  });

  it('put() collapses storage failures to a safe 503 (no secrets/response body)', async () => {
    const { fetch } = fakeFetch(() => ({
      ok: false,
      status: 403,
      body: '{"error":"policy violation secret-data"}',
    }));
    const store = new SupabaseObjectStore(CONFIG, fetch);
    await expect(store.put(KEY, Buffer.from('x'), 'image/png')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('put() maps network failures to 503', async () => {
    const fetch: FetchLike = () => Promise.reject(new Error('ENOTFOUND'));
    const store = new SupabaseObjectStore(CONFIG, fetch);
    await expect(store.put(KEY, Buffer.from('x'), 'image/png')).rejects.toThrow(
      'Storage service unavailable',
    );
  });

  it('get() returns bytes for existing objects and undefined for 404/400', async () => {
    const { fetch } = fakeFetch((url) =>
      url.endsWith(KEY) ? { ok: true, status: 200, body: 'bytes' } : { ok: false, status: 404 },
    );
    const store = new SupabaseObjectStore(CONFIG, fetch);
    expect(await store.get(KEY)).toEqual(Buffer.from('bytes'));
    const { fetch: missing } = fakeFetch(() => ({ ok: false, status: 404 }));
    expect(await new SupabaseObjectStore(CONFIG, missing).get(KEY)).toBeUndefined();
  });

  it('get() rejects malformed keys without a request and maps 5xx to 503', async () => {
    const { fetch, calls } = fakeFetch(() => ({ ok: false, status: 500 }));
    const store = new SupabaseObjectStore(CONFIG, fetch);
    expect(await store.get('../../../etc/passwd')).toBeUndefined();
    expect(calls).toHaveLength(0);
    await expect(store.get(KEY)).rejects.toThrow(ServiceUnavailableException);
  });

  it('refuses construction without credentials', () => {
    expect(() => new SupabaseObjectStore(configStub({}), fakeFetch(() => ({ ok: true, status: 200 })).fetch)).toThrow(
      /SUPABASE_URL\/SUPABASE_SERVICE_ROLE_KEY/,
    );
  });
});

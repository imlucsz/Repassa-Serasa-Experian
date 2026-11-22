import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../config/env.validation';
import { ObjectStore, OBJECT_KEY_PATTERN } from './object-store';

/** Minimal fetch surface — injectable so tests can use a controlled double. */
export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: Buffer },
) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>;

const STORAGE_UNAVAILABLE = 'Storage service unavailable';

/**
 * Supabase Storage adapter over the plain REST object API — no extra
 * dependency. The bucket must be PRIVATE: every object read goes through the
 * service-role key on the server and is then gated by the application's own
 * authorization layer (`GET /uploads/:key`). The service-role key is never
 * exposed to clients and never appears in error messages or logs.
 */
@Injectable()
export class SupabaseObjectStore extends ObjectStore {
  private readonly baseUrl: string;
  private readonly bucket: string;
  private readonly serviceRoleKey: string;
  private readonly fetchImpl: FetchLike;

  constructor(
    config: ConfigService<EnvConfig, true>,
    fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike,
  ) {
    super();
    const url = config.get('supabaseUrl', { infer: true });
    const key = config.get('supabaseServiceRoleKey', { infer: true });
    if (!url || !key) {
      throw new Error('Supabase storage driver selected without SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY');
    }
    this.baseUrl = url.replace(/\/+$/, '');
    this.bucket = config.get('supabaseStorageBucket', { infer: true });
    this.serviceRoleKey = key;
    this.fetchImpl = fetchImpl;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const res = await this.request(this.objectUrl(key), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.serviceRoleKey}`,
        'content-type': contentType,
        'x-upsert': 'false',
      },
      body,
    });
    if (!res.ok) throw new ServiceUnavailableException(STORAGE_UNAVAILABLE);
  }

  async get(key: string): Promise<Buffer | undefined> {
    if (!OBJECT_KEY_PATTERN.test(key)) return undefined;
    const res = await this.request(this.objectUrl(key), {
      method: 'GET',
      headers: { authorization: `Bearer ${this.serviceRoleKey}` },
    });
    if (res.status === 404 || res.status === 400) return undefined;
    if (!res.ok) throw new ServiceUnavailableException(STORAGE_UNAVAILABLE);
    return Buffer.from(await res.arrayBuffer());
  }

  /** Network/adapter failures collapse to a safe 503 — response bodies may carry key/tenant data. */
  private async request(url: string, init: Parameters<FetchLike>[1]) {
    try {
      return await this.fetchImpl(url, init);
    } catch {
      throw new ServiceUnavailableException(STORAGE_UNAVAILABLE);
    }
  }

  private objectUrl(key: string): string {
    return `${this.baseUrl}/storage/v1/object/${encodeURIComponent(this.bucket)}/${key}`;
  }
}

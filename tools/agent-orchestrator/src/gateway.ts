// OpenAI-compatible gateway client (localhost-only by config), plus a mock
// backend for offline tests. No retries beyond config.gateway.maxRetries.
import type { OrchestratorConfig } from './config.js';
import { assertLocalUrl } from './safety.js';

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }
export interface CompletionResult {
  ok: boolean;
  content?: string;
  provider?: string;
  model?: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  latencyMs: number;
  error?: { code: string; message: string; retryable?: boolean };
}

async function postJson(url: string, body: unknown, apiKey: string | undefined, timeoutMs: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 2000) }; }
    return { status: res.status, json };
  } finally { clearTimeout(timer); }
}

export async function chatCompletion(
  cfg: OrchestratorConfig,
  model: string,
  messages: ChatMessage[],
  maxTokens: number,
  timeoutSec?: number,
): Promise<CompletionResult> {
  if (cfg.gateway.type === 'mock') {
    const sys = messages.find((m) => m.role === 'system')?.content ?? '';
    const user = messages.map((m) => m.content).join('\n---\n');
    return {
      ok: true,
      provider: 'mock',
      model: `mock/${model}`,
      content: `[mock response]\nmodel=${model}\nsystem_len=${sys.length}\nrequest_sha=${simpleHash(user)}\nsummary: simulated answer for testing only.`,
      usage: { inputTokens: Math.ceil((sys.length + user.length) / 4), outputTokens: 64, totalTokens: Math.ceil((sys.length + user.length) / 4) + 64 },
      latencyMs: 1,
    };
  }
  assertLocalUrl(cfg.gateway.baseUrl, cfg.safety.localhostOnly);
  const apiKey = cfg.gateway.apiKeyEnv ? process.env[cfg.gateway.apiKeyEnv] : undefined;
  const started = Date.now();
  const timeout = Math.min(timeoutSec ?? cfg.gateway.timeoutSec, cfg.gateway.maxTimeoutSec) * 1000;
  let attempt = 0;
  const maxAttempts = 1 + cfg.gateway.maxRetries;
  let lastErr: CompletionResult['error'] | undefined;
  while (attempt < maxAttempts) {
    attempt++;
    try {
      const { status, json } = await postJson(`${cfg.gateway.baseUrl}/chat/completions`, {
        model,
        messages,
        max_tokens: maxTokens,
        stream: false,
      }, apiKey, timeout);
      const j = json as Record<string, unknown>;
      if (status >= 200 && status < 300) {
        const choice = (j.choices as Record<string, unknown>[])?.[0];
        const content = (choice?.message as Record<string, unknown> | undefined)?.content;
        const usage = j.usage as Record<string, number> | undefined;
        return {
          ok: true,
          content: typeof content === 'string' ? content : JSON.stringify(content ?? ''),
          provider: (j['x-provider'] as string) ?? 'gateway',
          model: (j.model as string) ?? model,
          usage: {
            inputTokens: usage?.prompt_tokens,
            outputTokens: usage?.completion_tokens,
            totalTokens: usage?.total_tokens,
          },
          latencyMs: Date.now() - started,
        };
      }
      const retryable = status === 429 || status >= 500;
      lastErr = { code: `http_${status}`, message: summarizeError(json), retryable };
      if (!retryable) break;
    } catch (err) {
      const e = err as Error;
      lastErr = { code: e.name === 'AbortError' ? 'timeout' : 'network', message: e.message, retryable: e.name !== 'AbortError' };
    }
  }
  return { ok: false, latencyMs: Date.now() - started, error: lastErr ?? { code: 'unknown', message: 'request failed' } };
}

// Model ids advertised by the gateway (GET /v1/models). Used by list_models to
// show what exists - discovery never makes a model callable.
export async function discoverGatewayModels(cfg: OrchestratorConfig): Promise<string[]> {
  if (cfg.gateway.type === 'mock') return ['mock/chat'];
  try {
    assertLocalUrl(cfg.gateway.baseUrl, cfg.safety.localhostOnly);
  } catch { return []; }
  const apiKey = cfg.gateway.apiKeyEnv ? process.env[cfg.gateway.apiKeyEnv] : undefined;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${cfg.gateway.baseUrl}/models`, {
      headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
      signal: ctrl.signal,
    });
    if (!res.ok) return [];
    const j = (await res.json()) as { data?: { id?: string }[] };
    return (j.data ?? []).map((m) => m.id ?? '').filter(Boolean).slice(0, 200);
  } catch { return []; }
  finally { clearTimeout(timer); }
}

function summarizeError(json: unknown): string {
  const j = json as Record<string, unknown>;
  const err = (j.error ?? j) as Record<string, unknown>;
  return String(err.message ?? err.code ?? 'gateway error').slice(0, 300);
}

export async function probeGateway(cfg: OrchestratorConfig): Promise<{ reachable: boolean; latencyMs?: number; modelsOk?: boolean; error?: string }> {
  if (cfg.gateway.type === 'mock') return { reachable: true, latencyMs: 0, modelsOk: true };
  assertLocalUrl(cfg.gateway.baseUrl, cfg.safety.localhostOnly);
  const apiKey = cfg.gateway.apiKeyEnv ? process.env[cfg.gateway.apiKeyEnv] : undefined;
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${cfg.gateway.baseUrl}/models`, {
      headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
      signal: ctrl.signal,
    });
    return { reachable: true, latencyMs: Date.now() - started, modelsOk: res.ok };
  } catch (err) {
    return { reachable: false, latencyMs: Date.now() - started, error: (err as Error).message };
  } finally { clearTimeout(timer); }
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return (h >>> 0).toString(16);
}

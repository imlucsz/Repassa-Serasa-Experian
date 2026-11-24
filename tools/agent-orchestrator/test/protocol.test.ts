// End-to-end: spawn the compiled stdio server, do a real MCP handshake,
// list tools and call delegate_task against the mock gateway.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const toolRoot = join(here, '..');
const fixture = join(here, 'fixtures', 'orchestrator.config.json');
const entry = join(toolRoot, 'dist', 'index.js');

interface RpcResponse { jsonrpc: string; id: number; result?: Record<string, unknown>; error?: { code: number; message: string } }

async function rpcSession(cmd: string[], env: NodeJS.ProcessEnv) {
  const proc = spawn(cmd[0], cmd.slice(1), { env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
  let buf = '';
  const pending = new Map<number, (r: RpcResponse) => void>();
  proc.stdout.on('data', (d) => {
    buf += d.toString();
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line) as RpcResponse;
        if (msg.id !== undefined && pending.has(msg.id)) { pending.get(msg.id)!(msg); pending.delete(msg.id); }
      } catch { /* ignore non-json lines */ }
    }
  });
  let id = 0;
  const send = (method: string, params?: unknown) => new Promise<RpcResponse>((resolve, reject) => {
    const reqId = ++id;
    pending.set(reqId, resolve);
    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: reqId, method, params }) + '\n');
    setTimeout(() => { if (pending.has(reqId)) { pending.delete(reqId); reject(new Error(`timeout waiting for ${method}`)); } }, 15000);
  });
  return { proc, send };
}

test('MCP handshake + tools/list + delegate_task over stdio', { skip: !existsSync(entry) && 'run npm run build first' }, async () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'orch-proto-'));
  const { proc, send } = await rpcSession(['node', entry], {
    ORCHESTRATOR_CONFIG: fixture,
    LOCALAPPDATA: stateDir,
  });
  try {
    const init = await send('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0.0.0' } });
    assert.ok(init.result);
    await send('notifications/initialized', {});
    const list = await send('tools/list', {});
    const tools = (list.result!.tools as { name: string }[]).map((t) => t.name);
    for (const expected of ['list_models', 'delegate_task', 'delegate_parallel', 'review_proposal', 'get_task_result', 'orchestrator_health', 'delegate_worktree_task']) {
      assert.ok(tools.includes(expected), `missing tool ${expected}`);
    }
    const call = await send('tools/call', { name: 'delegate_task', arguments: { role: 'researcher', instructions: 'Say hi in one sentence.' } });
    const sc = call.result!.structuredContent as { status: string; provider?: string; model?: string };
    assert.equal(sc.status, 'done');
    assert.equal(sc.provider, 'mockfree');
    const health = await send('tools/call', { name: 'orchestrator_health', arguments: {} });
    const hs = health.result!.structuredContent as { gateway: { reachable: boolean }; safety: { mode: string } };
    assert.equal(hs.gateway.reachable, true);
    assert.equal(hs.safety.mode, 'read-only');
  } finally {
    proc.kill();
  }
});

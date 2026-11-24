import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.js';
import { TaskStore, BudgetLedger } from '../src/tasks.js';
import { runDelegation } from '../src/tools.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, 'fixtures', 'orchestrator.config.json');

function setup() {
  const loaded = loadConfig(fixture);
  const stateDir = mkdtempSync(join(tmpdir(), 'orch-state-'));
  loaded.stateDir = stateDir;
  const store = new TaskStore(stateDir);
  const ledger = new BudgetLedger(stateDir);
  return { loaded, store, ledger };
}

const getRole = (loaded: ReturnType<typeof loadConfig>, id: string) =>
  loaded.roles.find((r) => r.id === id)!;

test('delegation to mock provider completes and records usage', async () => {
  const { loaded, store, ledger } = setup();
  const task = await runDelegation(loaded, store, ledger, getRole(loaded, 'researcher'), 'Summarize the repo structure.', undefined, {});
  assert.equal(task.status, 'done');
  assert.equal(task.provider, 'mockfree');
  assert.match(task.model ?? '', /mock\/chat/);
  assert.ok(task.output?.includes('mock response'));
  const usage = ledger.usageToday();
  assert.equal(usage.calls, 1);
  assert.ok(usage.tokens > 0);
  const reread = store.get(task.taskId);
  assert.equal(reread?.status, 'done');
});

test('egress scanner blocks secret-containing instructions', async () => {
  const { loaded, store, ledger } = setup();
  const task = await runDelegation(loaded, store, ledger, getRole(loaded, 'researcher'), `Use this key: sk-${'proj'}-${'k'.repeat(40)}`, undefined, {});
  assert.equal(task.status, 'blocked');
  assert.equal(task.error?.code, 'egress_secret');
  assert.ok(task.egressBlocked!.length > 0);
});

test('denied context file is blocked before any model call', async () => {
  const { loaded, store, ledger } = setup();
  const task = await runDelegation(loaded, store, ledger, getRole(loaded, 'researcher'), 'read env', [{ type: 'file', path: '.env' }], {});
  assert.equal(task.status, 'blocked');
  assert.equal(task.error?.code, 'context_policy');
});

test('file context within repo is passed through to the model', async () => {
  const { loaded, store, ledger } = setup();
  const task = await runDelegation(loaded, store, ledger, getRole(loaded, 'researcher'), 'Describe this file.', [{ type: 'file', path: 'tools/agent-orchestrator/package.json' }], {});
  assert.equal(task.status, 'done');
  assert.ok(task.usage?.inputTokens! > 0);
});

test('paid provider blocked under free-only, reachable via explicit auto profile', async () => {
  const { loaded, store, ledger } = setup();
  const blocked = await runDelegation(loaded, store, ledger, getRole(loaded, 'researcher'), 'hi', undefined, { model: 'paid/big' });
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.error?.code, 'routing');
  const ok = await runDelegation(loaded, store, ledger, getRole(loaded, 'researcher'), 'hi', undefined, { model: 'paid/big', routingProfile: 'auto' });
  assert.equal(ok.status, 'done');
});

test('delegation depth limit prevents recursion', async () => {
  const { loaded, store, ledger } = setup();
  const parent = await runDelegation(loaded, store, ledger, getRole(loaded, 'researcher'), 'parent', undefined, {});
  assert.equal(parent.status, 'done');
  const child = await runDelegation(loaded, store, ledger, getRole(loaded, 'researcher'), 'child', undefined, { parentTaskId: parent.taskId });
  assert.equal(child.status, 'done'); // depth 1 allowed (delegate -> review chain)
  const grandchild = await runDelegation(loaded, store, ledger, getRole(loaded, 'researcher'), 'grandchild', undefined, { parentTaskId: child.taskId });
  assert.equal(grandchild.status, 'blocked');
  assert.equal(grandchild.error?.code, 'depth_limit');
});

test('daily token budget blocks once exhausted', async () => {
  const { loaded, store, ledger } = setup();
  const first = await runDelegation(loaded, store, ledger, getRole(loaded, 'researcher'), 'x', undefined, {});
  assert.equal(first.status, 'done');
  loaded.config.budget.dailyTokens = ledger.usageToday().tokens; // now exhausted
  const second = await runDelegation(loaded, store, ledger, getRole(loaded, 'researcher'), 'x', undefined, {});
  assert.equal(second.status, 'blocked');
  assert.equal(second.error?.code, 'budget_tokens');
});

test('declared pricing produces honest cost accounting (not silent zero)', async () => {
  const { loaded, store, ledger } = setup();
  const task = await runDelegation(loaded, store, ledger, getRole(loaded, 'researcher'), 'price me', undefined, { model: 'paid/big', routingProfile: 'auto' });
  assert.equal(task.status, 'done');
  assert.ok(task.usage!.costUsd! > 0, 'paid model call must record nonzero estimated cost');
  assert.equal(task.costBasis, 'declared-pricing');
  const prov = ledger.providerUsageToday('mockpaid');
  assert.ok(prov.costUsd > 0);
});

test('free provider records zero cost with declared-free basis', async () => {
  const { loaded, store, ledger } = setup();
  const task = await runDelegation(loaded, store, ledger, getRole(loaded, 'researcher'), 'free me', undefined, {});
  assert.equal(task.status, 'done');
  assert.equal(task.usage!.costUsd, 0);
  assert.equal(task.costBasis, 'declared-free');
});

test('per-provider daily cost cap blocks further paid calls', async () => {
  const { loaded, store, ledger } = setup();
  loaded.config.providers.find((p) => p.id === 'mockpaid')!.maxDailyCostUsd = 0;
  const task = await runDelegation(loaded, store, ledger, getRole(loaded, 'researcher'), 'hi', undefined, { model: 'paid/big', routingProfile: 'auto' });
  assert.equal(task.status, 'blocked');
  assert.equal(task.error?.code, 'provider_budget');
});

test('unknown-billing provider cannot be invoked explicitly', async () => {
  const { loaded, store, ledger } = setup();
  const task = await runDelegation(loaded, store, ledger, getRole(loaded, 'researcher'), 'hi', undefined, { model: 'mystery/model', routingProfile: 'auto' });
  assert.equal(task.status, 'blocked');
  assert.equal(task.error?.code, 'routing');
});

test('context byte cap blocks oversized file input', async () => {
  const { loaded, store, ledger } = setup();
  loaded.config.safety.egress.maxFileBytes = 100;
  const big = 'a'.repeat(500);
  const task = await runDelegation(loaded, store, ledger, getRole(loaded, 'researcher'), 'go', [{ type: 'text', text: big }], {});
  assert.equal(task.status, 'blocked');
});

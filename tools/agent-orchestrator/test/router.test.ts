import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadConfig } from '../src/config.js';
import { selectModel, listPolicyModels, autoCandidates } from '../src/router.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, 'fixtures', 'orchestrator.config.json');

const loaded = loadConfig(fixture);
const { config, roles } = loaded;
const researcher = roles.find((r) => r.id === 'researcher')!;

test('loadConfig parses fixture and resolves repo root', () => {
  assert.equal(config.safety.mode, 'read-only');
  assert.equal(roles.length, 2);
  assert.ok(loaded.repoRoot.length > 0);
});

test('free-only profile selects only free provider', () => {
  const sel = selectModel(config, researcher, {});
  assert.ok(!('error' in sel));
  if (!('error' in sel)) {
    assert.equal(sel.provider.id, 'mockfree');
    assert.equal(sel.model, 'mock/secondary'); // roleModels[researcher][0] wins
  }
});

test('explicit paid model is rejected under free-only profile', () => {
  const sel = selectModel(config, researcher, { model: 'paid/big' });
  assert.ok('error' in sel);
});

test('auto profile can reach paid model only via explicit selection', () => {
  const sel = selectModel(config, researcher, { model: 'paid/big', routingProfile: 'auto' });
  assert.ok(!('error' in sel));
});

test('automatic routing NEVER picks a paid provider, even under a paid-allowing profile', () => {
  const sel = selectModel(config, researcher, { routingProfile: 'auto' });
  assert.ok(!('error' in sel));
  if (!('error' in sel)) assert.equal(sel.provider.billing, 'free');
});

test('unknown-billing provider is never callable, even explicitly', () => {
  const sel = selectModel(config, researcher, { model: 'mystery/model', routingProfile: 'auto' });
  assert.ok('error' in sel);
  if ('error' in sel) assert.match(sel.error, /unknown/);
});

test('unknown provider is rejected explicitly', () => {
  const sel = selectModel(config, researcher, { provider: 'notreal' });
  assert.ok('error' in sel);
});

test('autoCandidates orders roleModels first, then remaining free models; never paid/unknown/undeclared', () => {
  const cands = autoCandidates(config, researcher);
  const ids = cands.map((c) => c.model);
  // roleModels order honored: secondary before chat
  assert.equal(ids[0], 'mock/secondary');
  assert.equal(ids[1], 'mock/chat');
  // remaining declared free models appended for fallback
  assert.ok(ids.includes('mock/extra'));
  // paid, unknown and undeclared ids never enter the candidate chain
  assert.ok(!ids.includes('paid/big'));
  assert.ok(!ids.includes('mystery/model'));
  assert.ok(!ids.includes('notdeclared/x'));
  assert.ok(cands.every((c) => c.provider.billing === 'free'));
});

test('autoCandidates falls back to declaration order for roles without roleModels', () => {
  const other = roles.find((r) => r.id !== 'researcher')!;
  const cands = autoCandidates(config, other);
  assert.ok(cands.length >= 1);
  assert.equal(cands[0].provider.billing, 'free');
});

test('listPolicyModels exposes policy surface with callability', () => {
  const list = listPolicyModels(config);
  assert.equal(list.length, 4);
  assert.equal(list[0].billing, 'free');
  assert.equal(list[0].callable, true);
  const paid = list.find((p) => p.billing === 'paid')!;
  assert.equal(paid.callable, true); // 'auto' profile exists in fixture
  assert.match(paid.reason ?? '', /explicit/);
  const unk = list.find((p) => p.billing === 'unknown')!;
  assert.equal(unk.callable, false);
});

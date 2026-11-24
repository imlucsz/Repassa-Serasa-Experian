import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadConfig } from '../src/config.js';
import { selectModel, listPolicyModels } from '../src/router.js';

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
    assert.equal(sel.model, 'mock/chat');
  }
});

test('explicit paid model is rejected under free-only profile', () => {
  const sel = selectModel(config, researcher, { model: 'paid/big' });
  assert.ok('error' in sel);
});

test('auto profile can reach paid model', () => {
  const sel = selectModel(config, researcher, { model: 'paid/big', routingProfile: 'auto' });
  assert.ok(!('error' in sel));
});

test('unknown provider is rejected explicitly', () => {
  const sel = selectModel(config, researcher, { provider: 'notreal' });
  assert.ok('error' in sel);
});

test('listPolicyModels exposes policy surface', () => {
  const list = listPolicyModels(config);
  assert.equal(list.length, 2);
  assert.equal(list[0].billing, 'free');
});

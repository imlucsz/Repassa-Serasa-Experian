// Deterministic path resolution: a config copied OUTSIDE the tool directory
// (e.g. %LOCALAPPDATA%) must still find roles and the real repo root,
// including under paths with spaces.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, TOOL_ROOT } from '../src/config.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, 'fixtures', 'orchestrator.config.json');

const minimalCfg = {
  version: 1,
  gateway: { type: 'mock' },
  stateDir: join(tmpdir(), 'orch-cfgtest-state'),
};

test('config outside tool dir resolves rolesFile and repoRoot against TOOL_ROOT', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orch cfg '), { }); // spaces in path
  const cfgPath = join(dir, 'orchestrator.config.json');
  writeFileSync(cfgPath, JSON.stringify(minimalCfg));
  const loaded = loadConfig(cfgPath);
  assert.ok(loaded.roles.length > 0, 'roles must load from TOOL_ROOT/roles.json');
  assert.ok(existsSync(join(loaded.repoRoot, 'package.json')), 'repoRoot must be the real repo root');
  assert.equal(loaded.repoRoot, join(TOOL_ROOT, '..', '..'));
});

test('configDir-relative repoRoot without .git/package.json is not mistaken for the repo', () => {
  // Simulates %LOCALAPPDATA%\RepassaOrchestrator: ../.. exists but is NOT a repo.
  const base = mkdtempSync(join(tmpdir(), 'orchfake-'));
  const nested = join(base, 'a', 'b');
  mkdirSync(nested, { recursive: true });
  const cfgPath = join(nested, 'orchestrator.config.json');
  writeFileSync(cfgPath, JSON.stringify({ ...minimalCfg, repoRoot: '../..' }));
  const loaded = loadConfig(cfgPath);
  assert.notEqual(loaded.repoRoot, join(nested, '..', '..'));
  assert.ok(existsSync(join(loaded.repoRoot, 'package.json')));
});

test('absolute repoRoot/rolesFile are honored verbatim', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orchabs-'));
  const cfgPath = join(dir, 'orchestrator.config.json');
  const absRepo = join(TOOL_ROOT, '..', '..');
  writeFileSync(cfgPath, JSON.stringify({ ...minimalCfg, repoRoot: absRepo, rolesFile: join(TOOL_ROOT, 'roles.json') }));
  const loaded = loadConfig(cfgPath);
  assert.equal(loaded.repoRoot, absRepo);
  assert.ok(loaded.roles.length > 0);
});

test('fixture config still resolves correctly', () => {
  const loaded = loadConfig(fixture);
  assert.equal(loaded.roles.length, 2);
  assert.ok(existsSync(join(loaded.repoRoot, 'package.json')));
});

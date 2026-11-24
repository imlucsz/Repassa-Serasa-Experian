import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanForSecrets, assertLocalUrl, globToRegExp, checkFileContextAccess } from '../src/safety.js';

test('scanForSecrets catches common credential shapes', () => {
  // Strings are assembled so no literal credential shape sits in this file.
  assert.ok(scanForSecrets('key = "sk-' + 'proj-' + 'a'.repeat(30) + '"').length > 0);
  assert.ok(scanForSecrets('ghp' + '_' + 'x'.repeat(36)).length > 0);
  assert.ok(scanForSecrets('AK' + 'IA' + 'Z'.repeat(16)).length > 0);
  assert.ok(scanForSecrets('{"access_token": "ya29.' + 'b'.repeat(40) + '"}').length > 0);
  assert.ok(scanForSecrets('-----BEGIN ' + 'PRIVATE ' + 'KEY-----').length > 0);
  assert.equal(scanForSecrets('const x = 42; // plain code').length, 0);
  assert.equal(scanForSecrets('function login(user) { return authenticate(user); }').length, 0);
});

test('assertLocalUrl enforces localhost', () => {
  assert.doesNotThrow(() => assertLocalUrl('http://127.0.0.1:20128/v1', true));
  assert.doesNotThrow(() => assertLocalUrl('http://localhost:8080', true));
  assert.throws(() => assertLocalUrl('https://api.example.com', true), /localhost/);
  assert.doesNotThrow(() => assertLocalUrl('https://api.example.com', false));
});

test('globToRegExp matches deny patterns', () => {
  assert.ok(globToRegExp('**/*.key').test('a/b/c.key'));
  assert.ok(globToRegExp('**/secrets/**').test('x/secrets/y.txt'));
  assert.ok(!globToRegExp('src/*').test('src/deep/file.ts'));
});

test('checkFileContextAccess blocks traversal and secrets, allows source files', () => {
  const root = mkdtempSync(join(tmpdir(), 'orch-'));
  writeFileSync(join(root, 'app.ts'), 'export const x = 1;');
  writeFileSync(join(root, '.env'), 'KEY=secret');
  const allowed = checkFileContextAccess('app.ts', root, []);
  assert.equal(allowed.ok, true);
  assert.equal(checkFileContextAccess('../outside.ts', root, []).ok, false);
  assert.equal(checkFileContextAccess('.env', root, []).ok, false);
  assert.equal(checkFileContextAccess('missing.ts', root, []).ok, false);
  assert.equal(checkFileContextAccess('app.ts', root, ['app.*']).ok, false);
});

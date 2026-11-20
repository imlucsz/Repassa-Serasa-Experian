import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const guard=fileURLToPath(new URL('./agent-guard.mjs',import.meta.url));
function create(t) {
  const cwd=mkdtempSync(join(tmpdir(),'repassa-guard-'));
  t.after(()=>rmSync(cwd,{recursive:true,force:true}));
  function git(...args) {const r=spawnSync('git',args,{cwd,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
  function file(path,data) {mkdirSync(dirname(join(cwd,path)),{recursive:true});writeFileSync(join(cwd,path),data);}
  function run(...args) {return spawnSync(process.execPath,[guard,...args],{cwd,encoding:'utf8'});}
  function push(input){return spawnSync(process.execPath,[guard,'pre-push','origin'],{cwd,input,encoding:'utf8'});}
  git('init','-b','main');git('config','user.email','test@example.invalid');git('config','user.name','Guard Test');git('config','core.autocrlf','false');git('config','core.hooksPath',join(cwd,'.disabled-hooks'));
  file('README.md','base\n');file('video/existing.mp4','legacy');git('add','.');git('commit','-m','base');let base=git('rev-parse','HEAD');
  git('update-ref','refs/remotes/origin/main',base);git('switch','-c','feat/test');
  return {cwd,git,file,run,push,base};
}
function ok(r){assert.equal(r.status,0,r.stderr);}
function blocked(r,match){assert.equal(r.status,1,r.stdout);assert.match(r.stderr,match);}
test('normal source and safe example; legacy video unchanged',t=>{const r=create(t);r.file('src/page.tsx','export const answer = 42;\n');r.file('.env.example','JWT_SECRET=replace_me\n');r.git('add','src','.env.example');ok(r.run('staged'));});
test('staged .env and generated media paths blocked',t=>{const r=create(t);r.file('.env.local','X=1\n');r.file('out/preview.mp4','x');r.git('add','.');blocked(r.run('staged'),/environment file/);assert.match(r.run('staged').stderr,/media file/);});
test('staged secret still blocked after worktree edited; value redacted',t=>{const r=create(t);const token='gh'+'p_'+'A'.repeat(36);r.file('src/config.txt',token+'\n');r.git('add','src/config.txt');r.file('src/config.txt','safe\n');const x=r.run('staged');blocked(x,/GitHub token/);assert.ok(!x.stderr.includes(token));});
test('protected video modification and deletion blocked',t=>{const r=create(t);r.file('video/existing.mp4','change');r.git('add','video/existing.mp4');blocked(r.run('staged'),/protected video/);r.git('rm','-f','video/existing.mp4');blocked(r.run('staged'),/protected video/);});
test('10 MiB limit',t=>{const r=create(t);r.file('big.bin',Buffer.alloc(10*1024*1024+1));r.git('add','big.bin');blocked(r.run('staged'),/exceeds 10 MiB/);});
test('range catches secret added then removed in separate commits',t=>{const r=create(t);r.file('note.txt','gh'+'p_'+'B'.repeat(36)+'\n');r.git('add','note.txt');r.git('commit','-m','bad');r.git('rm','note.txt');r.git('commit','-m','remove');blocked(r.run('range',r.base,'HEAD'),/GitHub token/);});
test('new feature push works; protected push and remote deletion denied',t=>{const r=create(t);r.file('src/a.ts','export const a=1;\n');r.git('add','src');r.git('commit','-m','safe');const head=r.git('rev-parse','HEAD'), zero='0'.repeat(40);ok(r.push(`refs/heads/feat/test ${head} refs/heads/feat/test ${zero}\n`));blocked(r.push(`refs/heads/feat/test ${head} refs/heads/main ${r.base}\n`),/direct protected branch/);blocked(r.push(`(delete) ${zero} refs/heads/feat/test ${head}\n`),/deletion denied/);});
test('non-fast-forward push denied',t=>{const r=create(t);r.file('src/a.ts','export const a=1;\n');r.git('add','src');r.git('commit','-m','safe');const head=r.git('rev-parse','HEAD');blocked(r.push(`refs/heads/feat/test ${r.base} refs/heads/feat/test ${head}\n`),/non-fast-forward/);});

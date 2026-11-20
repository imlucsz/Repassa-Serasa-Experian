import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// No npm dependencies. Inspect Git objects, never print matched credential values.
const cwd = process.cwd();
const MAX = 10 * 1024 * 1024;
const ZERO = /^0+$/;
function git(args, opts = {}) {
  const r = spawnSync('git', args, {cwd, maxBuffer: 32 * 1024 * 1024, ...opts});
  if (r.error || r.status !== 0) throw new Error(`Git command failed (${args[0]}); check repository, fetch or inspect the diff.`);
  return r.stdout;
}
const txt = (args) => git(args, {encoding:'utf8'}).trim();
const violations = new Set();
const fail = (path, reason) => violations.add(`${JSON.stringify(path)}: ${reason}`);
const patterns = [
  ['private key', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['Google API key', /\bAIza[A-Za-z0-9_-]{35}\b/],
  ['API token', /\bsk-(?:proj-|live-)?[A-Za-z0-9_-]{24,}\b/],
  ['Stripe key', /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{15,}\b/],
  ['JWT-looking token', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{16,}\b/],
];
function pathCheck(path, status) {
  const parts = path.toLowerCase().split('/');
  const name = parts.at(-1);
  if (parts[0] === 'video') fail(path, 'protected video subtree; owner-reviewed exception required');
  if (status === 'D') return;
  if (parts.some(p=>['node_modules','dist','coverage','.cache','out','references'].includes(p))) fail(path,'generated or reference artefact');
  if ((name === '.env' || name.startsWith('.env.')) && !name.endsWith('.example')) fail(path,'environment file; use safe .env.example');
  if (/\.(?:pem|p12|pfx|key|jks)$/.test(name) || ['id_rsa','id_ed25519','credentials.json'].includes(name)) fail(path,'possible credential file');
  if (/\.(?:mp4|mov|mkv|webm|avi|wav|mp3)$/.test(name)) fail(path,'media file; keep references/exports outside app Git history');
}
function inspect(records, tree) {
  const fields = records.toString('utf8').split('\0').filter(x=>x.length);
  if (fields.length % 2 !== 0) throw new Error('Unexpected git name-status format');
  for (let i=0;i<fields.length;i+=2) {
    const status = fields[i], path = fields[i+1];
    pathCheck(path, status);
    if (status === 'D' || path.startsWith('video/')) continue;
    const spec = tree === 'index' ? `:${path}` : `${tree}:${path}`;
    const type = txt(['cat-file','-t',spec]);
    if (type !== 'blob') { fail(path,'non-blob (submodule) change requires separate review'); continue; }
    const size = Number(txt(['cat-file','-s',spec]));
    if (size > MAX) { fail(path,'file exceeds 10 MiB'); continue; }
    const data = git(['cat-file','blob',spec]);
    if (data.includes(0)) continue; // binary content cannot be reliably scanned here
    const contents = data.toString('utf8');
    for (const [label,re] of patterns) if (re.test(contents)) fail(path,`possible ${label}; inspect locally, rotate if exposed`);
    // Catch literal credential assignments without flagging env references/templates.
    for (const match of contents.matchAll(/(?:^|[\s"'])\b(?:DATABASE_URL|DIRECT_URL|JWT_SECRET|JWT_ACCESS_SECRET|SUPABASE_SERVICE_ROLE_KEY|PICKUP_CODE_SECRET|GEMINI_API_KEY|API_KEY|CLIENT_SECRET)\s*["']?\s*[:=]\s*["']?([^\s"'`,;#}]+)/gim)) {
      const v=match[1];
      if (/^(?:process\.env|import\.meta\.env|env\.|env\(|\$|<|your[_-]|replace[_-]|example|placeholder|changeme|dummy|test[_-]|ci[_-]|(?:repassa_)?local[_-]|undefined|null|[A-Z_]+$)/i.test(v)) continue;
      if (v.length>=16 && !/^postgres(?:ql)?:\/\/(?:repassa_ci|repassa_local):(?:repassa_ci|repassa_local)@(?:localhost|127\.0\.0\.1)(?::\d+)?\//i.test(v)) fail(path,'possible hardcoded credential assignment');
    }
  }
}
function scanCommit(sha) {
  const [commit,...parents] = txt(['rev-list','--parents','-n','1',sha]).split(/\s+/);
  const common=['--name-status','-z','--no-renames','--diff-filter=ACDMT'];
  const records=parents.length ? git(['diff',...common,parents[0],commit]) : git(['diff-tree','--root','--no-commit-id','-r',...common,commit]);
  inspect(records,commit);
}
function range(base, head) {
  const commits=txt(['rev-list',`${base}..${head}`]);
  for (const sha of commits.split(/\s+/).filter(Boolean)) scanCommit(sha);
  inspect(git(['diff','--name-status','-z','--no-renames','--diff-filter=ACDMT',base,head]),head);
}
function prepush(remote) {
  if (!remote || !/^[A-Za-z0-9_.-]+$/.test(remote)) throw new Error('Invalid remote name; use a named Git remote.');
  const input=readFileSync(0,'utf8').trim();
  for (const line of input.split(/\r?\n/).filter(Boolean)) {
    const [localRef,localSha,remoteRef,remoteSha]=line.split(/\s+/);
    if (!localRef || !localSha || !remoteRef || !remoteSha) throw new Error('Invalid pre-push input');
    if (remoteRef==='refs/heads/main' || remoteRef==='refs/heads/master') { fail(remoteRef,'direct protected branch push denied; use PR'); continue; }
    if (ZERO.test(localSha)) { fail(remoteRef,'remote deletion denied'); continue; }
    if (!remoteRef.startsWith('refs/heads/')) { fail(remoteRef,'agent push limited to feature/chore branches; tags/releases are owner-controlled'); continue; }
    if (!ZERO.test(remoteSha)) {
      const r=spawnSync('git',['merge-base','--is-ancestor',remoteSha,localSha],{cwd,stdio:'ignore'});
      if (r.status!==0) {fail(remoteRef,'non-fast-forward or stale local refs; fetch, integrate, retry (never force-push)'); continue;}
      range(remoteSha,localSha);
    } else {
      // For a new branch, ignore history already known on this remote (fetch first).
      const commits=txt(['rev-list',localSha,'--not',`--remotes=${remote}`]);
      for (const sha of commits.split(/\s+/).filter(Boolean)) scanCommit(sha);
    }
  }
}
try {
  const [mode,a,b]=process.argv.slice(2);
  if (mode==='staged') {
    try { git(['diff','--cached','--check']); } catch { fail('index','whitespace error or conflict marker; inspect git diff --cached --check locally'); }
    inspect(git(['diff','--cached','--name-status','-z','--no-renames','--diff-filter=ACDMT']),'index');
  } else if (mode==='range' && a && b) range(a,b);
  else if (mode==='pre-push') prepush(a);
  else throw new Error('Usage: agent-guard.mjs staged | range <base> <head> | pre-push <remote>');
  if (violations.size) {console.error('RePassa guard blocked changes:\n'+[...violations].join('\n'));process.exitCode=1;}
  else console.log('RePassa guard: no configured violations detected (heuristic, not a security guarantee).');
} catch(error) { console.error('RePassa guard failed: '+error.message); process.exitCode=1; }

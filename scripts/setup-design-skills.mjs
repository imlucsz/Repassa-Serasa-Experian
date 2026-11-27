import { execFileSync } from 'node:child_process';
import { cpSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = join(root, '.agents', 'skills');
const tempRoot = tmpdir();
const staging = mkdtempSync(join(tempRoot, 'repassa-design-'));

function run(executable, args, cwd = staging) {
  execFileSync(executable, args, { cwd, stdio: 'inherit', windowsHide: true });
}

function checkout(repo, revision) {
  const folder = join(staging, repo.split('/')[0]);
  mkdirSync(folder);
  run('git', ['init', '--quiet'], folder);
  run('git', ['fetch', '--quiet', '--depth=1', 'https://github.com/' + repo + '.git', revision], folder);
  run('git', ['checkout', '--quiet', '--detach', 'FETCH_HEAD'], folder);
  return folder;
}

function install(name, source, license) {
  if (!existsSync(join(source, 'SKILL.md'))) throw new Error('Missing manifest for ' + name);
  const target = join(destination, name);
  if (existsSync(target)) {
    if (!existsSync(join(target, 'SKILL.md'))) throw new Error('Incomplete existing skill at ' + target);
    console.log('Already present: ' + name);
    return;
  }
  cpSync(source, target, {
    recursive: true,
    force: false,
    errorOnExist: true,
    filter: (src) => !src.split(/[\\/]/).includes('.git'),
  });
  if (license && !existsSync(join(target, 'LICENSE'))) copyFileSync(license, join(target, 'LICENSE'));
  console.log('Installed: ' + name);
}

function cli(packageName, entry, args) {
  run(process.execPath, [join(root, 'node_modules', packageName, entry), ...args]);
}

try {
  mkdirSync(destination, { recursive: true });
  const taste = checkout('Leonxlnx/taste-skill', 'f6b76575f949707b4e3c37cd86cb44b0b98643e8');
  install('design-taste-frontend', join(taste, 'skills', 'taste-skill'), join(taste, 'LICENSE'));

  const emil = checkout('emilkowalski/skills', '64eb3deb9a5fbfa041faf783e0bc3fd635872e9c');
  const emilSkills = join(emil, 'skills');
  for (const entry of readdirSync(emilSkills, { withFileTypes: true })) {
    if (entry.isDirectory()) install(entry.name, join(emilSkills, entry.name), join(emil, 'LICENSE'));
  }

  const generated = join(staging, '.agents', 'skills');
  cli('ui-ux-pro-max-cli', 'dist/index.js', ['init', '--ai', 'codex', '--offline']);
  const ui = checkout('nextlevelbuilder/ui-ux-pro-max-skill', '2de1134dc4d1cfe112934611ae5803ae17a1bd7e');
  install('ui-ux-pro-max', join(generated, 'ui-ux-pro-max'), join(ui, 'LICENSE'));

  // The impeccable engine resolves the project root itself; run it at the repo
  // root so it writes .agents/skills/impeccable directly. It skips regeneration
  // when an existing install is already current and manages its own upgrades.
  run(process.execPath, [join(root, 'node_modules', 'impeccable', 'cli', 'bin', 'cli.js'),
    'install', '--providers=codex', '--project', '--no-hooks', '-y'], root);
  if (!existsSync(join(destination, 'impeccable', 'SKILL.md'))
    && !existsSync(join(homedir(), '.agents', 'skills', 'impeccable', 'SKILL.md'))) {
    throw new Error('Impeccable install produced no discovered skill');
  }

  const cantos = checkout('feBittar/cantos-apple', '4c15b5309c22ade4b0e8cdbdd4c4cc33d5ce19cd');
  install('cantos-apple', cantos, join(cantos, 'LICENSE'));
} finally {
  // Only remove the staging directory created by mkdtempSync for this invocation.
  rmSync(staging, { recursive: true, force: true });
}

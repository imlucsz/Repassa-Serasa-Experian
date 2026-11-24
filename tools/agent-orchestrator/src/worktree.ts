// Phase 6 - controlled coding workers in isolated git worktrees.
// Gate: workers.enabled AND safety.mode === 'supervised' (read-only default).
// Workers never see secrets (file allowlist + egress scan) and never commit or push;
// the result is an applied patch + diff for Astra/Devin review.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdirSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { OrchestratorConfig } from './config.js';
import { checkFileContextAccess } from './safety.js';

const run = promisify(execFile);

export interface WorkerPrepResult {
  ok: boolean;
  worktreePath?: string;
  branch?: string;
  files?: string[];
  error?: string;
}

export function workersEnabled(cfg: OrchestratorConfig): { enabled: boolean; reason?: string } {
  if (!cfg.workers.enabled) return { enabled: false, reason: 'workers.enabled is false in orchestrator.config.json' };
  if (cfg.safety.mode !== 'supervised') return { enabled: false, reason: `safety.mode is "${cfg.safety.mode}"; set to "supervised" to enable workers` };
  return { enabled: true };
}

export async function prepareWorktree(
  cfg: OrchestratorConfig,
  repoRoot: string,
  taskId: string,
  base: string,
): Promise<WorkerPrepResult> {
  const state = cfg.workers;
  const wtRoot = cfg.workers.worktreeRoot;
  mkdirSync(wtRoot, { recursive: true });
  const wtPath = join(wtRoot, taskId);
  const branch = `${state.branchPrefix}${taskId}`;
  try {
    await run('git', ['worktree', 'add', '--detach', wtPath, base], { cwd: repoRoot });
    await run('git', ['switch', '-c', branch], { cwd: wtPath });
    return { ok: true, worktreePath: wtPath, branch };
  } catch (err) {
    return { ok: false, error: (err as Error).message.slice(0, 500) };
  }
}

// Read allowlisted files into a bounded context block for the worker prompt.
export function collectWorkerFiles(
  cfg: OrchestratorConfig,
  repoRoot: string,
  files: string[],
): { ok: boolean; context?: string; error?: string } {
  const parts: string[] = [];
  let total = 0;
  for (const rel of files) {
    const access = checkFileContextAccess(rel, repoRoot, cfg.workers.deniedPathGlobs, cfg.workers.allowedPathPrefixes);
    if (!access.ok) return { ok: false, error: `${rel}: ${access.reason}` };
    const size = statSync(access.absPath!).size;
    if (size > cfg.safety.egress.maxFileBytes) return { ok: false, error: `${rel}: exceeds maxFileBytes` };
    if (total + size > cfg.safety.egress.maxContextBytes) return { ok: false, error: `context exceeds maxContextBytes at ${rel}` };
    parts.push(`--- FILE: ${rel} ---\n${readFileSync(access.absPath!, 'utf8')}`);
    total += size;
  }
  return { ok: true, context: parts.join('\n\n') };
}

// Apply a model-produced unified diff inside the worker worktree; return review artifacts.
export async function applyPatchToWorktree(
  worktreePath: string,
  patch: string,
  taskDir: string,
): Promise<{ ok: boolean; patchFile?: string; diffStat?: string; diff?: string; error?: string }> {
  mkdirSync(taskDir, { recursive: true });
  const patchFile = join(taskDir, 'proposal.patch');
  writeFileSync(patchFile, patch);
  try {
    await run('git', ['apply', '--check', patchFile], { cwd: worktreePath });
  } catch (err) {
    return { ok: false, patchFile, error: `patch does not apply: ${(err as Error).message.slice(0, 500)}` };
  }
  try {
    await run('git', ['apply', patchFile], { cwd: worktreePath });
    const stat = await run('git', ['diff', '--stat'], { cwd: worktreePath });
    const diff = await run('git', ['diff'], { cwd: worktreePath });
    return {
      ok: true,
      patchFile,
      diffStat: stat.stdout.toString().slice(0, 4000),
      diff: diff.stdout.toString().slice(0, 32000),
    };
  } catch (err) {
    return { ok: false, patchFile, error: `apply failed: ${(err as Error).message.slice(0, 500)}` };
  }
}

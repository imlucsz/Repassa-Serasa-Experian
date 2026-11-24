// MCP tool registrations. Every tool returns a small structured payload plus a
// one-paragraph text summary - never raw logs or whole files.
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LoadedConfig, Role } from './config.js';
import { TaskStore, BudgetLedger, type TaskRecord } from './tasks.js';
import { chatCompletion, probeGateway, type ChatMessage } from './gateway.js';
import { selectModel, listPolicyModels } from './router.js';
import { scanForSecrets, checkFileContextAccess } from './safety.js';
import { workersEnabled, prepareWorktree, collectWorkerFiles, applyPatchToWorktree } from './worktree.js';

interface CtxItem { type: 'text' | 'file'; text?: string; path?: string }
const ctxItemSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string().max(60000) }),
  z.object({ type: z.literal('file'), path: z.string().max(500) }),
]);

const delegateArgs = {
  role: z.string().describe('role id from list_roles/list_models output'),
  instructions: z.string().max(12000).describe('bounded task instructions'),
  context: z.array(ctxItemSchema).max(40).optional().describe('text snippets or repo-relative file paths the model may read'),
  model: z.string().optional().describe('explicit "provider/model" or model id; omit for policy routing'),
  provider: z.string().optional(),
  routingProfile: z.string().optional().describe('routing profile name from config'),
  maxOutputTokens: z.number().int().positive().max(16000).optional(),
  timeoutSec: z.number().positive().max(300).optional(),
  parentTaskId: z.string().optional(),
};

function summary(task: TaskRecord): { content: { type: 'text'; text: string }[]; structuredContent: Record<string, unknown> } {
  const line = task.status === 'done'
    ? `Task ${task.taskId} done via ${task.provider}/${task.model} in ${task.latencyMs}ms.`
    : `Task ${task.taskId} ${task.status}${task.error ? `: ${task.error.code} - ${task.error.message}` : ''}`;
  return {
    content: [{ type: 'text', text: line }],
    structuredContent: {
      taskId: task.taskId, status: task.status, role: task.role,
      provider: task.provider, model: task.model, latencyMs: task.latencyMs,
      usage: task.usage, error: task.error, egressBlocked: task.egressBlocked,
      output: task.status === 'done' ? task.output : undefined,
    },
  };
}

function buildContext(
  loaded: LoadedConfig,
  items: CtxItem[] | undefined,
): { ok: boolean; text: string; error?: string; bytes: number } {
  const cfg = loaded.config;
  const parts: string[] = [];
  let bytes = 0;
  for (const item of items ?? []) {
    if (item.type === 'text') {
      if (item.text!.length > cfg.safety.egress.maxFileBytes) {
        return { ok: false, text: '', error: `context text item exceeds maxFileBytes (${cfg.safety.egress.maxFileBytes})`, bytes };
      }
      parts.push(item.text!); bytes += item.text!.length;
    } else {
      const access = checkFileContextAccess(item.path!, loaded.repoRoot, cfg.workers.deniedPathGlobs);
      if (!access.ok) return { ok: false, text: '', error: `context file "${item.path}": ${access.reason}`, bytes };
      const content = readFileSync(access.absPath!, 'utf8');
      if (content.length > cfg.safety.egress.maxFileBytes) {
        return { ok: false, text: '', error: `context file "${item.path}" exceeds maxFileBytes (${cfg.safety.egress.maxFileBytes})`, bytes };
      }
      parts.push(`--- FILE: ${item.path} ---\n${content}`);
      bytes += content.length;
    }
    if (bytes > cfg.safety.egress.maxContextBytes) {
      return { ok: false, text: '', error: `combined context exceeds maxContextBytes (${cfg.safety.egress.maxContextBytes})`, bytes };
    }
  }
  return { ok: true, text: parts.join('\n\n'), bytes };
}

export async function runDelegation(
  loaded: LoadedConfig,
  store: TaskStore,
  ledger: BudgetLedger,
  role: Role,
  instructions: string,
  context: CtxItem[] | undefined,
  opts: { model?: string; provider?: string; routingProfile?: string; maxOutputTokens?: number; timeoutSec?: number; parentTaskId?: string; kind?: TaskRecord['kind'] },
): Promise<TaskRecord> {
  const cfg = loaded.config;
  // Depth guard: delegated tasks cannot spawn further delegation.
  let depth = 0;
  if (opts.parentTaskId) {
    const parent = store.get(opts.parentTaskId);
    depth = (parent?.depth ?? 0) + 1;
    if (depth > cfg.safety.maxDelegationDepth) {
      return store.create({ role: role.id, instructions, depth, parentTaskId: opts.parentTaskId, status: 'blocked', kind: opts.kind ?? 'delegate', error: { code: 'depth_limit', message: `delegation depth ${depth} exceeds max ${cfg.safety.maxDelegationDepth}` } });
    }
  }
  const task = store.create({ role: role.id, instructions, depth, parentTaskId: opts.parentTaskId, status: 'queued', kind: opts.kind ?? 'delegate' });

  const ctx = buildContext(loaded, context);
  if (!ctx.ok) {
    task.status = 'blocked'; task.error = { code: 'context_policy', message: ctx.error! }; store.save(task);
    return task;
  }

  const fullUser = ctx.text ? `${ctx.text}\n\n--- TASK ---\n${instructions}` : instructions;
  const secrets = scanForSecrets(`${role.systemPrompt}\n${fullUser}`);
  if (secrets.length && cfg.safety.egress.onSecret === 'block') {
    task.status = 'blocked'; task.egressBlocked = secrets;
    task.error = { code: 'egress_secret', message: `outbound content matched secret patterns: ${secrets.join(', ')}` };
    store.save(task); return task;
  }

  const usageToday = ledger.usageToday();
  if (usageToday.tokens >= cfg.budget.dailyTokens) {
    task.status = 'blocked'; task.error = { code: 'budget_tokens', message: `daily token budget exhausted (${usageToday.tokens}/${cfg.budget.dailyTokens})` };
    store.save(task); return task;
  }
  if (usageToday.costUsd >= cfg.budget.dailyCostUsd && cfg.budget.dailyCostUsd > 0) {
    task.status = 'blocked'; task.error = { code: 'budget_cost', message: `daily cost budget exhausted ($${usageToday.costUsd}/$${cfg.budget.dailyCostUsd})` };
    store.save(task); return task;
  }

  const sel = selectModel(cfg, role, { model: opts.model, provider: opts.provider, routingProfile: opts.routingProfile });
  if ('error' in sel) {
    task.status = 'blocked'; task.error = { code: 'routing', message: sel.error }; store.save(task); return task;
  }

  const maxTokens = Math.min(opts.maxOutputTokens ?? role.maxOutputTokens, cfg.budget.perTaskMaxOutputTokens);
  task.status = 'running'; task.provider = sel.provider.id; task.model = sel.model; store.save(task);

  const messages: ChatMessage[] = [
    { role: 'system', content: role.systemPrompt },
    { role: 'user', content: fullUser },
  ];
  const result = await chatCompletion(cfg, sel.model, messages, maxTokens, opts.timeoutSec);
  task.latencyMs = result.latencyMs;
  if (result.ok) {
    task.status = 'done';
    task.output = result.content;
    task.model = result.model ?? sel.model;
    const outSecrets = scanForSecrets(result.content ?? '');
    if (outSecrets.length) task.output = `[output withheld: matched secret patterns ${outSecrets.join(', ')}]`;
    task.usage = { inputTokens: result.usage?.inputTokens, outputTokens: result.usage?.outputTokens, costUsd: 0 };
    ledger.add(result.usage?.totalTokens ?? 0, 0);
  } else {
    task.status = result.error?.code === 'timeout' ? 'timeout' : 'error';
    task.error = result.error;
  }
  store.save(task);
  return task;
}

function findRole(roles: Role[], id: string): Role | undefined {
  return roles.find((r) => r.id === id);
}

async function runWithConcurrency<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export function registerTools(server: McpServer, loaded: LoadedConfig): void {
  const cfg = loaded.config;
  const store = new TaskStore(loaded.stateDir);
  const ledger = new BudgetLedger(loaded.stateDir);
  const envDepth = Number(process.env.REPASSA_ORCH_DEPTH ?? '0');

  server.registerTool('list_models', {
    title: 'List orchestrator models',
    description: 'Owner-approved providers/models, billing class, capabilities and routing profiles. Only these may be delegated to.',
    inputSchema: {},
  }, async () => {
    const usage = ledger.usageToday();
    return {
      content: [{ type: 'text', text: `${cfg.providers.length} policy providers; mode=${cfg.safety.mode}; today: ${usage.calls} calls, ${usage.tokens} tokens.` }],
      structuredContent: {
        safetyMode: cfg.safety.mode,
        routingProfiles: Object.keys(cfg.routing.profiles),
        defaultProfile: cfg.routing.defaultProfile,
        providers: listPolicyModels(cfg),
        roles: loaded.roles.map((r) => ({ id: r.id, title: r.title, capabilities: r.capabilities, writable: r.writable, maxOutputTokens: r.maxOutputTokens })),
        budget: { dailyTokens: cfg.budget.dailyTokens, usedTodayTokens: usage.tokens, dailyCostUsd: cfg.budget.dailyCostUsd, usedTodayCostUsd: usage.costUsd },
        workersEnabled: workersEnabled(cfg).enabled,
      },
    };
  });

  server.registerTool('delegate_task', {
    title: 'Delegate bounded task',
    description: 'Send one bounded task to a policy-approved external model via the local gateway. Returns taskId + result inline when done.',
    inputSchema: delegateArgs,
  }, async (args) => {
    if (envDepth >= cfg.safety.maxDelegationDepth) {
      return { content: [{ type: 'text', text: 'Delegation refused: this process is itself a delegated worker.' }], isError: true };
    }
    const role = findRole(loaded.roles, args.role);
    if (!role) return { content: [{ type: 'text', text: `Unknown role "${args.role}". Call list_models for valid roles.` }], isError: true };
    const task = await runDelegation(loaded, store, ledger, role, args.instructions, args.context as CtxItem[] | undefined, args);
    return summary(task);
  });

  server.registerTool('delegate_parallel', {
    title: 'Delegate tasks in parallel',
    description: 'Run independent bounded tasks concurrently (bounded by concurrency.maxParallel). All-or-nothing validation; returns each task result.',
    inputSchema: {
      tasks: z.array(z.object(delegateArgs)).min(1).max(6),
    },
  }, async (args) => {
    if (envDepth >= cfg.safety.maxDelegationDepth) {
      return { content: [{ type: 'text', text: 'Delegation refused: nested delegation disabled.' }], isError: true };
    }
    const results = await runWithConcurrency(args.tasks, cfg.concurrency.maxParallel, async (t) => {
      const role = findRole(loaded.roles, t.role);
      if (!role) {
        return { role: t.role, status: 'blocked', error: { code: 'unknown_role', message: `role "${t.role}" not defined` } };
      }
      const rec = await runDelegation(loaded, store, ledger, role, t.instructions, t.context as CtxItem[] | undefined, { ...t, kind: 'parallel' });
      return { role: rec.role, taskId: rec.taskId, status: rec.status, provider: rec.provider, model: rec.model, usage: rec.usage, error: rec.error, output: rec.status === 'done' ? rec.output : undefined };
    });
    const done = results.filter((r) => r.status === 'done').length;
    return {
      content: [{ type: 'text', text: `${done}/${results.length} parallel tasks completed.` }],
      structuredContent: { results },
    };
  });

  server.registerTool('review_proposal', {
    title: 'Second-model review',
    description: 'Ask a different model to review a proposal/diff and return findings. Use after delegate_task/worker output.',
    inputSchema: {
      proposal: z.string().max(60000).describe('the proposal text or diff to review'),
      reviewerRole: z.string().default('backend-reviewer'),
      sourceTaskId: z.string().optional(),
      model: z.string().optional(),
      routingProfile: z.string().optional(),
    },
  }, async (args) => {
    const role = findRole(loaded.roles, args.reviewerRole);
    if (!role) return { content: [{ type: 'text', text: `Unknown reviewer role "${args.reviewerRole}".` }], isError: true };
    const instructions = `Review the following proposal. Report a severity-ordered findings list (blockers first), then an overall verdict (approve/changes-needed/reject). Be concise.\n\n${args.proposal}`;
    const task = await runDelegation(loaded, store, ledger, role, instructions, undefined, {
      model: args.model, routingProfile: args.routingProfile, parentTaskId: args.sourceTaskId, kind: 'review',
    });
    return summary(task);
  });

  server.registerTool('get_task_result', {
    title: 'Get task result',
    description: 'Retrieve a stored task record (status, model used, usage, output) by taskId.',
    inputSchema: { taskId: z.string() },
  }, async (args) => {
    const rec = store.get(args.taskId);
    if (!rec) return { content: [{ type: 'text', text: `No task ${args.taskId}.` }], isError: true };
    return summary(rec);
  });

  server.registerTool('orchestrator_health', {
    title: 'Orchestrator health',
    description: 'Check gateway reachability, API key presence, budget state and policy counts. No secrets returned.',
    inputSchema: {},
  }, async () => {
    const probe = await probeGateway(cfg);
    const usage = ledger.usageToday();
    return {
      content: [{ type: 'text', text: probe.reachable ? `Gateway reachable at ${cfg.gateway.baseUrl} (${probe.latencyMs}ms).` : `Gateway unreachable: ${probe.error}` }],
      structuredContent: {
        gateway: { type: cfg.gateway.type, baseUrl: cfg.gateway.baseUrl, reachable: probe.reachable, latencyMs: probe.latencyMs, modelsEndpointOk: probe.modelsOk, apiKeyPresent: Boolean(process.env[cfg.gateway.apiKeyEnv]) },
        budget: { usedToday: usage, dailyTokens: cfg.budget.dailyTokens, dailyCostUsd: cfg.budget.dailyCostUsd },
        safety: { mode: cfg.safety.mode, localhostOnly: cfg.safety.localhostOnly, maxDelegationDepth: cfg.safety.maxDelegationDepth, envDepth },
        policyProviders: cfg.providers.length,
        roles: loaded.roles.length,
        workers: workersEnabled(cfg),
      },
    };
  });

  server.registerTool('delegate_worktree_task', {
    title: 'Controlled coding worker',
    description: 'SUPERVISED mode only: create an isolated git worktree, send allowlisted files + task to a model, apply the returned patch, and return patch+diff for review. Never commits or pushes.',
    inputSchema: {
      role: z.string().default('frontend-implementer'),
      instructions: z.string().max(12000),
      files: z.array(z.string()).min(1).max(30).describe('repo-relative paths the worker may read; patch may only touch these plus allowedPathPrefixes'),
      baseRef: z.string().default('origin/main'),
      model: z.string().optional(),
      timeoutSec: z.number().positive().max(300).optional(),
    },
  }, async (args) => {
    const gate = workersEnabled(cfg);
    if (!gate.enabled) {
      return { content: [{ type: 'text', text: `Workers disabled: ${gate.reason}` }], isError: true };
    }
    const role = findRole(loaded.roles, args.role);
    if (!role || !role.writable) {
      return { content: [{ type: 'text', text: `Role "${args.role}" is unknown or read-only; workers require a writable role.` }], isError: true };
    }
    const collected = collectWorkerFiles(cfg, loaded.repoRoot, args.files);
    if (!collected.ok) {
      return { content: [{ type: 'text', text: `Worker file access denied: ${collected.error}` }], isError: true };
    }
    const seed = store.create({ role: role.id, instructions: args.instructions, depth: 0, status: 'queued', kind: 'worker' });
    const prep = await prepareWorktree(cfg, loaded.repoRoot, seed.taskId, args.baseRef);
    if (!prep.ok) {
      seed.status = 'error'; seed.error = { code: 'worktree', message: prep.error! }; store.save(seed);
      return summary(seed);
    }
    const prompt = `${collected.context}\n\n--- TASK ---\n${args.instructions}\n\nRespond ONLY with a valid unified diff (git apply compatible) covering the allowed files.`;
    const secrets = scanForSecrets(`${role.systemPrompt}\n${prompt}`);
    if (secrets.length && cfg.safety.egress.onSecret === 'block') {
      seed.status = 'blocked'; seed.egressBlocked = secrets;
      seed.error = { code: 'egress_secret', message: `worker prompt matched secret patterns: ${secrets.join(', ')}` };
      store.save(seed); return summary(seed);
    }
    const sel = selectModel(cfg, role, { model: args.model });
    if ('error' in sel) {
      seed.status = 'blocked'; seed.error = { code: 'routing', message: sel.error }; store.save(seed); return summary(seed);
    }
    seed.status = 'running'; seed.provider = sel.provider.id; seed.model = sel.model; store.save(seed);
    const result = await chatCompletion(cfg, sel.model, [
      { role: 'system', content: role.systemPrompt },
      { role: 'user', content: prompt },
    ], Math.min(role.maxOutputTokens, cfg.budget.perTaskMaxOutputTokens), args.timeoutSec);
    seed.latencyMs = result.latencyMs;
    if (!result.ok) {
      seed.status = result.error?.code === 'timeout' ? 'timeout' : 'error'; seed.error = result.error; store.save(seed);
      return summary(seed);
    }
    const patch = result.content ?? '';
    const patchMatch = patch.match(/^(diff --git[\s\S]*)$/m) ?? [null, patch];
    const applied = await applyPatchToWorktree(prep.worktreePath!, patchMatch[1]!, join(loaded.stateDir, 'workers', seed.taskId));
    if (!applied.ok) {
      seed.status = 'error'; seed.error = { code: 'patch_apply', message: applied.error! }; store.save(seed);
      return { ...summary(seed), structuredContent: { ...summary(seed).structuredContent, worktreePath: prep.worktreePath, patchFile: applied.patchFile } };
    }
    seed.status = 'done';
    seed.output = `Patch applied in worktree ${prep.worktreePath} (branch ${prep.branch}).\n\n${applied.diffStat}`;
    seed.usage = { inputTokens: result.usage?.inputTokens, outputTokens: result.usage?.outputTokens, costUsd: 0 };
    ledger.add(result.usage?.totalTokens ?? 0, 0);
    store.save(seed);
    return {
      content: [{ type: 'text', text: `Worker ${seed.taskId}: patch applied in ${prep.worktreePath}. Review patchFile/diff before integrating.` }],
      structuredContent: {
        taskId: seed.taskId, status: seed.status, provider: seed.provider, model: seed.model,
        worktreePath: prep.worktreePath, branch: prep.branch, patchFile: applied.patchFile,
        diffStat: applied.diffStat, diff: applied.diff, usage: seed.usage,
        next: 'Review the diff, run repo checks inside the worktree, then merge via normal PR flow. Nothing was committed or pushed.',
      },
    };
  });
}

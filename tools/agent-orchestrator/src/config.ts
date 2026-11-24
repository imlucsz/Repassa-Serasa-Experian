import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
export const TOOL_ROOT = resolve(MODULE_DIR, '..');

const expandEnv = (s: string): string =>
  s.replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, (_, name) => process.env[name] ?? '');

const billingEnum = z.enum(['free', 'paid', 'unknown']);

const modelSchema = z.object({
  id: z.string().min(1),
  capabilities: z.array(z.string()).default(['text']),
  contextTokens: z.number().int().positive().optional(),
});

const providerSchema = z.object({
  id: z.string().min(1),
  billing: billingEnum.default('unknown'),
  note: z.string().optional(),
  models: z.array(modelSchema).default([]),
  envKey: z.string().optional(),
  // Optional owner-declared pricing used ONLY for ledger estimates. Absent
  // pricing on a free provider records cost 0 with basis 'declared-free';
  // the gateway is never trusted to report spend.
  pricing: z.object({
    inputPerMToken: z.number().min(0),
    outputPerMToken: z.number().min(0),
  }).optional(),
  // Per-provider daily spend ceiling; calls are blocked once reached.
  maxDailyCostUsd: z.number().min(0).optional(),
});

export const configSchema = z.object({
  version: z.literal(1),
  safety: z.object({
    mode: z.enum(['read-only', 'supervised']).default('read-only'),
    egress: z.object({
      onSecret: z.enum(['block', 'redact']).default('block'),
      maxContextBytes: z.number().int().positive().default(131072),
      maxFileBytes: z.number().int().positive().default(32768),
    }).prefault({}),
    localhostOnly: z.boolean().default(true),
    maxDelegationDepth: z.number().int().min(0).default(1),
    executeModelCommands: z.boolean().default(false),
  }).prefault({}),
  gateway: z.object({
    type: z.enum(['openai-compatible', 'mock']).default('openai-compatible'),
    baseUrl: z.string().url().default('http://127.0.0.1:20128/v1'),
    apiKeyEnv: z.string().default('OMNIROUTE_API_KEY'),
    adminBaseUrl: z.string().url().optional(),
    timeoutSec: z.number().positive().default(60),
    maxTimeoutSec: z.number().positive().default(300),
    maxRetries: z.number().int().min(0).default(0),
  }).prefault({}),
  budget: z.object({
    dailyTokens: z.number().int().positive().default(200000),
    dailyCostUsd: z.number().min(0).default(0),
    perTaskMaxOutputTokens: z.number().int().positive().default(4096),
  }).prefault({}),
  concurrency: z.object({
    maxParallel: z.number().int().positive().default(3),
    perProvider: z.number().int().positive().default(2),
  }).prefault({}),
  stateDir: z.string().default('%LOCALAPPDATA%/RepassaOrchestrator/state'),
  repoRoot: z.string().default('../..'),
  rolesFile: z.string().default('./roles.json'),
  routing: z.object({
    defaultProfile: z.string().default('free-only'),
    profiles: z.record(z.string(), z.object({ billing: z.array(billingEnum) })).prefault({}),
  }).prefault({}),
  providers: z.array(providerSchema).default([]),
  workers: z.object({
    enabled: z.boolean().default(false),
    worktreeRoot: z.string().default('%LOCALAPPDATA%/RepassaOrchestrator/worktrees'),
    branchPrefix: z.string().default('worker/'),
    allowedPathPrefixes: z.array(z.string()).default(['src/', 'docs/', 'tests/', 'public/']),
    deniedPathGlobs: z.array(z.string()).default([]),
  }).prefault({}),
});

export type OrchestratorConfig = z.infer<typeof configSchema>;
export type ProviderDecl = z.infer<typeof providerSchema>;

const roleSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  description: z.string(),
  capabilities: z.array(z.string()).default(['text']),
  maxOutputTokens: z.number().int().positive().default(2048),
  writable: z.boolean().default(false),
  systemPrompt: z.string(),
});
export type Role = z.infer<typeof roleSchema>;
const rolesFileSchema = z.object({ version: z.literal(1), roles: z.array(roleSchema) });

export interface LoadedConfig {
  config: OrchestratorConfig;
  roles: Role[];
  repoRoot: string;
  stateDir: string;
  configPath: string;
}

function resolveConfigPath(): string {
  if (process.env.ORCHESTRATOR_CONFIG) return resolve(expandEnv(process.env.ORCHESTRATOR_CONFIG));
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    const userCfg = join(localAppData, 'RepassaOrchestrator', 'orchestrator.config.json');
    if (existsSync(userCfg)) return userCfg;
  }
  const repoCfg = join(TOOL_ROOT, 'orchestrator.config.json');
  if (existsSync(repoCfg)) return repoCfg;
  return join(TOOL_ROOT, 'orchestrator.config.example.json');
}

// Resolve a possibly-relative path deterministically: absolute paths win;
// relative paths are tried against the config directory first, then the tool
// installation directory (TOOL_ROOT). For repoRoot a candidate must also look
// like a repository root (.git or package.json present), so a config copied to
// %LOCALAPPDATA% can never resolve AppData's parent as "the repo".
function resolveFromBases(value: string, baseDir: string, repoMarkerCheck: boolean): string {
  const expanded = expandEnv(value);
  if (resolve(expanded) === expanded || /^[A-Za-z]:[\\/]/.test(expanded) || expanded.startsWith('\\\\')) {
    return expanded; // absolute
  }
  const candidates = [resolve(baseDir, expanded), resolve(TOOL_ROOT, expanded)];
  const ok = (c: string) =>
    existsSync(c) &&
    (!repoMarkerCheck || existsSync(join(c, '.git')) || existsSync(join(c, 'package.json')));
  return candidates.find(ok) ?? candidates[candidates.length - 1];
}

// JSON.parse rejects a UTF-8 BOM; Notepad and PS5.1 Set-Content -Encoding UTF8
// both write one, so strip it on every config read.
const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));

export function loadConfig(configPath?: string): LoadedConfig {
  const path = configPath ? resolve(expandEnv(configPath)) : resolveConfigPath();
  if (!existsSync(path)) throw new Error(`Orchestrator config not found: ${path}`);
  const raw = readJson(path);
  const config = configSchema.parse(raw);
  const baseDir = dirname(path);
  const repoRoot = resolveFromBases(config.repoRoot, baseDir, true);
  const rolesPath = resolveFromBases(config.rolesFile, baseDir, false);
  const rolesRaw = existsSync(rolesPath)
    ? readJson(rolesPath)
    : { version: 1, roles: [] };
  const roles = rolesFileSchema.parse(rolesRaw).roles;
  return { config, roles, repoRoot, stateDir: expandEnv(config.stateDir), configPath: path };
}

// Task records + local budget ledger. JSON files under stateDir so results
// survive restarts; no secrets are ever persisted.
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export type TaskStatus = 'queued' | 'running' | 'done' | 'error' | 'blocked' | 'timeout';

export interface TaskRecord {
  taskId: string;
  parentTaskId?: string;
  depth: number;
  role: string;
  instructions: string;
  provider?: string;
  model?: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  output?: string;
  usage?: { inputTokens?: number; outputTokens?: number; costUsd?: number };
  costBasis?: 'declared-free' | 'declared-pricing' | 'unavailable';
  latencyMs?: number;
  error?: { code: string; message: string; retryable?: boolean };
  egressBlocked?: string[];
  kind: 'delegate' | 'parallel' | 'review' | 'worker';
}

const MAX_STORED_OUTPUT = 64 * 1024;

export class TaskStore {
  constructor(private dir: string) {
    mkdirSync(join(dir, 'tasks'), { recursive: true });
  }
  private file(id: string): string { return join(this.dir, 'tasks', `${id}.json`); }
  create(init: Omit<TaskRecord, 'taskId' | 'createdAt' | 'updatedAt'>): TaskRecord {
    const now = new Date().toISOString();
    const rec: TaskRecord = { ...init, taskId: `t-${randomUUID().slice(0, 12)}`, createdAt: now, updatedAt: now };
    this.save(rec);
    return rec;
  }
  save(rec: TaskRecord): void {
    rec.updatedAt = new Date().toISOString();
    const clone = { ...rec };
    if (clone.output && clone.output.length > MAX_STORED_OUTPUT) {
      clone.output = clone.output.slice(0, MAX_STORED_OUTPUT) + '\n[truncated in store]';
    }
    writeFileSync(this.file(rec.taskId), JSON.stringify(clone, null, 2));
  }
  get(id: string): TaskRecord | undefined {
    const f = this.file(id);
    if (!existsSync(f)) return undefined;
    return JSON.parse(readFileSync(f, 'utf8')) as TaskRecord;
  }
  list(limit = 50): TaskRecord[] {
    return readdirSync(join(this.dir, 'tasks'))
      .filter((f) => f.endsWith('.json'))
      .sort()
      .slice(-limit)
      .map((f) => JSON.parse(readFileSync(join(this.dir, 'tasks', f), 'utf8')) as TaskRecord);
  }
}

interface ProviderUsage { tokens: number; costUsd: number; calls: number }
type DayUsage = ProviderUsage & { byProvider: Record<string, ProviderUsage> };

export class BudgetLedger {
  constructor(private dir: string) { mkdirSync(dir, { recursive: true }); }
  private key(): string { return new Date().toISOString().slice(0, 10); }
  private file(): string { return join(this.dir, 'ledger.json'); }
  private read(): Record<string, DayUsage> {
    const f = this.file();
    return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
  }
  usageToday(): ProviderUsage {
    const day = this.read()[this.key()];
    return day ? { tokens: day.tokens, costUsd: day.costUsd, calls: day.calls } : { tokens: 0, costUsd: 0, calls: 0 };
  }
  providerUsageToday(providerId: string): ProviderUsage {
    return this.read()[this.key()]?.byProvider?.[providerId] ?? { tokens: 0, costUsd: 0, calls: 0 };
  }
  add(tokens: number, costUsd: number, providerId: string): void {
    const all = this.read();
    const day = all[this.key()] ?? { tokens: 0, costUsd: 0, calls: 0, byProvider: {} };
    const prov = day.byProvider[providerId] ?? { tokens: 0, costUsd: 0, calls: 0 };
    day.byProvider[providerId] = { tokens: prov.tokens + tokens, costUsd: +(prov.costUsd + costUsd).toFixed(6), calls: prov.calls + 1 };
    all[this.key()] = { tokens: day.tokens + tokens, costUsd: +(day.costUsd + costUsd).toFixed(6), calls: day.calls + 1, byProvider: day.byProvider };
    writeFileSync(this.file(), JSON.stringify(all, null, 2));
  }
}

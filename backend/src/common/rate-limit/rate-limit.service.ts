/**
 * Fixed-window in-memory rate limiter (SECURITY.md). Buckets are keyed by
 * caller-provided composite keys (e.g. `login:id:<ip>:<email>`), so one service
 * supports identity- and IP-scoped limits in parallel.
 *
 * Limitation: state lives in process memory — limits apply per replica.
 * Acceptable for the single-instance demo deployment; a multi-instance rollout
 * must move buckets to a shared store (see SECURITY.md rate-limit notes).
 */
import { HttpException, HttpStatus, Injectable, OnModuleDestroy } from '@nestjs/common';

interface Bucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly buckets = new Map<string, Bucket>();
  private readonly sweeper: NodeJS.Timeout;
  /** Clock source — tests may override before use. */
  protected now: () => number = Date.now;

  constructor() {
    this.sweeper = setInterval(() => this.sweep(), 60_000);
    this.sweeper.unref();
  }

  /** Returns true and records the attempt when under the limit for the window. */
  consume(key: string, limit: number, windowMs: number): boolean {
    const now = this.now();
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (bucket.count >= limit) return false;
    bucket.count += 1;
    return true;
  }

  /** Records the attempt and throws the contract 429 error when over limit. */
  assertAllowed(key: string, limit: number, windowMs: number): void {
    if (!this.consume(key, limit, windowMs)) {
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.sweeper);
  }

  private sweep(): void {
    const now = this.now();
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

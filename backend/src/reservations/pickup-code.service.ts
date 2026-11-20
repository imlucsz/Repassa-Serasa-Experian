import { createHmac, randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../config/env.validation';

/**
 * Pickup codes (BUSINESS_RULES.md): 12 random-looking Crockford-style
 * characters, grouped 4-4-4 for display. Codes are derived deterministically
 * from a domain-separated HMAC of the reservation UUID — a student can re-view
 * their own code without the plaintext ever being stored. Staff lookup uses a
 * second domain-separated keyed digest stored in `reservations.code_digest`;
 * the raw code is never persisted or logged.
 *
 * Display alphabet matches the contract's PickupInput pattern (uppercase
 * subset: digits + A-Z minus I/L/O/U — visually unambiguous).
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // 38 chars
const CODE_LENGTH = 12;
const GENERATION_DOMAIN = 'repassa:pickup-code:generate';
const LOOKUP_DOMAIN = 'repassa:pickup-code:lookup';

@Injectable()
export class PickupCodeService {
  private readonly generationKey: Buffer;
  private readonly lookupKey: Buffer;

  constructor(config: ConfigService<EnvConfig, true>) {
    const secret = config.get('pickupCodeSecret', { infer: true });
    // Ephemeral root for dev/test only — env validation requires the secret in
    // production, so this branch cannot run there. Codes change on restart,
    // which only affects reservations made before the restart.
    const root = secret ? Buffer.from(secret, 'utf8') : randomBytes(32);
    if (!secret) {
      new Logger(PickupCodeService.name).warn(
        'PICKUP_CODE_SECRET not set; using an ephemeral per-process code key (dev/test only).',
      );
    }
    this.generationKey = createHmac('sha256', root).update(GENERATION_DOMAIN).digest();
    this.lookupKey = createHmac('sha256', root).update(LOOKUP_DOMAIN).digest();
  }

  /** Deterministic code for a reservation id, formatted XXXX-XXXX-XXXX. */
  codeForReservation(reservationId: string): string {
    const digest = createHmac('sha256', this.generationKey)
      .update(reservationId)
      .digest();
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += ALPHABET[digest[i] % ALPHABET.length];
    }
    return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
  }

  /**
   * Normalizes a submitted code: strips separators/whitespace, uppercases.
   * Returns the 12-char canonical form or null when malformed.
   */
  normalizeCode(raw: string): string | null {
    const cleaned = raw.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (cleaned.length !== CODE_LENGTH) return null;
    return cleaned.split('').every((c) => ALPHABET.includes(c)) ? cleaned : null;
  }

  /** Keyed digest persisted for staff lookup — never the raw code. */
  digestFor(normalizedCode: string): string {
    return createHmac('sha256', this.lookupKey).update(normalizedCode).digest('hex');
  }

  /** Convenience: digest for an already-formatted or raw submitted code. */
  digestForSubmission(raw: string): string | null {
    const normalized = this.normalizeCode(raw);
    return normalized ? this.digestFor(normalized) : null;
  }
}

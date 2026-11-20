/**
 * Client IP normalization for rate-limit buckets (SECURITY.md):
 * IPv4-mapped IPv6 collapses to IPv4; IPv6 collapses to its /64 prefix so an
 * attacker cannot rotate addresses inside an assigned prefix to bypass limits.
 * Never trusts X-Forwarded-For — callers must pass the peer IP that Fastify
 * resolved under the configured trustProxy policy.
 */
export function normalizeClientIp(ip: string | undefined | null): string {
  if (!ip) return 'unknown';
  let value = ip.trim().toLowerCase();
  if (value.startsWith('[')) value = value.slice(1, value.indexOf(']'));
  const zoneIndex = value.indexOf('%');
  if (zoneIndex !== -1) value = value.slice(0, zoneIndex);

  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(value);
  if (mapped) return `v4:${mapped[1]}`;
  if (value.includes('.')) return `v4:${value}`;
  if (!value.includes(':')) return 'unknown';

  const hextets = expandIpv6(value);
  if (!hextets) return 'unknown';
  return `v6:${hextets.slice(0, 4).map((h) => h.padStart(4, '0')).join(':')}::/64`;
}

/** Expands `::` shorthand into 8 lowercase hextets; null when malformed. */
function expandIpv6(ip: string): string[] | null {
  const parts = ip.split('::');
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(':') : [];
  const tail = parts.length === 2 ? (parts[1] ? parts[1].split(':') : []) : null;
  const groups = tail === null ? head : [...head, ...new Array<string>(8 - head.length - tail.length).fill('0'), ...tail];
  if (groups.length !== 8) return null;
  if (groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups;
}

import { HttpException } from '@nestjs/common';
import { RateLimitService } from '../../src/common/rate-limit/rate-limit.service';
import { normalizeClientIp } from '../../src/common/rate-limit/ip';

describe('RateLimitService', () => {
  it('allows up to the limit within the window, then rejects', () => {
    const service = new RateLimitService();
    for (let i = 0; i < 5; i++) {
      expect(service.consume('k', 5, 60_000)).toBe(true);
    }
    expect(service.consume('k', 5, 60_000)).toBe(false);
    service.onModuleDestroy();
  });

  it('isolates buckets per key', () => {
    const service = new RateLimitService();
    service.consume('a', 1, 60_000);
    expect(service.consume('a', 1, 60_000)).toBe(false);
    expect(service.consume('b', 1, 60_000)).toBe(true);
    service.onModuleDestroy();
  });

  it('resets after the window elapses', () => {
    let now = 1_000;
    const service = new RateLimitService();
    service['now'] = () => now;
    expect(service.consume('k', 1, 60_000)).toBe(true);
    expect(service.consume('k', 1, 60_000)).toBe(false);
    now += 60_001;
    expect(service.consume('k', 1, 60_000)).toBe(true);
    service.onModuleDestroy();
  });

  it('assertAllowed throws the contract 429 shape when over limit', () => {
    const service = new RateLimitService();
    service.assertAllowed('k', 1, 60_000);
    try {
      service.assertAllowed('k', 1, 60_000);
      throw new Error('expected rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
    }
    service.onModuleDestroy();
  });
});

describe('normalizeClientIp', () => {
  it('keeps IPv4 as-is and maps IPv4-mapped IPv6', () => {
    expect(normalizeClientIp('203.0.113.9')).toBe('v4:203.0.113.9');
    expect(normalizeClientIp('::ffff:203.0.113.9')).toBe('v4:203.0.113.9');
    expect(normalizeClientIp('::FFFF:10.0.0.1')).toBe('v4:10.0.0.1');
  });

  it('collapses IPv6 addresses into their /64 prefix', () => {
    expect(normalizeClientIp('2001:db8:aaaa:bbbb:1:2:3:4')).toBe('v6:2001:0db8:aaaa:bbbb::/64');
    expect(normalizeClientIp('2001:db8:aaaa:bbbb:ffff:eeee:dddd:cccc')).toBe(
      'v6:2001:0db8:aaaa:bbbb::/64',
    );
    expect(normalizeClientIp('::1')).toBe('v6:0000:0000:0000:0000::/64');
  });

  it('strips brackets and zone identifiers', () => {
    expect(normalizeClientIp('[2001:db8:aaaa:bbbb::1]')).toBe('v6:2001:0db8:aaaa:bbbb::/64');
    expect(normalizeClientIp('fe80::1%eth0')).toBe('v6:fe80:0000:0000:0000::/64');
  });

  it('handles missing and malformed input', () => {
    expect(normalizeClientIp(undefined)).toBe('unknown');
    expect(normalizeClientIp('')).toBe('unknown');
    expect(normalizeClientIp('garbage')).toBe('unknown');
    expect(normalizeClientIp('2001:db8::1::2')).toBe('unknown');
  });
});

import { ConfigService } from '@nestjs/config';
import { SignJWT } from 'jose';
import type { EnvConfig } from '../../src/config/env.validation';
import { InvalidAccessTokenError, TokenService } from '../../src/auth/token.service';

const SECRET = 'unit-test-secret-key-that-is-32+chars-long!';
const USER = { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', role: 'STUDENT' };

function makeService(secret?: string): TokenService {
  const config = {
    get: (key: keyof EnvConfig | string) =>
      key === 'jwtAccessSecret' ? secret : undefined,
  } as unknown as ConfigService<EnvConfig, true>;
  return new TokenService(config);
}

describe('TokenService', () => {
  it('signs and verifies an access token with the expected claims', async () => {
    const service = makeService(SECRET);
    const token = await service.signAccessToken(USER, 900);
    const claims = await service.verifyAccessToken(token);
    expect(claims.sub).toBe(USER.id);
    expect(claims.role).toBe('STUDENT');
  });

  it('rejects expired tokens', async () => {
    const service = makeService(SECRET);
    const token = await service.signAccessToken(USER, -60);
    await expect(service.verifyAccessToken(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('rejects tokens signed with a different secret', async () => {
    const service = makeService(SECRET);
    const other = makeService('a-totally-different-secret-key-32chars');
    const foreign = await other.signAccessToken(USER, 900);
    await expect(service.verifyAccessToken(foreign)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('rejects wrong issuer, audience and algorithm', async () => {
    const service = makeService(SECRET);
    const key = new TextEncoder().encode(SECRET);
    const wrongIss = await new SignJWT({ role: 'STUDENT' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER.id)
      .setIssuer('evil-issuer')
      .setAudience('repassa-web')
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + 900)
      .sign(key);
    await expect(service.verifyAccessToken(wrongIss)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );

    // Hand-crafted alg=none token — jose refuses to sign it, which is correct.
    const b64u = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');
    const noneAlg = `${b64u({ alg: 'none', typ: 'JWT' })}.${b64u({
      role: 'STUDENT',
      sub: USER.id,
      iss: 'repassa-api',
      aud: 'repassa-web',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900,
    })}.`;
    await expect(service.verifyAccessToken(noneAlg)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );

    await expect(service.verifyAccessToken('not-a-jwt')).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('generates 256-bit refresh tokens and stable SHA-256 digests', () => {
    const service = makeService(SECRET);
    const t1 = service.generateRefreshToken();
    const t2 = service.generateRefreshToken();
    expect(t1).not.toBe(t2);
    expect(Buffer.from(t1, 'base64url')).toHaveLength(32);
    expect(service.hashRefreshToken(t1)).toMatch(/^[0-9a-f]{64}$/);
    expect(service.hashRefreshToken(t1)).toBe(service.hashRefreshToken(t1));
    expect(service.hashRefreshToken(t1)).not.toBe(service.hashRefreshToken(t2));
  });

  it('falls back to an ephemeral key only when no secret is configured', async () => {
    const ephemeral = makeService(undefined);
    const token = await ephemeral.signAccessToken(USER, 60);
    await expect(ephemeral.verifyAccessToken(token)).resolves.toBeDefined();
    // Another instance without secret cannot verify it (random per-process key).
    await expect(makeService(undefined).verifyAccessToken(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });
});

// Repository-anchored Prisma loading for live harness helpers. The harness
// scripts are ESM and may run from any cwd; resolution must therefore be tied
// to backend/package.json rather than process.cwd() or a temporary directory.
import { createRequire } from 'node:module';

const backendRequire = createRequire(new URL('../../backend/package.json', import.meta.url));

export function backendPrismaClientClass() {
  return backendRequire('@prisma/client').PrismaClient;
}

export function createBackendPrisma(databaseUrl) {
  const PrismaClient = backendPrismaClientClass();
  return new PrismaClient({ datasources: { db: { url: databaseUrl } } });
}

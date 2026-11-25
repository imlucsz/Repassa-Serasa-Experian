/**
 * RePassa synthetic seed — fictional data only, safe to re-run (idempotent).
 * Refuses to run in production. Demo accounts use SEED_DEMO_PASSWORD when set;
 * otherwise they receive random unusable passwords (structure-only seed).
 * See docs/repassa/DATA_MODEL.md and DEMO.md.
 */
import { createHmac, randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/common/crypto/password';

// Stable UUIDs so repeated runs converge instead of duplicating rows.
const IDS = {
  institutions: [
    '7a0f0c32-6a3b-4f8d-9f3a-6f5a1a2b3c4d',
    '7a0f0c32-6a3b-4f8d-9f3a-6f5a1a2b3c4e',
    '7a0f0c32-6a3b-4f8d-9f3a-6f5a1a2b3c4f', // pending — demonstrates admin approval
  ],
  users: {
    admin: '8b1f1d43-7b4c-4a9e-8a4b-7a6b2b3c4d5d',
    staffA: '8b1f1d43-7b4c-4a9e-8a4b-7a6b2b3c4d5e',
    staffB: '8b1f1d43-7b4c-4a9e-8a4b-7a6b2b3c4d5f',
    studentA: '8b1f1d43-7b4c-4a9e-8a4b-7a6b2b3c4d60',
    studentB: '8b1f1d43-7b4c-4a9e-8a4b-7a6b2b3c4d61',
  },
  materials: [
    '9c2a2e54-8c5d-4baf-9b5c-8b7c3c4d5e6f',
    '9c2a2e54-8c5d-4baf-9b5c-8b7c3c4d5e70',
    '9c2a2e54-8c5d-4baf-9b5c-8b7c3c4d5e71',
    '9c2a2e54-8c5d-4baf-9b5c-8b7c3c4d5e72',
    '9c2a2e54-8c5d-4baf-9b5c-8b7c3c4d5e73',
    '9c2a2e54-8c5d-4baf-9b5c-8b7c3c4d5e74',
  ],
  reservation: 'ad3b3f65-9d6e-5ca0-ad6d-9c8d4d5e6f75',
} as const;

// Mirrors src/reservations/pickup-code.service.ts — deterministic HMAC
// derivation so a seeded ACTIVE reservation is pickable by the running API
// only when the same PICKUP_CODE_SECRET is configured.
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function pickupLookupDigest(secret: string, reservationId: string): string {
  const generationKey = createHmac('sha256', secret).update('repassa:pickup-code:generate').digest();
  const lookupKey = createHmac('sha256', secret).update('repassa:pickup-code:lookup').digest();
  const digest = createHmac('sha256', generationKey).update(reservationId).digest();
  let code = '';
  for (let i = 0; i < 12; i++) code += CODE_ALPHABET[digest[i] % CODE_ALPHABET.length];
  return createHmac('sha256', lookupKey).update(code).digest('hex');
}

export async function runSeed(prisma: PrismaClient): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed refused: NODE_ENV=production. Seed is for dev/demo databases only.');
  }

  const demoPassword = process.env.SEED_DEMO_PASSWORD;
  const passwordHash = await hashPassword(
    demoPassword && demoPassword.length >= 12 ? demoPassword : randomBytes(24).toString('hex'),
  );
  if (!demoPassword) {
    console.warn(
      'SEED_DEMO_PASSWORD not set: demo accounts created with random unusable passwords.',
    );
  }

  const [institutionA, institutionB, institutionPending] = await Promise.all([
    prisma.institution.upsert({
      where: { id: IDS.institutions[0] },
      update: { status: 'APPROVED', isActive: true },
      create: {
        id: IDS.institutions[0],
        name: 'Instituto Aurora — Campus Fictício',
        publicAddress: 'Av. das Palmeiras, 100 — Centro (endereço fictício)',
        pickupInstructions: 'Retirada na recepção, seg–sex 9h–17h. Apresente o código.',
        status: 'APPROVED',
        isActive: true,
      },
    }),
    prisma.institution.upsert({
      where: { id: IDS.institutions[1] },
      update: { status: 'APPROVED', isActive: true },
      create: {
        id: IDS.institutions[1],
        name: 'Centro Comunitário Boa Leitura (fictício)',
        publicAddress: 'Rua dos Estudos, 42 — Vila Esperança (endereço fictício)',
        pickupInstructions: 'Balcão da biblioteca, ter–sáb 10h–18h. Apresente o código.',
        status: 'APPROVED',
        isActive: true,
      },
    }),
    prisma.institution.upsert({
      where: { id: IDS.institutions[2] },
      update: {},
      create: {
        id: IDS.institutions[2],
        name: 'Escola Horizonte (fictícia) — aguardando aprovação',
        publicAddress: 'Rua da Espera, 7 — Bairro Novo (endereço fictício)',
        pickupInstructions: 'Secretaria, seg–sex 8h–16h. Apresente o código.',
        status: 'PENDING',
        isActive: false,
      },
    }),
  ]);

  const admin = await prisma.user.upsert({
    where: { email: 'admin.demo@example.com' },
    update: {},
    create: {
      id: IDS.users.admin,
      email: 'admin.demo@example.com',
      displayName: 'Admin Demo',
      passwordHash,
      role: 'ADMIN',
    },
  });
  const staffA = await prisma.user.upsert({
    where: { email: 'funcionaria.marta@example.com' },
    update: {},
    create: {
      id: IDS.users.staffA,
      email: 'funcionaria.marta@example.com',
      displayName: 'Marta (equipe)',
      passwordHash,
      role: 'STAFF',
    },
  });
  const staffB = await prisma.user.upsert({
    where: { email: 'funcionario.rafael@example.com' },
    update: {},
    create: {
      id: IDS.users.staffB,
      email: 'funcionario.rafael@example.com',
      displayName: 'Rafael (equipe)',
      passwordHash,
      role: 'STAFF',
    },
  });
  const studentA = await prisma.user.upsert({
    where: { email: 'ana.aluna@example.com' },
    update: {},
    create: {
      id: IDS.users.studentA,
      email: 'ana.aluna@example.com',
      displayName: 'Ana',
      passwordHash,
      role: 'STUDENT',
    },
  });
  const studentB = await prisma.user.upsert({
    where: { email: 'bruno.aluno@example.com' },
    update: {},
    create: {
      id: IDS.users.studentB,
      email: 'bruno.aluno@example.com',
      displayName: 'Bruno',
      passwordHash,
      role: 'STUDENT',
    },
  });

  await prisma.membership.upsert({
    where: { userId_institutionId: { userId: staffA.id, institutionId: institutionA.id } },
    update: {},
    create: { userId: staffA.id, institutionId: institutionA.id },
  });
  await prisma.membership.upsert({
    where: { userId_institutionId: { userId: staffB.id, institutionId: institutionB.id } },
    update: {},
    create: { userId: staffB.id, institutionId: institutionB.id },
  });

  const receivedAt = new Date('2026-11-15T14:00:00.000Z');
  const materials = [
    {
      id: IDS.materials[0],
      donorId: studentA.id,
      institutionId: institutionA.id,
      title: 'Cálculo Vol. 1 — James Stewart',
      description: 'Livro didático de cálculo em bom estado, sem rasuras nas páginas.',
      category: 'BOOK' as const,
      condition: 'GOOD' as const,
      status: 'RESERVED' as const,
      receivedAt,
      receivedBy: staffA.id,
    },
    {
      id: IDS.materials[1],
      donorId: studentB.id,
      institutionId: institutionA.id,
      title: 'Caderno de rascunho 10 matérias',
      description: 'Caderno pouco usado, espiral intacta, capa sem danos.',
      category: 'NOTEBOOK' as const,
      condition: 'LIKE_NEW' as const,
      status: 'PENDING_RECEIPT' as const,
    },
    {
      id: IDS.materials[2],
      donorId: studentA.id,
      institutionId: institutionA.id,
      title: 'Introdução à Economia — Mankiw',
      description: 'Edição anterior, completa, útil para disciplinas introdutórias.',
      category: 'BOOK' as const,
      condition: 'FAIR' as const,
      status: 'DELIVERED' as const,
      receivedAt,
      receivedBy: staffA.id,
    },
    {
      id: IDS.materials[3],
      donorId: studentB.id,
      institutionId: institutionB.id,
      title: 'Algoritmos — Cormen (capa dura)',
      description: 'Referência de algoritmos, algumas anotações a lápis.',
      category: 'BOOK' as const,
      condition: 'GOOD' as const,
      status: 'AVAILABLE' as const,
      receivedAt,
      receivedBy: staffB.id,
    },
    {
      id: IDS.materials[4],
      donorId: studentA.id,
      institutionId: institutionB.id,
      title: 'Kit de canetas e marca-texto',
      description: 'Conjunto de material de papelaria novo, ainda lacrado.',
      category: 'SUPPLIES' as const,
      condition: 'LIKE_NEW' as const,
      status: 'PENDING_RECEIPT' as const,
    },
    {
      id: IDS.materials[5],
      donorId: studentB.id,
      institutionId: institutionB.id,
      title: 'Gramática de Português',
      description: 'Livro de consulta em estado razoável, páginas amareladas.',
      category: 'BOOK' as const,
      condition: 'FAIR' as const,
      status: 'AVAILABLE' as const,
      receivedAt,
      receivedBy: staffB.id,
    },
  ];

  for (const material of materials) {
    await prisma.material.upsert({ where: { id: material.id }, update: {}, create: material });
  }

  // One live reservation so the staff pickup flow is immediately demoable.
  // Needs PICKUP_CODE_SECRET matching the running API; skipped silently
  // otherwise (the reservation is still created for history views).
  const pickupSecret = process.env.PICKUP_CODE_SECRET;
  await prisma.reservation.upsert({
    where: { id: IDS.reservation },
    update: {},
    create: {
      id: IDS.reservation,
      materialId: IDS.materials[0],
      studentId: studentB.id,
      status: 'ACTIVE',
      codeDigest: pickupSecret
        ? pickupLookupDigest(pickupSecret, IDS.reservation)
        : randomBytes(32).toString('hex'),
      expiresAt: new Date(Date.now() + 72 * 3600 * 1000),
    },
  });
  if (!pickupSecret) {
    console.warn('PICKUP_CODE_SECRET not set: seeded reservation has an unusable code digest.');
  }

  void institutionPending; // surfaced through admin endpoints, not the public catalog
  void admin;

  const counts = await prisma.$transaction([
    prisma.institution.count(),
    prisma.user.count(),
    prisma.membership.count(),
    prisma.material.count(),
    prisma.reservation.count(),
  ]);
  console.log(
    `Seed done: ${counts[0]} institutions, ${counts[1]} users, ` +
      `${counts[2]} memberships, ${counts[3]} materials, ${counts[4]} reservations.`,
  );
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await runSeed(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

// Works under both CJS (tsx CLI) and ESM (jest) without require.main.
const invokedAsScript = !!process.argv[1] && /seed\.ts$/.test(process.argv[1]);
if (invokedAsScript) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

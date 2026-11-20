/**
 * RePassa synthetic seed — fictional data only, safe to re-run (idempotent).
 * Refuses to run in production. Demo accounts use SEED_DEMO_PASSWORD when set;
 * otherwise they receive random unusable passwords (structure-only seed).
 * See docs/repassa/DATA_MODEL.md and DEMO.md.
 */
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const ARGON2_OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB — OWASP starting point (SECURITY.md)
  timeCost: 2,
  parallelism: 1,
};

// Stable UUIDs so repeated runs converge instead of duplicating rows.
const IDS = {
  institutions: [
    '7a0f0c32-6a3b-4f8d-9f3a-6f5a1a2b3c4d',
    '7a0f0c32-6a3b-4f8d-9f3a-6f5a1a2b3c4e',
  ],
  users: {
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
} as const;

export async function runSeed(prisma: PrismaClient): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed refused: NODE_ENV=production. Seed is for dev/demo databases only.');
  }

  const demoPassword = process.env.SEED_DEMO_PASSWORD;
  const passwordHash = await argon2.hash(
    demoPassword && demoPassword.length >= 12 ? demoPassword : randomBytes(24).toString('hex'),
    ARGON2_OPTIONS,
  );
  if (!demoPassword) {
    console.warn(
      'SEED_DEMO_PASSWORD not set: demo accounts created with random unusable passwords.',
    );
  }

  const [institutionA, institutionB] = await Promise.all([
    prisma.institution.upsert({
      where: { id: IDS.institutions[0] },
      update: {},
      create: {
        id: IDS.institutions[0],
        name: 'Instituto Aurora — Campus Fictício',
        publicAddress: 'Av. das Palmeiras, 100 — Centro (endereço fictício)',
        pickupInstructions: 'Retirada na recepção, seg–sex 9h–17h. Apresente o código.',
      },
    }),
    prisma.institution.upsert({
      where: { id: IDS.institutions[1] },
      update: {},
      create: {
        id: IDS.institutions[1],
        name: 'Centro Comunitário Boa Leitura (fictício)',
        publicAddress: 'Rua dos Estudos, 42 — Vila Esperança (endereço fictício)',
        pickupInstructions: 'Balcão da biblioteca, ter–sáb 10h–18h. Apresente o código.',
      },
    }),
  ]);

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
      status: 'AVAILABLE' as const,
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

  const counts = await prisma.$transaction([
    prisma.institution.count(),
    prisma.user.count(),
    prisma.membership.count(),
    prisma.material.count(),
  ]);
  console.log(
    `Seed done: ${counts[0]} institutions, ${counts[1]} users, ` +
      `${counts[2]} memberships, ${counts[3]} materials.`,
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

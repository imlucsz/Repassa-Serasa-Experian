# Data model (logical, Prisma implementation pending)
UUID PKs; timestamp UTC; snake_case DB via mapping if useful. No real user data in seed. Prisma migrations SQL source of truth, not `db push`.

| Entity | Essential fields / constraints |
|---|---|
| User | id, email normalized UNIQUE, displayName, passwordHash, role STUDENT/STAFF/ADMIN, isActive, createdAt, updatedAt |
| Institution | id, name, publicAddress, pickupInstructions, isActive; examples explicitly fictional |
| Membership | userId FK, institutionId FK, UNIQUE composite; STAFF only by server provisioning (enforce service) |
| Material | id, donorId FK, institutionId FK, title, description, category enum, condition enum, imageKey nullable, status enum, receivedAt, receivedBy nullable FK, rejectReason nullable, createdAt, updatedAt |
| Reservation | id, materialId FK, studentId FK, status enum, codeDigest UNIQUE, expiresAt, completedAt nullable, completedBy nullable FK, createdAt, updatedAt |
| RefreshSession | id, userId FK, familyId or stable session family, tokenHash unique, expiresAt, revokedAt, replacedBy nullable, createdAt; rotation + reuse detection |
| AuditEvent | id, actorId nullable for system, institutionId nullable, materialId/reservationId nullable, action, createdAt, safe metadata (no code or PII) |
| Upload (if needed) | id/key unique, ownerId, validated contentType/size, createdAt, consumedAt nullable; prevents attaching another user's image |

Indexes: Material(status,category,institutionId,createdAt), Material(donorId,createdAt), Material(institutionId,status), Reservation(studentId,createdAt), Reservation(status,expiresAt); partial unique active reservation per material SQL migration (`WHERE status='ACTIVE'` matching actual enum/storage). Check constraints where practical, timestamps/state transitions via domain service. Ensure expiry > createdAt. Restrict deletion for material/reservation history, soft-disabling institution/user. No public donor info. One physical unit per material; no quantity table now.

Transaction order: material row then reservation row, same in all mutation paths. Re-read state under lock; atomic updates and audit. Concurrent reserve/cancel/pickup/expire tests with PostgreSQL required. Migration must create partial unique index; Prisma schema cannot necessarily express every DB constraint, preserve custom SQL and test drift. Existing DB is unknown/no deployed schema confirmed. Rollforward migration strategy; backup shared environments, no destructive rollback automatically. Seed synthetic and idempotent with opt-in demo credentials env, roles and at least 2 institutions with separate staff, 2 students and mixed materials. No default passwords committed. No seed production.

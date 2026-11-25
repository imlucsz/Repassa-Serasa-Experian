# UX-05 — Administrative experience handoff

Branch `feat/UX-05-admin-experience` (base: UX-04 head `2e9192f`).
Consumes the DEV-06 admin contract from PR #21 (reviewed at `1cb095a`,
including atomic transitions, duplicate detection and rate limiting).

## Scope delivered

Routes (all ADMIN-guarded via `PrivateArea role="ADMIN"`):

- `/admin` — dashboard: pending approvals, active institutions, students,
  available materials, completed pickups + recent audit activity.
- `/admin/instituicoes` — list with q/status/isActive filters, pagination,
  inline approve / reject-with-reason on PENDING rows.
- `/admin/instituicoes/:id` — detail with lifecycle actions (approve,
  reject, suspend, reactivate), counters, member management
  (list / assign by user search / revoke).
- `/admin/usuarios` — list with q/role/isActive filters; STUDENT↔STAFF role
  toggle and activate/deactivate, all behind inline confirmation. ADMIN
  accounts and the signed-in admin are protected in the UI (server enforces
  the rest; ADMIN can never be granted through the UI).
- `/admin/materiais`, `/admin/reservas`, `/admin/auditoria` — read-only
  consultations with status/institution/actor filters and pagination.
  Reservation rows never display pickup codes.
- `/instituicoes/nova` — institution self-registration for any
  authenticated user (`POST /institutions`); success state explains the
  pending review; duplicate (409) shows a dedicated message.

Wiring: `safeReturnTo` whitelist, login fallback (ADMIN → `/admin`),
Shell account nav + PrivateArea admin tab strip. UX-04 routes/design
untouched.

## Contract notes honoured

- Lifecycle transitions are atomic on the server; losing concurrent
  transitions surface as 409 → "A situação deste registro mudou".
- `POST /institutions` duplicates (name+address, case-insensitive,
  non-REJECTED) → 409 with dedicated copy; per-user limit → 429 generic.
- Member assignment 409 cases (duplicate, ADMIN target, deactivated user,
  non-APPROVED institution) share one explicit sentence.
- Reject requires reason 3–240 chars (client-side + contract).
- Deactivation never strands in-flight reservations (display only).

## Verification

- `npm run lint` (tsc ×2): clean
- `npm run test:ci`: **40/40** (8 new `src/data/admin.test.ts` cases)
- `npm run build`: ok (admin routes lazy-chunked)
- `PLAYWRIGHT_CHANNEL=chrome npx playwright test`: **40/40**
  (7 new `admin.spec.mjs` cases on the intercepted API)
- Real-API validation against DEV-06 backend (`1cb095a`) on disposable
  embedded Postgres: **24/24 checks** — approval/rejection persisted,
  member assign promotes to STAFF and last revoke demotes to STUDENT,
  user role/activation persisted, pending/suspended institutions hidden
  from `GET /institutions`, duplicate registration blocked with 409,
  STUDENT and STAFF blocked on `/admin`, no pickup codes on admin views.

## Evidence

- `admin-dashboard-1440.png`, `admin-dashboard-390.png`
- `admin-instituicoes-1440.png`, `admin-instituicao-membros-1440.png`
- `admin-usuarios-1440.png`, `admin-materiais-1440.png`,
  `admin-reservas-1440.png`, `admin-auditoria-1440.png`
- `cadastro-instituicao-1440.png`, `admin-rbac-estudante-1440.png`

## Limitations / handoff notes for Astra refinement

- Empty metrics grid slot shows the hairline background on odd counts
  (visible on 390px dashboard shot) — cosmetic, left for final polish.
- Audit table shows truncated ids (first 8 chars) with full id in `title`.
- Institution select filters list the first 50 institutions only.
- Screen-reader pass still pending (announcements follow existing
  role=status/alert patterns).

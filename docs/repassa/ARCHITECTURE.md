'
# Architecture baseline (proposed implementation)
NestJS is owner-approved; rest of stack is working choice. React 19 + Vite + TS + Tailwind 4 + Motion + React Router, TanStack Query for server state, Zod optional for forms. Backend NestJS + Fastify + Prisma + PostgreSQL 16, JWT access and opaque refresh sessions, Argon2id, Supabase Storage for owned images, Swagger OpenAPI. Modular monolith; no Redis/microservices. Node 22 (>=22.12) and lockfile per project. Verify Nest/Fastify/Prisma major compatibility before pinning. No forced install or silent downgrade. Backend independent npm project.

```text
browser -> same-origin /api/v1 proxy -> NestJS/Fastify
                                             |-> PostgreSQL (Prisma)
                                             |-> Supabase Storage (server credential)
```
Production proposed Vercel frontend + Render API, same-origin `/api/v1` reverse proxy with cookie forwarding and no response caching; verify `Set-Cookie`, HTTPS, headers, route fallback order and public backend origin protection. Local Vite proxy `/api` -> localhost backend (default 3001); no cross-origin cookies needed. Browser calls relative URLs only. If infrastructure cannot support proxy, coordinate explicit alternative and CSRF/CORS tests before implementation. Keep env separation, test disposable DB and demo instance; no production without approval.

Frontend `src/pages`, `src/components/{ui,layout,shelf}`, `src/features`, `src/services`, `src/routes`, `src/styles`. Preserve current files through scoped extraction; exact names flexible with ownership. Root tsconfig include app sources and Vite config only; backend/video use their own configs. Do not silently edit video.
Backend modules auth/users/institutions/materials/reservations/pickups/storage (donation and inventory are material routes/services; avoid duplicate entities). `backend/prisma/{schema.prisma,migrations,seed.ts}`, `backend/src/common`, `backend/test`, `.env.example` with safe placeholders, Dockerfile optional. DTOs class-validator or equivalent strict runtime validation. Prisma service inject, services testable, transactional domain logic not controllers. Use parameterized queries if raw SQL needed. Include `/api/v1/health` readiness (minimal DB connectivity; no secret/host details). Swagger route optional local/demo, no secret data.

Contract: `contracts/openapi.yaml` baseline; shared typed service and runtime validation. Backend generates Swagger spec and compare behavior/endpoints/schema; if changes needed, separate contract PR before consumers. API errors stable. Frontend fixtures implement same schemas, explicit `VITE_DEMO_MODE` exclusively for offline dev. Live demo uses actual API, never automatic fallback. Release only when integrated end-to-end proof. Keep root video build isolated.

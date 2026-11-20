# Decisions and open questions

## Confirmed by owner/conversation
- NestJS backend, preserve React/Vite app and approved shelf concept, use Codex for UX and Devin for backend.
- Deadline 12/12/2026; scope-first implementation. Donation via institutional points with physical receipt before availability; reserve and pick up using code. Same student can donate/receive. No confirmed real institution partners. Existing promotional video protected.
- Autonomous routine Git work; guardrails intended to prevent mistakes. Main via PR with review/checks is proposed operational policy, not an already configured GitHub rule.

## Proposed working defaults (v0.1; accept/change in SH-01)
- Fastify, Prisma, PostgreSQL 16, Nest modular monolith, Argon2id/JWT+rotating refresh, same-origin proxy, Supabase Storage; Vercel/Render demo, avoid paid services until approved.
- Public browse, student self-registration, staff seeded/provisioned, one physical unit per material, no reservation of own donation, 72h TTL, single-use code, consent notice, photo upload optional API with final UX photo strongly encouraged. Confirm whether photo mandatory for final MVP. No real email verification/reset for isolated demo; mandatory for real onboarding.
- Student role enum STUDENT/STAFF/ADMIN; admin UI after MVP, institution membership many-to-many. Demo-only synthetic accounts, no real institution data. User profile edits displayName only.
- Categories/conditions per contract, no chat, favorites, notifications or real-time in P0; use list refetch/poll only if needed. CI protects main after initial workflow verified.

## Open (not blockers for foundation; decide before related implementation)
Actual institution partnerships, pickup hours/locations/terms, retention/privacy and production onboarding; storage account and deploy budget; final images/logo sources/license; whether all team members require staff or admin access; owner approval of thresholds/expiry, photo policy and deployment URLs. Confirm baseline Node/Nest/Prisma compatibility and CI results. No API key needed for foundation. Log new decisions as date, owner/PR, rationale, changes and rollback; never treat assumptions as verified facts.

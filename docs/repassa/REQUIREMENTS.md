# Requirements

| ID | Requirement | Priority / acceptance |
|---|---|---|
| RF01 | Public landing and how it works | P0, links to donate/explore and adapts mobile |
| RF02 | Register, login, logout, refresh, session status | P0 student only at signup; errors safe; no role injection |
| RF03 | Browse available material, text/category/institution filters, page | P0 public; grid and shelf share data; empty states |
| RF04 | Material detail | P0 available title/photo/condition/location; reserve via authenticated flow |
| RF05 | Submit single material donation with photo and institution | P0 pending receipt, ownership recorded; validation |
| RF06 | My donations/history, cancel pending only | P0 only owner; reason/state shown |
| RF07 | Staff receipt and reject | P0 staff membership checked; only pending; reason for rejection |
| RF08 | Staff stock and dashboard | P0 scoped; counts reflect DB, list filters |
| RF09 | Reserve available material | P0 single winner under concurrent requests; cannot reserve own donation |
| RF10 | My reservations and cancel | P0 owner; current code/expiry only for own active reservation |
| RF11 | Staff verify and confirm pickup | P0 one transaction; no cross-institution or expiry; one-use |
| RF12 | Student profile | P0 view/edit display name only; account email immutable for demo |
| RF13 | Expire pending reservations | P0 inline in critical transactions and scheduled/periodic cleanup; no stale availability in catalog |
| RF14 | Password reset/email verification | P1 prototype, production prerequisite |
| RF15 | Admin UI, favorites, notifications, impact reports | P1 after validated core |

## Nonfunctional
RNF01: authoritative server-side validation and tenant authorization; OWASP-style threat tests. RNF02: transactional consistency, migrations, seed idempotence and backup/rollback notes. RNF03: WCAG 2.2 AA target, keyboard/focus/contrast/reduced motion; no claim of certification without audit. RNF04: responsive 390/768/1440px review; no global scroll/cursor lock. RNF05: bounded pagination (default 20, max 50), indexes for filters, no N+1; performance budgets proposed in design doc. RNF06: testable typed contracts; error format invariant; no silent mock fallback. RNF07: secrets never in repo/client; data minimization, demo privacy. RNF08: CI typecheck/build/tests, production health check, explicit env separation. RNF09: logs request ID but no passwords, tokens, raw pickup codes or student PII. RNF10: no external service or dependency cost without authorization; licensed/owned assets only.

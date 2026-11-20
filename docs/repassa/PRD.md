# PRD — RePassa v0.1

## Vision
Conhecimento merece circular. Reduce barriers to education and waste by putting used educational material back into circulation for free. Align with ODS 4 (education), 10 (inequality reduction), 12 (responsible consumption). Academic Projeto Integrador Transforme-se (Serasa Experian / Instituto PROA). Demo 12/12/2026. No claims of measured impact before evidence.

## Users and value
- Visitor: understand service, browse availability without providing personal data, create account for transactions.
- Student: a single account can both donate and reserve, track state and see pickup code. No separate donor/recipient roles.
- Institution staff: assigned to one or more explicitly authorized partner institutions; receive and stock items, verify pickup; only access own institution. Staff accounts provisioned through controlled seed/owner operation in MVP, not public registration.
- Platform admin: administrative role provisioned out of band; dashboard/user-management UI post-MVP. No automatic global access to sensitive data; use only approved operational actions.

## Core journey
Student A registers material with photo/category/condition/pickup point → pending receipt → brings it to institution → staff confirms physical arrival → item appears AVAILABLE in catalog → Student B reserves (one unit) → obtains code and deadline → staff verifies code in correct institution → DELIVERED and history persists. Cancel/expiry returns to availability. See rules for transitions. Public browse exposes availability and fictional pickup location, not donor identity.

## Scope and priorities
P0: responsive landing page, login/register, public catalog with shelf and grid/search, material detail, donor form and history, reservation and code, student profile, staff dashboard/receipt/stock/pickup, real auth + DB + API + demo deploy. Include user feedback for error/loading/empty, accessibility, tests and seed. Recovery, favorites, push notifications, admin UI, gamification, chat, AI recommendations, payments, shipping and multi-unit donations are out of P0. How-it-works can be landing section. Password reset is required before any real public onboarding, but may be excluded from isolated academic demo (no real user data).

## Product success / demo acceptance
A complete cross-role journey with persisted data survives reload and shows inventory change. In concurrent reservation only one succeeds; code cannot be replayed; staff cannot act on another institution. Mobile and keyboard users can finish both student workflows. Visual identity is recognizable, shelf behavior preserved, no mock presented as live. Video is complementary proof of concept, not evidence of working backend. Metrics show counts from actual demo seed, labeled demo; no fabricated adoption.

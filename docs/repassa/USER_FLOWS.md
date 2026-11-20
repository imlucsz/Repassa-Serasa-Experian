# User flows

## F01 Donation
Home → Doar → sign in/register if anonymous → return to form → choose institution, title, description, category, condition, image → submit → pending receipt with location → staff receives physically → available → student's history updates on refetch. If user cancels pending, terminal cancellation; if staff rejects, reason visible; if upload fails, retain form and allow retry. No direct exchange.

## F02 Reserve and collect
Home → catalog → filter/grid/shelf → details → reserve requires login → server atomically reserves → own history shows expiry and code → student physically presents code → staff at assigned institution confirms pickup → completed/DELIVERED → item disappears from available catalog. If conflict: explain unavailable, refetch; if cancel/expiry: code loses validity, stock available. Wrong code/wrong institution returns generic failure, no PII. Explicit confirm before final pickup.

## F03 Staff
Login → select authorized institution → dashboard → pending receipts → physically check material → receive/reject → stock view → pickup screen → enter code → confirm handoff → receipt of action. Scope is server enforced; selector is only UX. Invalid/canceled/expired/reused code cannot complete. Dashboard counters derived from database.

## F04 Sessions
Login valid → access token in memory, refresh HttpOnly cookie → reload calls refresh → role-gated app route. On expired/invalid access, one synchronized refresh attempt; on failure clear state and redirect; no infinite retry. Logout revokes refresh session and clears browser state. Staff account changes/blocked status respected by backend.

## F05 Demo boundaries
Use fictional locations, seed users and owned assets. Public visitors see only available items and public institution data. No production registration invitation until verification, reset, privacy terms, support and real partner arrangements are implemented. Test offline/error conditions rather than silently switching mock data.

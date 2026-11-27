# UX-06.1 · Catalog integration & QA review (Devin)

**Under review:** `feat/UX-06-1-catalog-preview` @ `796448b` — Codex implementation of Direction B (Warm Interactive Editorial) for the catalog, scoped to `src/pages/Catalog.tsx` + `src/pages/collection.css`.
**Base for comparison:** `468f6a8` (main, post PR #29 / PERF-01).
**Reviewer:** Devin — technical validation and integration readiness only; no redesign.
**Environment:** Windows 11, Node v24.14.0, npm 11.9.0, Playwright 1.65.1 (bundled Chromium 1255), `npm ci` clean install. No Docker/PostgreSQL on this machine — backend-level checks not applicable (no backend changes in scope).
**Date:** 2026-11-27.

## Executive summary — GO with two documented items

The implementation meets its stated goals for typical catalog records and is safe to integrate once the owner approves. Two items are documented below: one **pre-existing defect** on `main` (not caused by this change) and one **edge-case limitation** of the new layout with very long material titles.

## Exact test results

| Command | Result |
| --- | --- |
| `npm ci` | clean install, exit 0 |
| `npm run lint` (tsc, both configs) | pass, exit 0 |
| `npm run test:ci` (`tsx --test src/**/*.test.ts`) | **41/41 pass**, 0 fail/skip (635 ms) |
| `npm run build` (vite) | pass, built in 328 ms |
| `npx playwright test --project=demo` (mock data, bundled Chromium) | **8/9 pass, 1 fail** — see Finding 1 |
| `npx playwright test --project=api` (intercepted `/api/v1`, all suites incl. auth, reservations, pickups, admin, a11y) | **52/52 pass** |
| Custom QA harness (synthetic API fixture, route interception) | **34/34 checks pass** |
| PERF-01 rAF probe (custom instrumentation, feature + base) | pass — see Performance |

**Skipped/not executed:** backend test suites and disposable-Postgres checks (no backend changes; Docker unavailable on this machine). Real device testing (no physical device); mobile results come from Playwright emulation. Screen-reader verification is limited to axe-core, the Chromium accessibility tree (`ariaSnapshot`), and markup review — no NVDA/JAWS pass was possible.

## Finding 1 — pre-existing defect (present on `main`, NOT a UX-06.1 regression)

`demo.spec.mjs › mobile shelf gestures › drag across the loop seam, then tap the selected book to open it` fails identically on `796448b` (3/3 runs) and on base `468f6a8` (1/1 + hit-map identical: **2/209** sampled points on the active cover are hit-testable at 440 px width). The drag itself works; the tap on the front cover lands on `.book-stage`, so no `click` reaches `.shelf-book` and navigation never happens.

- Root cause: a Chromium hit-testing quirk in the 3D shelf at narrow widths — the active `.book-face` (front cover, `ry ≈ -90°` under `preserve-3d` + `perspective`) is painted but almost none of its area accepts pointer events. Confirmed with `elementFromPoint` hit-maps on both commits; **unaffected on desktop** (1440 px map shows the cover fully clickable).
- User impact: on phones ≤ ~450 px using shelf view, tapping the selected cover does nothing. Mitigations already present: the **"Ver material" link, prev/next buttons and keyboard navigation all work**, and grid view is the mobile default anyway.
- Recommendation: **follow-up for Codex**, not a blocker for UX-06.1. The fix belongs in `Shelf3D.tsx`/`shelf.css`, which the PERF-01 boundary explicitly protects; options include a `pointer-events` pass-through layer or an invisible click target aligned to the active book.

## Finding 2 — edge-case limitation of the new side panel (long titles)

With a realistic 107-character title ("Botânica ilustrada do cerrado brasileiro: guia de campo…") at 1440×900:

- `.shelf-caption h2` at `clamp(2.25rem, 3.5vw, 4rem)` wraps to ~9 lines in the ~345 px column → caption ~757 px tall → **"Ver material" + prev/next sit at y≈1136, below the fold** ([evidence](api-shelf-1440-long-title.png)).
- This re-opens the audit's own acceptance criterion ("selected title, detail link and previous/next controls visible together") for long titles only. For the demo data (≤ ~25 chars) and typical titles it holds ([evidence](catalog-1440-shelf.png)).
- **Not a regression vs base**: on `468f6a8` the same controls sit at y≈950+ for *every* title. The new layout is strictly better or equal.
- It is, however, a gap vs the change's stated goal for long records, and any fix (line-clamp, smaller cap, internal scroll, reordered actions) alters the owner-approved direction — **flagged for owner decision rather than changed unilaterally**.

## Animated bookshelf validation

| Check | Result | Evidence |
| --- | --- | --- |
| Touch dragging | pass — CDP touch drag moves selection across items (`demo` project + manual probe) | demo test |
| Horizontal mouse wheel | pass — `mouse.wheel` advances selection | demo test |
| Loop seam continuity | pass — wrap verified both directions, single `material-cover` name maintained | demo test (`reduced motion wraps both ways…`) |
| Keyboard navigation | pass — ArrowLeft/Right on focused region; full tab order verified: skip-link → nav → 5 category tabs → search → institution → Filtrar → Estante/Grade → shelf region → Ver material → prev → next → pager; 21/21 stops show the 3 px emerald outline | custom harness |
| Focus restoration | pass — filter submit moves focus to the `role=status` result count (verified); returning from detail restores the previously active shelf material and preserves view/filters | custom + demo tests |
| PERF-01 idle rendering | pass — see Performance | rAF probe |
| Tap-to-open on narrow shelf | **fail — pre-existing (Finding 1)** | hit-map |

## Realistic catalog records (synthetic 45-item fixture via `/api/v1` interception)

| Check | Result |
| --- | --- |
| Photo-backed materials (grid jackets + shelf spine photos) | pass — `jacket-photo` and `has-photo .spine-photo` render |
| Missing/broken photos | pass — `onError` hides the img, jacket art fallback shows |
| Long material titles | pass — grid rows and mobile list wrap cleanly, no overflow |
| Long institution names (95-char) | pass — wraps to 3 lines, no overflow |
| Different categories (BOOK/NOTEBOOK/SUPPLIES + Outros tab) | pass — correct jacket art and labels per category |
| Empty catalog | pass — `StatePanel` empty state + "Limpar filtros" recovery |
| Populated catalog | pass — 45 items across 3 pages |

## API integration

| Check | Result |
| --- | --- |
| Paginated results | pass — pager appears >1 page; page 2/3 navigate; "Próxima" disabled on last page; `?page=` URL param correct |
| Search filter | pass — `q=atlas` → 5/45 results |
| Institution filter | pass — narrows correctly (0-result combination shows empty state) |
| Filter focus | pass — result count `role=status` receives focus after submit |
| Loading state | pass — "Consultando o acervo…" visible during delayed response |
| Error recovery | pass — 503 → error panel + "Tentar novamente" → recovers populated catalog |
| Detail → back | pass — grid view, scroll/params and shelf selection preserved; `catalogSearch` state round-trips |
| Contract validation | pass — fixtures conform to `parseMaterial`/`parsePage` (UUID, enums, `imageUrl` pattern) |

## Accessibility & responsive

| Check | Result |
| --- | --- |
| axe wcag2a/aa/21a/21aa at 390/768/1440 on 5 public routes | pass — 0 violations (demo project) |
| Zoom 100% | pass — no overflow; title+controls in viewport |
| Zoom 125% | pass — no overflow; caption title visible (y 675–806); actions ~70–140 px below fold, reachable by scroll/keyboard ([shot](zoom-125-shelf.png)) |
| Zoom 200% | pass — no overflow; content reflows below fold; all controls focusable (better than base, where the caption is always below the stage) |
| Keyboard traversal | pass — see bookshelf table |
| Screen-reader surface | pass — `aria-live` caption announces index + category + title; named `Ver material: <title>` link; named prev/next buttons; `ariaSnapshot` tree is clean |
| Reduced motion | pass — grid is default; shelf opt-in keeps explicit controls; transitions/animations disabled per CSS + demo tests |
| Horizontal overflow | pass — 390/768/1440 and zoom 100/125/200, demo + synthetic fixtures |
| Mobile first-viewport goal | pass — first result title at y=595, institution at y=761 within the 844 px viewport ([shot](api-mobile-390.png)) |

## Performance

- **PERF-01 intact.** `Shelf3D.tsx`, `shelf.css`, `shelfMath.ts` untouched (diff-verified). rAF instrumentation: **0 frames over 3 s idle** on both commits; ~40 frames scheduled per interaction; re-settles to 0. Identical behavior on feature and base.
- **No new continuous rendering.** The layout change adds no listeners, observers, animations or `will-change`/layer promotion. `ResizeObserver` still schedules a single settle frame.
- **No new dependencies.** `package.json`/`package-lock.json` untouched by the branch.

## Selected-material info panel — opportunity assessment

The caption panel currently shows `NN / NN · Category`, the title, "Ver material ↗", and prev/next. Two useful fields exist in `Material` that are **not** shown here: `institution.name` and `status`.

- **Pickup institution: worth adding.** It is already displayed on grid cards (`MapPin` + name) and is the second most important fact after availability; adding a one-line `Retirada: <institution>` (or `<MapPin>` + name) to `.shelf-caption-text` uses only existing data and matches the "library record" direction.
- **Availability: limited value in this view.** The public contract only returns `status: 'AVAILABLE'` items, so a badge would always read the same; it adds noise unless detail-level states (e.g., reserved-by-you) are later surfaced.
- Suggestion for the owner/Codex: a compact location line beneath the index or title, styled like `.location` in grid cards. **Not implemented** — design addition pending approval, and it interacts with Finding 2's vertical budget.

## Files changed by this review branch

- `docs/repassa/evidence/ux-06-1/QA-REPORT.md` (this report)
- `docs/repassa/evidence/ux-06-1/*.png` (8 screenshots: before/after comparison via base shots + synthetic-record evidence)

No source, test, config, dependency or contract changes. Implementation files under review remain exactly as Codex committed them (`796448b`).

## Before/after comparison

| View | Before (`468f6a8`) | After (`796448b`) |
| --- | --- | --- |
| Desktop catalog | full-width header, pill categories, caption+controls below stage (y≈950+) | two-column header, underline tabs, caption panel beside stage — title/link/buttons in viewport ([shot](catalog-1440-shelf.png)) |
| Mobile catalog | cover card grid, first title below fold (~y936) | compact list rows: cover + meta + title + institution; first result name and institution in initial viewport |
| Mobile shelf tap | cover tap navigates (intended) | identical — but **both broken** (Finding 1, pre-existing) |

## GO / NO-GO

**GO** for integration of `796448b`, conditional on the owner's visual approval (desktop approved; mobile pending per task brief). Recommend tracking as follow-ups:

1. **P1 — tap-to-open on narrow shelf viewports** (pre-existing on `main`; Codex + PERF-01 scope).
2. **P2 — long-title caption growth** (Finding 2; needs a design decision on truncation vs. scale).
3. **P3 (optional) — institution line in the shelf caption** (opportunity noted above).

## Remaining limitations of this review

- Chromium 1255 only; no Firefox/WebKit pass.
- Emulated touch/mobile; no physical-device verification.
- Zoom approximated via CSS `zoom` on `documentElement` (not OS/browser zoom UI); behavior matched expectations at 100/125/200%.
- No NVDA/JAWS/VoiceOver run; screen-reader assessment relies on axe + accessibility tree.
- API integration validated against an intercepted contract-conformant stub, not a live backend (no Postgres on this machine). Response-shape, state and retry behavior were verified; real-server latency/headers were not.

# UX-06.1 · Catalog integration & QA review (Devin)

**Under review:** `feat/UX-06-1-catalog-preview` @ `796448b` — Codex implementation of Direction B (Warm Interactive Editorial) for the catalog, scoped to `src/pages/Catalog.tsx` + `src/pages/collection.css`.
**Closure pass (UX-06.1b):** owner-authorized bounded fixes on `feat/DEV-UX-06-1-qa` — mobile shelf tap-to-open, long-title caption bounds and the pickup-institution line. See **Closure pass results** below.
**Base for comparison:** `468f6a8` (main, post PR #29 / PERF-01).
**Reviewer:** Devin — technical validation and integration readiness only; no redesign.
**Environment:** Windows 11, Node v24.14.0, npm 11.9.0, Playwright 1.65.1 (bundled Chromium 1255), `npm ci` clean install. No Docker/PostgreSQL on this machine — backend-level checks not applicable (no backend changes in scope).
**Date:** 2026-11-27 (initial QA); closure pass on the same day.

## Executive summary — GO

The implementation meets its stated goals and is safe to integrate once the owner approves. The two items documented in the first pass — a **pre-existing** narrow-viewport hit-testing defect and a **long-title caption growth** edge case — were both **resolved in the closure pass** under the owner's bounded authorization, plus the pickup-institution line was added to the selected-material panel. All suites pass (demo 9/9, api 52/52, unit 41/41); PERF-01 remains at zero idle rAF frames.

**Missing-file reconciliation:** the UX-06.1 brief instructs reading "DEVIN-HANDOFF.md". No such file exists in the repository (searched all docs at `796448b` and on this branch). The closest existing documents were used instead: `docs/repassa/evidence/ux-06/HANDOFF.md` (the actual UX-06 audit with the acceptance criteria this report validates against), `docs/repassa/agent-prompts/DEVIN-START.md`, `docs/repassa/agent-prompts/DEVIN-ECC-HANDOFF.md` and `docs/repassa/agent-prompts/HANDOFF.md`. The reference is presumed to have meant the UX-06 audit handoff; no file was fabricated.

## Exact test results

### Initial QA pass (`796448b`, review-only)

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

### Closure pass results (`feat/DEV-UX-06-1-qa`, after authorized fixes)

| Command | Result |
| --- | --- |
| `npm run lint` | pass, exit 0 |
| `npm run test:ci` | **41/41 pass**, 0 fail/skip |
| `npm run build` | pass |
| `npx playwright test --project=demo` | **9/9 pass** — the previously failing `mobile shelf gestures › drag across the loop seam, then tap the selected book to open it` now passes |
| `npx playwright test --project=api` | **52/52 pass** |
| Caption metrics probe (107-char title + 95-char institution, intercepted `/api/v1`) | pass — caption bounded, controls in viewport, institution rendered |
| PERF-01 rAF probe (after fixes) | pass — 0 idle frames, ~47 per interaction, re-settles to 0 |

**Skipped/not executed:** backend test suites and disposable-Postgres checks (no backend changes; Docker unavailable on this machine). Real device testing (no physical device); mobile results come from Playwright emulation. Screen-reader verification is limited to axe-core, the Chromium accessibility tree (`ariaSnapshot`), and markup review — no NVDA/JAWS pass was possible.

## Finding 1 — pre-existing defect (present on `main`, NOT a UX-06.1 regression) — **FIXED in closure pass**

`demo.spec.mjs › mobile shelf gestures › drag across the loop seam, then tap the selected book to open it` failed identically on `796448b` (3/3 runs) and on base `468f6a8` (1/1 + hit-map identical: **2/209** sampled points on the active cover are hit-testable at 440 px width). The drag worked; the tap on the front cover landed on `.book-stage`, so no `click` reached `.shelf-book` and navigation never happened.

- Root cause: a Chromium hit-testing quirk in the 3D shelf at narrow widths — the active `.book-face` (front cover, `ry ≈ -90°` under `preserve-3d` + `perspective`) is painted but almost none of its area accepts pointer events. Confirmed with `elementFromPoint` hit-maps on both commits; **unaffected on desktop** (1440 px map shows the cover fully clickable). A second, compounding behavior was found during the fix: **after a drag gesture, Chromium synthesizes no `click` event for the next synthetic touch tap at all** (only `pointerdown`/`pointerup` fire), so no click-based handler could rescue the tap.
- Fix applied (`Shelf3D.tsx`, PERF-01-protected — explicitly authorized): touch/pen activation is now resolved on **`pointerup`** on `.book-stage` — the intended book is derived from the event target's `.closest('.shelf-book')`, falling back to the **active cover's projected quad** (`getBoundingClientRect()`) when the point misses every book. Mouse activation is unchanged (still resolves on `click`), and the existing `suppressClick` drag guard plus a duplicate-tap filter prevent double navigation and accidental navigation during drags. The one-off rect read happens only inside event handlers — **zero per-frame cost**; no transform, stacking, shading or scheduling code was touched.
- Verified: the failing test now passes (9/9 demo); drag, seam wrap, wheel and keyboard paths unchanged; PERF-01 idle rAF still 0. `preserve-3d`, `backface-visibility` and the painted result were left untouched — alternatives (flattening the stack, toggling backface visibility) were tested and rejected because they either destroyed the visual or did not restore hit-testing.

## Finding 2 — edge-case limitation of the new side panel (long titles) — **FIXED in closure pass**

With a realistic 107-character title ("Botânica ilustrada do cerrado brasileiro: guia de campo…") at 1440×900, the unclamped `.shelf-caption h2` at `clamp(2.25rem, 3.5vw, 4rem)` wrapped to ~9 lines in the ~345 px column → caption ~757 px tall → **"Ver material" + prev/next sat at y≈1136, below the fold** ([before](api-shelf-1440-long-title.png)).

- Fix applied (`collection.css`, ≥1000 px shelf layout only): the caption title is now `-webkit-line-clamp: 4` with `display: -webkit-box` — bounded typography that preserves the editorial serif/size and clamps with a native ellipsis. The full title remains in the DOM (aria-live announces it complete), is exposed via a native `title` tooltip, and the "Ver material" link + detail page carry it untruncated. Below 1000 px (tablet/mobile) the caption is unconstrained so content reflows naturally.
- Verified against the 107-char fixture + 95-char institution at 1440×900: the h2 shrinks from **472 px unclamped to 210 px**; "Ver material" + prev/next now sit at **y 843–887, inside the 900 px viewport**; the institution line renders fully; no horizontal overflow at 1440 or 390 ([after](catalog-1440-long-title-fixed.png), [mobile](catalog-390-long-title.png)).

## Animated bookshelf validation

| Check | Result | Evidence |
| --- | --- | --- |
| Touch dragging | pass — CDP touch drag moves selection across items (`demo` project + manual probe) | demo test |
| Horizontal mouse wheel | pass — `mouse.wheel` advances selection | demo test |
| Loop seam continuity | pass — wrap verified both directions, single `material-cover` name maintained | demo test (`reduced motion wraps both ways…`) |
| Keyboard navigation | pass — ArrowLeft/Right on focused region; full tab order verified: skip-link → nav → 5 category tabs → search → institution → Filtrar → Estante/Grade → shelf region → Ver material → prev → next → pager; 21/21 stops show the 3 px emerald outline | custom harness |
| Focus restoration | pass — filter submit moves focus to the `role=status` result count (verified); returning from detail restores the previously active shelf material and preserves view/filters | custom + demo tests |
| PERF-01 idle rendering | pass — see Performance | rAF probe |
| Tap-to-open on narrow shelf | **pass — fixed in closure pass (Finding 1)** | demo test 9/9 |

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
| Screen-reader surface | pass — `aria-live` caption announces index + category + full title + institution; named `Ver material: <title>` link; named prev/next buttons; `ariaSnapshot` tree is clean |
| Reduced motion | pass — grid is default; shelf opt-in keeps explicit controls; transitions/animations disabled per CSS + demo tests |
| Horizontal overflow | pass — 390/768/1440 and zoom 100/125/200, demo + synthetic fixtures |
| Mobile first-viewport goal | pass — first result title at y=595, institution at y=761 within the 844 px viewport ([shot](api-mobile-390.png)) |

## Performance

- **PERF-01 intact.** The renderer's transform, stacking, shading and frame-scheduling code in `Shelf3D.tsx`, `shelf.css`, `shelfMath.ts` was verified untouched at `796448b`; the closure pass added only event-handler logic (a `getBoundingClientRect()` read inside `pointerup`/`click` handlers — no per-frame work, no new listeners). rAF instrumentation after the fixes: **0 frames over 3 s idle**, ~47 frames per interaction, re-settles to 0 — identical to both prior commits.
- **No new continuous rendering.** The layout change adds no observers, animations or `will-change`/layer promotion. `ResizeObserver` still schedules a single settle frame.
- **No new dependencies.** `package.json`/`package-lock.json` untouched by the branch.

## Selected-material info panel — institution added in closure pass

The caption panel previously showed `NN / NN · Category`, the title, "Ver material ↗", and prev/next. The first pass flagged `institution.name` as a worthwhile addition and `status` as low-value.

- **Pickup institution: implemented** — `.shelf-caption-text` now renders `<MapPin size={14}>` + `material.institution.name` on a `.location` line directly beneath the title, reusing the existing grid-card location styling pattern. It wraps cleanly for long names (verified with a 95-char institution on desktop and mobile) and uses only existing data — no API or contract change ([shot](catalog-1440-caption-institution.png)).
- **Availability: intentionally not added.** The public contract only returns `status: 'AVAILABLE'` items, so a badge would always read the same; the authorized scope also explicitly excluded a redundant badge.

## Files changed by this review branch

### Source (closure pass — owner-authorized bounded fixes)

- `src/components/Shelf3D.tsx` — pointerup-based touch/pen activation on `.book-stage` with active-cover quad fallback; duplicate-tap and drag guards; pickup-institution line (`MapPin` + `institution.name`) in the caption; `title` attribute on the caption heading. No changes to transforms, stacking, shading, scheduling or listeners that run per frame.
- `src/pages/collection.css` — `.shelf-caption h2` 4-line clamp inside the existing ≥1000 px shelf layout; `.shelf-caption .location` styling.

### Evidence

- `docs/repassa/evidence/ux-06-1/QA-REPORT.md` (this report)
- `docs/repassa/evidence/ux-06-1/*.png` (11 screenshots: before/after comparison via base shots + synthetic-record evidence)

No test, config, dependency, contract or backend changes. `Shelf3D.tsx` is PERF-01-protected and was modified only within the explicitly authorized defect scope.

## Before/after comparison

| View | Before (`468f6a8`) | After (`796448b`) |
| --- | --- | --- |
| Desktop catalog | full-width header, pill categories, caption+controls below stage (y≈950+) | two-column header, underline tabs, caption panel beside stage — title/link/buttons in viewport ([shot](catalog-1440-shelf.png)) |
| Mobile catalog | cover card grid, first title below fold (~y936) | compact list rows: cover + meta + title + institution; first result name and institution in initial viewport |
| Mobile shelf tap | cover tap navigates (intended) | broken on base AND `796448b`; **fixed in closure pass** — touch tap selects/opens correctly |
| Shelf caption | title/index/actions only | adds institution line; title bounded to 4 lines on desktop |

## GO / NO-GO

**GO** for integration of `796448b` plus the closure-pass fixes on this branch, conditional on the owner's visual approval (desktop approved; mobile pending per task brief). All three authorized items are delivered:

1. **P1 — tap-to-open on narrow shelf viewports** — fixed and test-verified (Finding 1).
2. **P2 — long-title caption growth** — bounded via 4-line clamp; controls stay in the 1440×900 viewport (Finding 2).
3. **P3 — pickup institution in the shelf caption** — implemented from existing data (info panel section).

## Remaining limitations of this review

- Chromium 1255 only; no Firefox/WebKit pass.
- Emulated touch/mobile; no physical-device verification.
- Zoom approximated via CSS `zoom` on `documentElement` (not OS/browser zoom UI); behavior matched expectations at 100/125/200%.
- No NVDA/JAWS/VoiceOver run; screen-reader assessment relies on axe + accessibility tree.
- API integration validated against an intercepted contract-conformant stub, not a live backend (no Postgres on this machine). Response-shape, state and retry behavior were verified; real-server latency/headers were not.

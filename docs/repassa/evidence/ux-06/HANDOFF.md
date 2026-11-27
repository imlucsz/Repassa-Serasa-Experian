# UX-06 · Visual audit and approval handoff

**Recommendation for the owner — B, Warm Interactive Editorial.** Keep the illustrated landing page as the invitation. When someone enters the catalog, give the material name, availability and pickup location the prominence of a library record. Reserve cinematic pacing for the existing landing artwork. A second animated introduction would delay the student’s first useful choice.

## Baseline and evidence

Main at `468f6a8`, fetched November 27, 2026. PR #24 delivered the SH-03 admin hierarchy and inline confirmations. PR #28 added material photos to shelf spines and staff review. PR #29 isolated shelf shading updates. The current frontend uses locally hosted Newsreader and DM Sans with forest, ivory, emerald and coral. The responsive collage, shelf/grid switch, cover-to-detail transition and reservation history already exist.

Chrome captures at 1440×900 and 390×844, at default zoom and normal motion. Coordinates below are CSS pixels from the top of the initial document. Each screen was captured once per width. No page-level horizontal overflow was observed in these eight samples.

| Screen and state | Desktop | Mobile |
| --- | --- | --- |
| Landing · anonymous, live public site | [Full page](home-1440.jpg) | [Full page](home-390.jpg) |
| Catalog · main, explicit local demo, desktop shelf and default mobile grid | [Shelf](catalog-1440.jpg) | [Grid](catalog-390.jpg) |
| Material detail · same demo material, “Botânica ilustrada” | [Detail](detail-1440.jpg) | [Detail](detail-390.jpg) |
| My reservations · main, intercepted local API, synthetic student with empty history | [Empty history](history-1440.jpg) | [Empty history](history-390.jpg) |

The hosted revision was not established. Local demo captures show fallback cover art and the demo reservation message. Photo-backed records and successful transactions are outside this visual sample.

## What to improve

| Priority | Observed today | Proposed change and acceptance |
| --- | --- | --- |
| 1 · Mobile discovery | On the catalog, categories take two rows. Filters start at y=379, view controls at 577, the first cover at 641 and its listing title at 936. The artwork sometimes contains a title, but an uploaded photo need not. | Give each mobile result a compact cover beside its existing title and institution. Keep search directly available. At 390×844 the first actual result name and pickup institution should both be readable before scrolling, including with a photo or a long title. |
| 2 · Desktop shelf | The stage begins at y=553 and the caption, detail link and arrow buttons start at 951. The featured object appears before the controls that identify and open it. | Reclaim space in the catalog header and group the existing caption and actions beside the stage or immediately above it. At 1440×900 the selected title, detail link and previous/next controls should be visible together. Keep their keyboard order meaningful. |
| 3 · Material detail | Desktop balances the cover and title side by side. On mobile the board starts at y=169, title at 638, pickup section at 903 and reservation area at 1079. | Keep the desktop spread. On mobile, lead with title and availability, then a smaller cover and the pickup institution. Aim to show the institution in the first viewport. Keep address, instructions and the existing reservation action together in reading order. |
| 4 · First reservation | The empty-history header tells a first-time student to present a pickup code. “Explorar o acervo” sits above a dividing rule, separated from the explanation that they have no reservations. | For a confirmed empty result, place the existing catalog link beside the empty message and explain what will appear after the first reservation. Keep the current deadline/code guidance for a populated history. Keep loading and failures distinct from an empty result. |
| 5 · Landing story | The responsive collage and two entry actions are already strong. On mobile the process section begins at y=861, with the actual steps at 1213. The introduction repeats the reuse premise before explaining who receives the material. | Tighten the process introduction. Lead with physical handoff to an institution and retain the ordered three steps. Use the existing coral rule as a one-time reading cue at section entry. The complete sequence must remain legible with animation off or scripting delayed. |

## Implementation order if approved

1. **Catalog first · moderate.** Prepare one isolated catalog preview using the existing grid, shelf and controls. Touch only `src/pages/Catalog.tsx` and `src/pages/collection.css` initially. Use catalog-scoped spacing and list layout. Compare the two viewport acceptance criteria above, including a photo-backed fixture, fallback cover, long title, keyboard navigation and reduced motion.
2. **Detail and empty history · low to moderate.** After catalog sign-off, carry its hierarchy into `src/pages/Detail.tsx` and the same collection stylesheet. Adjust conditional copy and link placement in `src/pages/Reservations.tsx`. Add a scoped rule to `src/pages/reservations.css` only if existing spacing is insufficient. Retain focus transfer after confirmation and the exact availability, expiry and code visibility rules.
3. **Landing narrative · low.** Limit changes to `src/pages/Home.tsx` and `src/pages/home.css`. Keep the responsive WebP and first-paint CTA. Use the existing 150 ms feedback token for action affordances. A rule may reveal once over 250 ms on entering the process section, with a static final state for reduced motion. Keep ordinary document scrolling, immediate focus feedback and readable content throughout.

**PERF-01 boundary.** Keep the renderer in `src/components/Shelf3D.tsx` and its shading rules in `src/components/shelf.css` intact. It skips hidden-book updates, caches transform, stacking and shade writes, writes rounded opacity directly to overlay leaves and stops scheduling frames when settled. Apply layout changes outside the stage. For a later implementation, use the existing shelf cases in `tests/browser/demo.spec.mjs` and check a performance trace through interaction and rest. Avoid scroll listeners that run a render loop, persistent layer promotion and a second cover transition. This audit made no frame-rate or loading-speed measurement.

**Scope and tooling.** Eight browser captures, source inspection and recent merge review. No regression suite or backend execution. The available Graphify graph belonged to an older reference checkout and yielded no matches for the queried current components. RTK and targeted source reads supplied the current baseline. The loopback OmniRoute gateway was started for this session with its existing read-only, free-only policy. Two Groq reviews returned empty text. One Gemini review returned a comparison and accessibility advice. The audit takes up its DOM-order and reduced-motion checks. A title below the fold is reported here as a discoverability issue; the observation alone establishes no WCAG failure. The orchestrator recorded 503 input and 1,179 output tokens, US$0 total. Offline ccusage reported a machine-wide daily total of 2,936,082 observed Codex tokens at the last sample. That figure includes other activity and does not measure the audit’s cost or remaining subscription quota.

**Exact next task, pending owner approval:** authorize B and a catalog-only preview for priorities 1 and 2. Compare it with the two catalog captures before deciding on integration. Donation confirmations, profile changes and a broader loading treatment remain unaudited.

# RePassa — Figma Reference Pack

Visual reference for recreating every planned screen in Figma.
Generated 2026-11-21 from `origin/main` (post UX-03 + DEV-05) — **a UX-04 branch exists
but contains no screen work** (it's an empty placeholder at the UX-03 merge commit).

## Status legend

| Label | Meaning |
|---|---|
| `IMPLEMENTED` | Real rendered UI — captured from the running app (Chromium, real components/CSS). |
| `PARTIAL` | Implemented but incomplete (none found in this audit). |
| `CONCEPT` | Not implemented — static HTML mockups using the project's design tokens. Clearly ribboned and footnoted. All data fictional. |

## Counts

| Role | Implemented | Partial | Concept | Total numbered screens |
|---|---|---|---|---|
| Visitor (V01–V06 + V99) | 6 (+1 extra: V99 404, V02b grid) | 0 | 1 | 7 |
| Student (E01–E11) | 8 | 0 | 3 | 11 |
| Institution (I01–I09) | 4 | 0 | 5 | 9 |
| Administrator (A01–A10) | 0 | 0 | 10 | 10 |
| **Totals** | **18** | **0** | **19** | **37** |

50 PNG files (desktop 1440×900 + 12 mobile 390×844 selects + 1 full-page).

## Layout

```
figma-reference/
  README.md            this file
  SCREEN_INDEX.csv     id, file, role, screen, route, status, viewport, notes
  shots/
    visitor/ student/ institution/ admin/   PNGs, one per screen
  contact-sheets/      contact-sheet-{visitor,student,institution,admin}.png
  concepts/            self-contained HTML sources for CONCEPT screens
  tools/               capture/dataset/concepts/contact-sheet scripts (re-runnable)
```

## Design tokens used

forest `#1C2925` · emerald `#267A62` · ivory `#F5F1E8` · coral `#E78A66` ·
muted `#526158` · line `#C9C9BA` · paper `#FAF7F0` · tint `#E7E8DC`.
Serif: Newsreader (headings); Sans: DM Sans (body). Status chips reuse the
exact `donation-status` palette from `src/pages/donations.css`.

## How implemented screens were captured

Local Vite dev server + Playwright; all `/api/v1/**` calls intercepted with a
fictional dataset (`tools/dataset.mjs`). Auth states simulated per role
(student Ana Beatriz Lima, staff Marta Souza — `example.invalid` accounts).
Real components, real CSS, real interactions (e.g. clicking "Reservar este
material" produced the confirmed state + pickup code).

## Concept screens

`concepts/*.html` are static, self-contained mockups (embedded fonts +
`concept.css` mirroring tokens). Regenerate with
`node tools/concepts.mjs` then re-shoot with `node tools/shoot-concepts.mjs`.
Every concept carries a rotated **CONCEPT** ribbon and a fictional-data notice.

## Known limitations

- Viewport-height captures (not full-page) for implemented screens except E04;
  below-fold content (home footer, etc.) exists in the real pages.
- Concepts are approximations: they reuse tokens/patterns but not the exact
  component CSS of implemented screens.
- The 3D shelf (`V02` estante) is a still frame — its drag/rotation behavior
  isn't representable in PNG; see `src/components/Shelf3D.tsx`.
- No admin/staff live accounts exist; admin area is 100% concept.
- `imageUrl` photos are always null in shots — the app renders generated
  "jacket" covers (`MaterialCover`) rather than uploaded photos.

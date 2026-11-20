# RePassa design direction
Brand: RePassa, slogan **Conhecimento merece circular**. Editorial, warm, educational, modern motion design (not generic SaaS). Original brand source is the project owner; inspect existing video assets read-only only if licensed for reuse; copy originals to frontend `public/brand/` with owner-approved source. Missing assets should be clearly flagged, never fabricate a new logo. No copying proprietary film covers or third-party brand marks.

| Token | Value / usage |
|---|---|
| forest | #1C2925 primary text/dark surfaces |
| emerald | #267A62 primary action/accent |
| ivory | #F5F1E8 page background |
| coral | #E78A66 decorative/status accent, not unreadable text on ivory |
| ink | #1C2925 |
| spacing | 4,8,12,16,24,32,48,64 px |
| radius | 8/12/20 px, editorial cards not all pills |
| motion | 150ms feedback, 250–450ms transitions, 650ms shelf mask, large intro ≤3s optional/skippable |

Typography proposal: Newsreader for editorial headings and Inter/Inter Tight for body; properly licensed local assets or system fallbacks, avoid unnecessary JP fonts. Body 16px, labels 14px, headings responsive. Contrast AA, focus visible, don't use color alone for status. Icons Lucide; buttons text+icon when useful. Design tokens in frontend styles; shared components Button, Input, Field, Select, Dialog, Toast/Status, Card, Skeleton, EmptyState, ErrorState, Nav and responsive Shell. Form constraints show in pt-BR. Keep CSS resets reasonable; no global fixed body or custom pointer.

Home: compelling hero (short optional montage of materials inspired by Orrin), headline, clear CTA, three-step how-it-works, real concept/ODS without fabricated metrics, footer. Do not block important navigation behind animation; no autoplay sound. Authentication: calm split illustration/form, mobile single column. Catalog: preserve existing shelf 3D rotation/spacing/drag and paper detail transition concept; use books/spines, category filters, grid toggle, keyboard focus and direct links. Non-book supplies use card/grid or appropriate objects. Student forms prioritize efficiency. Staff UI practical tables, filters, readable states and clear confirmations (less motion).

Motion: prefer transform/opacity, deterministic interaction; no hijack of scroll/keyboard globally. Respect prefers-reduced-motion (no forced intro, no large parallax); test touch and focus. Shelf handle 0, 1, many (no modulo zero), responsive size, dynamic data changed by filter; cancel rAF and listeners on unmount, no unnecessary setState each frame. Avoid external sprite assets from old film reference. Reuse `shelfMath` tests and add variable count cases. Mobile 390, tablet 768, desktop 1440. Target 60fps on typical machine where possible, no guaranteed benchmark; measure on actual demo device. Aim first route usable promptly on throttled network and optimize images/lazy loading. Verify screenshot at all breakpoints and keyboard journey; include evidence in PR.

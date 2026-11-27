# Optional design tools

After cloning or pulling the branch that contains this setup, run the following from the repository root with Node and Git available:

```sh
npm ci
npm run design:setup
npm exec -- ink-studio help
```

The setup installs 24 skills into the project's `.agents/skills/` directory. Start a new session in the checkout; Devin and Codex discover these folders live. Existing skill folders are kept on repeat runs. A fresh checkout restores the pinned versions. The installer uses a temporary directory and registers no hooks; the Impeccable engine manages its own project/user-level install and a checksum-verified binary under `~/.impeccable/`.

| Tool | Entry point | Version |
| --- | --- | --- |
| Ink Studio | `npm exec -- ink-studio help` | Git snapshot `52adc0c0` |
| Taste | `$design-taste-frontend` | Git snapshot `f6b76575` |
| Impeccable | `$impeccable` for design review, or `npm exec -- impeccable --help` | npm `4.10.0` (engine compiles skill v4.11.1) |
| UI UX Pro Max | `$ui-ux-pro-max`. Its local database search requires Python 3 | npm CLI `2.15.0` |
| Emil Kowalski | `$animate`, `$choreograph` and other skills from the pack | Git snapshot `64eb3deb` |
| Cantos Apple | `$cantos-apple` for nested-corner review | Git snapshot `4c15b53`, MIT, text-only |

## Design workflow

For design tasks, load only the skills the task needs:

1. Start with the RePassa design system and `repassa-design`; keep the forest-green, ivory and coral identity, Newsreader and DM Sans, and the Warm Interactive Editorial direction.
2. Use **Impeccable** for a scoped critique of existing screens.
3. Use **Taste** (`design-taste-frontend`) for meaningful art direction when a visual redesign or new screen composition is requested.
4. Use **UI UX Pro Max** for targeted design-system, layout and accessibility guidance.
5. Use the **Emil Kowalski** skills and `repassa-motion` for animation and interaction work.
6. Use **Cantos Apple** when reviewing nested rounded components.
7. Use **Ink Studio** only when original illustration, pixel art or 3D asset experimentation is relevant to the approved task.
8. Validate the actual render with the existing browser and Playwright infrastructure (`repassa-browser-qa`).

Project accessibility, security, business rules and owner-approved design decisions take precedence over generic external skills. Do not load every pack in every session.

## Apple interaction principles

Two principles from Apple's interface work apply to RePassa reviews:

**Concentric corner geometry.** Nested rounded elements should curve around the same center: `outer radius = inner radius + spacing` (padding + outer border + inner margin; `gap`, shadows and rings do not count). Fix the inner radius to `outer − spacing`; when that falls under ~4, raise the outer radius instead (`inner + spacing`). Pills/circles and elements far from the parent's corners are exempt. `$cantos-apple` reviews these pairs; on iOS 26+ it prefers Apple's `ConcentricRectangle`/`containerShape`, elsewhere it writes the computed number. On RePassa's web stack it writes CSS variables or exact values.

**Velocity-aware gesture projection.** At release, decide by where the gesture was going, not only where it stopped: `projected = position + velocity × decelRate / (1 − decelRate)` with `decelRate = 0.998`/ms (iOS scroll deceleration, from "Designing Fluid Interfaces", WWDC18). A fast release below the threshold completes; a slow release at the same point returns. Post-release animation must continue at the finger's velocity (motion continuity), never restart. Any change to an existing gesture requires a scoped proposal first — never apply velocity alone to confirm destructive or irreversible actions; keep explicit confirmation and accessible non-gesture alternatives. The 3D shelf (`Shelf3D.tsx`, `shelf.css`, `shelfMath.ts`) and catalog gestures are protected and out of scope for unapproved changes.

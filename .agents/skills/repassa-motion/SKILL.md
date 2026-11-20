---
name: repassa-motion
description: Specify, implement or review purposeful transitions, 3D shelf interactions and reduced-motion behavior in the RePassa frontend.
---

# Design and verify motion

1. Read [RePassa design direction](../../../docs/repassa/DESIGN_SYSTEM.md). Identify what changes, what feedback or continuity motion conveys, and the static equivalent. Keep staff workflows quick and predictable.
2. Specify trigger, start/end states, duration, easing, and interruption or reversal. Give entry and exit separate timing when justified. Make shared motion consistent across related components. Prefer transforms and opacity when they preserve layout and meaning.
3. Reuse existing Motion patterns. Respect `prefers-reduced-motion` and keep the same actions, accessible names, focus and final states in that mode. Keep information accessible through the grid and keyboard, including when shelf motion is disabled.
4. Verify normal and reduced modes, interrupted transitions, pointer/touch, keyboard, mobile rendering and slow-device behavior when relevant. Record observable regressions and only claim performance from a measurement.

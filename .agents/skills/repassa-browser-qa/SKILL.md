---
name: repassa-browser-qa
description: Verify RePassa frontend journeys in a local browser and review accessibility, responsive behavior and E2E evidence.
---

# Review a rendered journey

1. Read [screens](../../../docs/repassa/SCREENS.md) and [testing](../../../docs/repassa/TESTING.md). Identify the revision, local URL, role, fixture, and paths under review. State whether the run uses the API or the explicit mock.
2. Use the browser tools available in the session or the Playwright runner pinned by the repo when present. Verify desktop and narrow mobile, keyboard-only navigation, focus, modal escape/return, reduced motion, accessible names, and loading/empty/error/unauthorized states relevant to the change.
3. For E2E, use disposable synthetic data, role/label-based locators and auto-waiting assertions. Verify the visible result of each action and durable state when the flow warrants it. Exercise the primary catalog/reservation/receipt/pickup flow and relevant rejection paths as they become available.
4. Report steps, viewport, expected and observed behavior, and evidence. Capture the minimum synthetic screenshot or trace needed. Keep artifacts local and omit tokens, pickup codes and personal data. If tools or services are unavailable, record the unexecuted checks.

---
name: repassa-design
description: Design or implement RePassa screens, components, visual direction and design-system changes in the React application.
---

# Design a RePassa screen

1. Read [design direction](../../../docs/repassa/DESIGN_SYSTEM.md), [screen map](../../../docs/repassa/SCREENS.md) and [user flows](../../../docs/repassa/USER_FLOWS.md). Identify the user role, priority action, existing components and actual content in pt-BR.
2. Pick a layout, type, spacing and color hierarchy that makes that action easy. For new visual decisions, use existing design tokens first. Keep raw values, semantic roles and component variants distinct when adding a reusable token. Preserve the visual system across catalog, student and staff views.
3. Map loading, empty, error, success, disabled and unauthorized states as applicable. Include semantic HTML, labels, focus order, keyboard interaction, visible focus and contrast. Check narrow/mobile and desktop layouts, longer Portuguese text, dialogs and dense staff views.
4. Keep the existing 3D shelf interaction and an accessible grid route to the same materials. Use `repassa-motion` for new transitions. Use `repassa-browser-qa` to verify real renderings and record device/viewport, states and evidence.
5. Keep hero art and copy grounded in educational reuse and the approved brand. Write a short brief for new visual assets and confirm their provenance. Use the existing React/Vite/TypeScript/CSS stack and Motion where appropriate.

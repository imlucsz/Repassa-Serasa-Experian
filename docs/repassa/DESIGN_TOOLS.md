# Optional design tools

After cloning or pulling the branch that contains this setup, run the following from the repository root with Node and Git available:

```sh
npm ci
npm run design:setup
npm exec -- ink-studio help
```

The setup installs 23 skills into the project's `.agents/skills/` directory. Start a new Codex session in the checkout. Existing skill folders are kept on repeat runs. A fresh checkout restores the pinned versions. The installer uses a temporary directory and registers no hooks.

| Tool | Entry point | Version |
| --- | --- | --- |
| Ink Studio | `npm exec -- ink-studio help` | Git snapshot `52adc0c0` |
| Taste | `$design-taste-frontend` | Git snapshot `f6b76575` |
| Impeccable | `$impeccable` for design review, or `npm exec -- impeccable --help` | npm `4.10.0` |
| UI UX Pro Max | `$ui-ux-pro-max`. Its local database search requires Python 3 | npm CLI `2.15.0` |
| Emil Kowalski | `$animate`, `$choreograph` and other skills from the pack | Git snapshot `64eb3deb` |

Use these skills on demand under the RePassa Agent Kit. Start with the repository design system and use the applicable skill for art direction, accessibility, or motion review. Running the setup explicitly keeps third-party installers and large reference packs out of CI and production builds.

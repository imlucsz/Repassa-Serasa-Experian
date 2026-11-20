# Kit v1.0 — checks executed before delivery
Environment: isolated Linux container, Node v22.16.0 / Git 2.47.3; temporary repositories with synthetic legacy video and fake tokens, no user's Git history modified.

- `node --test scripts/agent-guard.test.mjs`: 8 passed, 0 failed, 0 skipped (staged clean, .env/media, staged secret/redaction, protected video modification/deletion, size limit, commits with secret subsequently removed, new branch/main/deletion, non-fast-forward).
- Whole staged kit: guard accepted it in disposable repo. Linux bootstrap performed successfully; actual pre-commit hook permitted package commit and blocked a staged `.env`. Range check accepted kit commit.
- OpenAPI: YAML parsed; 23 operations, 26 schemas; internal references resolved, operation IDs unique, path params matched. Structural validation only, not full OpenAPI standard validator nor backend conformance test.
- Actions YAML parsed, job names/event checked; GitHub-hosted CI was not executed. Windows PowerShell setup and hooks on Windows were not executed in this environment. Git hooks use LF line endings and Git for Windows-compatible shell syntax, but must be verified locally.
- No existing frontend/backend configs or code overwritten. No npm install/build of user's real app, no backend implementation, no push/merge or settings changes. CI may expose existing frontend/toolchain errors; fix/record them before claiming success.
- Guard is a heuristic; not a comprehensive secrets scanner or security boundary. Remote branch rules and human review still required. Review tracked reference-video licensing separately; this kit does not remove them.

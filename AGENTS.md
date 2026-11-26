# Stemma repository instructions

- Stemma is a plugin with one skill, `skills/stemma/SKILL.md`, plus templates, scripted tools, and an explorer. Do not add separate public `stemma-*` skills; add modes to the one skill.
- Stemma's own documents are governed by HELIX: see `.helix.yml` and `docs/stemma/`. Use `/helix` to frame, design, and align them. Authors never need HELIX.
- Tools and reports, not gates and approvals. Stemma finds problems and explains them. It never stops the author from writing, or asks them to verify or approve something before they can continue. Review and attestation happen out of line, when the author chooses. Every finding says what is wrong, shows the evidence, says why it matters and suggests what to do, in plain language; unexplained noise is a Stemma defect. No finding blocks a build; only an ordinary tool failure stops output.
- Evidence invariants: never invent a citation, and show one without a source record and stored copy as unchecked; drafts come from the claim ledger; record files are the source of truth and every database is derived.
- State what checks prove. Never present a model verdict or a recorded review, annotation, or confirmation as proof, and never call output with open findings checked clean (ADR-003).
- Code is TypeScript. Deterministic tools run on Bun on macOS, Linux, and Windows; browser code is bundled, styled with Tailwind alongside the arras styles. The desktop-app promise covers macOS and Windows only. Pin and record every other tool (ADR-004). Required features need no WSL or Docker. Mark untested systems as untested.
- Reuse DocumentDrivenDX family tools (UMF, arras, HELIX and others) before writing new code; check what a tool does before relying on it.
- Project checks run locally; hosted runs are release-tag only and advisory. Do not add required CI jobs or commit hooks (ADR-007).
- Ship deliverables over process machinery. Keep changes minimal and specified before implemented.
- This repository is public.

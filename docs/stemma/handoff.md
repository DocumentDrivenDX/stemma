# Stemma handoff

Context from the cloud session that created this project. The repo files hold the
decisions. This note holds the reasoning, the source material, the user's stated
preferences, and the next steps.

## What Stemma is

A HELIX-style document discipline and toolchain for writing academic books with AI
assistance. Every citation is verified by scripts and enforced by commit gates.
The same repository typesets a camera-ready PDF. Specified with HELIX
(`github.com/DocumentDrivenDX/helix`) but independent of it (ADR-001).

**Stemma** comes from *stemma codicum*, the family tree of manuscripts: a
traceable line of descent from each sentence to a stored source.

## Decisions the user made (their words, condensed)

- Users are academic researchers. Humanities first, then technologists researching
  technology, then other fields. Personas should span comfort with AI.
- The corpus rule is strict. The plugin includes scripted deterministic tooling for
  verification, and commit gates that require it to run and pass.
- AI-written prose is fine provided it does not fabricate sources. A goal is faster
  research and composition through AI.
- Typesetting is in scope, with an on-disk format rich enough for a camera-ready PDF.
- No dependence on an external reference manager. The plugin includes that capability.
- Gate scope: yes. Claim-support verification is in the gate (FR-52 to FR-54). The
  author's phrase was terse. The cloud session read it as "claim support is in gate
  scope." Confirm if that is unclear.
- Rendering supports high-resolution raster and vector images (FR-55 to FR-59).
- v1 covers: research, governance rules, governance scripts and checks, a research
  and citation data store, tooling to generate final researched content, typesetting
  into a book, and evolution, audit, and review.

## Design stances to keep

- Scripts verify, models propose. A model result enters a gate only as a recorded
  artifact that a script checks for presence, currency, and resolution.
- The author decides interpretation. Rival-readings audit per chapter.
- Exceptions are recorded, dated, reasoned, and disclosed. No silent bypass.
- The checks and build run without any AI.

## Open questions (also in the PRD)

On-disk format and typesetting engine (Pandoc with LaTeX, Typst, other), how a
support-check verdict is measured, PDF/X and color profile requirements, binary
storage (git LFS or a hash store), the v1 citation styles and trim sizes, one skill
or sibling skills, reviewer comment format, and how paper-only sources reach a
stored scan.

## Not yet done

- Prior-art research (Zotero, Pandoc, Quarto, Manubot, and similar) to ground the vision.
- Feature specifications and user stories for FEAT-001 to FEAT-010.
- ADRs for format, engine, binary storage, and the support-check design.
- A seeded-error test corpus, the first scripted check, and the skill modes.

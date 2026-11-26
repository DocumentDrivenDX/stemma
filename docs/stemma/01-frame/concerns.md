---
ddx:
  id: stemma.concerns
  authoring:
    home: repo
---

# Project Concerns

Project Concerns declare active cross-cutting context for downstream work.
Stemma has not selected a technology stack. The entries below are project-local
quality and domain concerns. Stack concerns wait for the on-disk format and
typesetting ADRs.

## Active Concerns

| Concern | Source | Areas | Why Active | Key Practices |
|---------|--------|-------|------------|---------------|
| citation-integrity | project-local | `area:data`, `area:cli` | Every feature that creates or edits a citation, note, or claim must preserve the chain from text to stored source | Citation keys resolve to records; records resolve to stored files; locators and quotations match stored text |
| deterministic-gates | project-local | `area:cli`, `area:infra` | Gates must run without a model, offline, with stable results | Same inputs give the same outputs; seeded-error test corpus per check; results carry evidence |
| ai-disclosure | project-local | `area:cli`, `area:data` | Reviewers and publishers need an accurate account of AI use | Record model, prompt version, role, and exceptions; generate the disclosure from the record |
| typesetting-fidelity | project-local | `area:build` | Camera-ready output must meet print requirements | Resolution, font embedding, color, bleed and trim checks in the build; no silent resampling |
| rights-and-permissions | project-local | `area:data`, `area:build` | Sources and images are often copyrighted or restricted | Rights flags on every source and image; enforced in the build and the reviewer package |
| scope-discipline | HELIX library | all | Keeps v1 to the PRD | Deferred work goes to the parking lot with a revisit trigger |

## Project Overrides

| Concern | Practice | Override | Authority |
|---------|----------|----------|-----------|
| none | | | |

## Area Labels

- `area:cli` — command-line tools, checks, and gates
- `area:data` — corpus, citation store, notes, claims, registers
- `area:build` — typesetting and rendering pipeline
- `area:infra` — CI, hooks, and distribution
- `area:skill` — the plugin skill and its modes

## Concern Conflicts

| Conflict | Resolution |
|----------|------------|
| deterministic-gates vs. claim-support check | The support check is a recorded artifact. The gate verifies its presence, currency, and resolution deterministically, and never calls the model. |
| rights-and-permissions vs. reviewer reproduction | The reviewer package omits restricted files and includes their hashes and check results. Reproduction of those checks needs the author's permission or the files. |

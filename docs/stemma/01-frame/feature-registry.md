---
ddx:
  id: stemma.feature-registry
  authoring:
    home: repo
---

# Feature Registry

**Last Updated**: 2026-11-26

## Active Features

Each feature maps to one PRD subsystem. Feature specifications own the depth.

| ID | Name | Description | Priority | Owner | Source | Updated |
|----|------|-------------|----------|-------|--------|---------|
| FEAT-001 | Workspace and governance | Project init, standing rules, registers, decision log, AI roles | P0 | product owner | PRD subsystem 1 (FR-1 to FR-5) | 2026-11-26 |
| FEAT-002 | Source corpus | Admission, provenance, rights, text extraction, change tracking | P0 | product owner | PRD subsystem 2 (FR-6 to FR-10) | 2026-11-26 |
| FEAT-003 | Citation store | Project-owned bibliography, formats, keys, import and export | P0 | product owner | PRD subsystem 3 (FR-11 to FR-15) | 2026-11-26 |
| FEAT-004 | Research and discovery | Candidate search, admission workflow, coverage log | P0 | product owner | PRD subsystem 4 (FR-16 to FR-19) | 2026-11-26 |
| FEAT-005 | Notes, claims, constructs | Passage-anchored notes, claim ledger, construct register | P0 | product owner | PRD subsystem 5 (FR-20 to FR-23) | 2026-11-26 |
| FEAT-006 | Composition | Outline, chapter specs, drafting from claims, rival readings | P0 | product owner | PRD subsystem 6 (FR-24 to FR-28) | 2026-11-26 |
| FEAT-007 | Verification and gates | Deterministic checks, claim-support check, commit and CI gates | P0 | product owner | PRD subsystem 7 (FR-29 to FR-34, FR-52 to FR-54) | 2026-11-26 |
| FEAT-008 | Typesetting and publishing | Enriched format, camera-ready PDF, images, color, preflight | P0 | product owner | PRD subsystem 8 (FR-35 to FR-40, FR-55 to FR-59) | 2026-11-26 |
| FEAT-009 | Evolution, audit, review | Changelog, errata, audits, disclosure, reviewer package | P0 | product owner | PRD subsystem 9 (FR-41 to FR-47) | 2026-11-26 |
| FEAT-010 | Plugin and skill | One skill with modes, command-line parity, persona defaults | P0 | product owner | PRD subsystem 10 (FR-48 to FR-51) | 2026-11-26 |

## Product Lifecycle

None recorded.

## Dependencies

| Feature | Depends On | Type | Notes |
|---------|------------|------|-------|
| FEAT-003 | FEAT-002 | Required | Records point to stored sources |
| FEAT-004 | FEAT-002, FEAT-003 | Required | Admission creates a source and a record |
| FEAT-005 | FEAT-002, FEAT-003 | Required | Notes anchor to stored passages |
| FEAT-006 | FEAT-005 | Required | Drafts come from ledger entries |
| FEAT-007 | FEAT-002, FEAT-003, FEAT-005 | Required | Checks read corpus, store, and ledger |
| FEAT-008 | FEAT-007 | Required | The build refuses when gates fail |
| FEAT-009 | FEAT-007, FEAT-008 | Required | Disclosure and packages use check and build records |
| FEAT-010 | FEAT-001 to FEAT-009 | Required | The skill routes to every capability |

## Relevant References

- `docs/stemma/00-discover/product-vision.md`
- `docs/stemma/01-frame/prd.md`
- `docs/stemma/01-frame/principles.md`
- `docs/stemma/01-frame/concerns.md`

## Feature Categories

### Evidence strand
- FEAT-002, FEAT-003, FEAT-004, FEAT-005

### Manuscript strand
- FEAT-006, FEAT-008

### Governance and assurance
- FEAT-001, FEAT-007, FEAT-009, FEAT-010

## ID Rules

1. Sequential numbering: FEAT-XXX (zero-padded 3 digits)
2. Never reuse IDs, even for cancelled features
3. Do not encode category or priority into the ID
4. Keep full behavior in Feature Specifications, not in this registry

## Deprecated/Cancelled

None.

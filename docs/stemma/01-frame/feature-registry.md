---
ddx:
  id: stemma.feature-registry
  type: feature-registry
  activity: frame
  authoring:
    home: repo
  depends_on:
    - stemma.prd
---

# Feature Registry

**Last Updated**: 2026-11-26

## Active Features

Each feature maps to one PRD subsystem with the same number. Feature
specifications own the depth. The priority is the highest priority among a
feature's requirements; the PRD ranks each requirement.

| ID | Name | Description | Priority | Owner | Source | Updated |
|----|------|-------------|----------|-------|--------|---------|
| FEAT-001 | Workspace and governance | Project setup, thesis, constructs and methodology inputs, standing rules, registers, AI roles | P0 | product owner | Subsystem 1: FR-1 to FR-5, FR-60 | 2026-11-26 |
| FEAT-002 | Source corpus | Capture, conversion to source files in the repository, reverification, structure checks, comparisons and reviews, iterative capture of library details and tags, passage capture, change tracking, excerpts for hosted models | P0 | product owner | Subsystem 2: FR-6 to FR-10, FR-61, FR-84 to FR-90, FR-94 | 2026-11-26 |
| FEAT-003 | Citation store | Official bibliography records, keys, typed locators, legacy library exchange | P0 | product owner | Subsystem 3: FR-11 to FR-15 | 2026-11-26 |
| FEAT-004 | Research and discovery | Candidate search, the author's admission decisions, coverage log | P0 | product owner | Subsystem 4: FR-16 to FR-19 | 2026-11-26 |
| FEAT-005 | Notes, claims, constructs | Passage-anchored notes, claim ledger and claim relations, construct register | P0 | product owner | Subsystem 5: FR-20 to FR-23, FR-80 | 2026-11-26 |
| FEAT-006 | Composition | Outline, chapter specifications, drafting from claims, rival readings | P0 | product owner | Subsystem 6: FR-24 to FR-28 | 2026-11-26 |
| FEAT-007 | Verification and reports | Scripted checks, explained findings, claim-support records, annotations, the checked-clean label | P0 | product owner | Subsystem 7: FR-29 to FR-34, FR-52 to FR-54, FR-74 | 2026-11-26 |
| FEAT-008 | Typesetting and publishing | Typst build, basic pilot PDF, citation formatting, drafts and camera-ready output, images, print PDF | P0 | product owner | Subsystem 8: FR-35 to FR-40, FR-55 to FR-58, FR-83, FR-91 | 2026-11-26 |
| FEAT-009 | Evolution, audit, review | Changelog, errata, audits, AI-use disclosure, reviewer package and reviewer comments | P0 | product owner | Subsystem 9: FR-41 to FR-47, FR-79 | 2026-11-26 |
| FEAT-010 | Plugin, skill, and distribution | One skill with modes, command line shipped inside the plugin, self-setup of the pinned Bun, tools on three systems, desktop install on macOS and Windows, marketplace install, install tests | P0 | product owner | Subsystem 10: FR-48 to FR-51, FR-75, FR-77, FR-78 | 2026-11-26 |
| FEAT-011 | Evidence graph and graph engine | Record files as the graph; arras-compatible TypeScript and SQLite engine, reads first | P0 | product owner | Subsystem 11: FR-62, FR-63 | 2026-11-26 |
| FEAT-012 | Explorer and typeset preview | arras-based explorer, larger graph view contributed to arras, linked pages, in-browser Typst preview rebuilt and reloaded after edits | P0 | product owner | Subsystem 12: FR-64, FR-65, FR-76 | 2026-11-26 |
| FEAT-013 | Argument and geographic maps | Place records, view-only maps projected from the graph, restricted locations | P0 | product owner | Subsystem 13: FR-66 to FR-68, FR-81 | 2026-11-26 |
| FEAT-014 | Voice and style | Built-in extensible profiles, amendment from the author's writing | P0 | product owner | Subsystem 14: FR-69, FR-70 | 2026-11-26 |
| FEAT-015 | Takeover of existing projects | Intake of Word and libraries, unverified graph, author-date linking to reference lists, usable first report, remove, repoint, or replace rounds in a Stemma copy, construct and methodology suggestions | P0 | product owner | Subsystem 15: FR-71 to FR-73, FR-82, FR-92, FR-93 | 2026-11-26 |

## Product Lifecycle

None recorded.

## Dependencies

| Feature | Depends On | Type | Notes |
|---------|------------|------|-------|
| FEAT-001 | FEAT-011 | Required | Governing records are graph records |
| FEAT-002 | FEAT-001, FEAT-011 | Required | Sources are records in a project |
| FEAT-003 | FEAT-002, FEAT-011 | Required | Bibliography records describe the sources captured |
| FEAT-004 | FEAT-011 | Required | Searches and decisions are graph records |
| FEAT-005 | FEAT-011 | Required | Notes, claims, and constructs are graph records |
| FEAT-006 | FEAT-011 | Required | Chapters and plans are held with the graph |
| FEAT-007 | FEAT-011 | Required | Checks read the graph; support records and annotations are records |
| FEAT-008 | FEAT-011 | Required | The build reads record files |
| FEAT-009 | FEAT-011 | Required | Disclosure, packages, and imported comments use records |
| FEAT-014 | FEAT-011 | Required | Assumption: profiles, review marks, and examples are held with the project records |
| FEAT-015 | FEAT-011 | Required | Takeover writes graph records |
| FEAT-004 | FEAT-002, FEAT-003 | Required | Admission creates a source and a record |
| FEAT-005 | FEAT-002, FEAT-003 | Required | Notes anchor to passage addresses |
| FEAT-006 | FEAT-001, FEAT-005 | Required | Drafts come from inputs and ledger entries |
| FEAT-006 | FEAT-014 | Optional | Drafting applies a voice profile when one is set |
| FEAT-007 | FEAT-002, FEAT-003, FEAT-005 | Required | Checks read sources, bibliography, and ledger |
| FEAT-008 | FEAT-003, FEAT-007 | Required | The build formats citations and reports every finding |
| FEAT-009 | FEAT-007, FEAT-008 | Required | Disclosure and packages use check and build records |
| FEAT-009 | FEAT-012 | Required | The reviewer package holds an offline explorer file |
| FEAT-009 | FEAT-001 | Required | Disclosure uses standing rules; registers hold history |
| FEAT-009 | FEAT-006 | Optional | The disclosure reads authorship marks when they exist (FR-27) |
| FEAT-009 | FEAT-013 | Required | Packaging applies the restricted-location rules (FR-68) |
| FEAT-012 | FEAT-008, FEAT-011 | Required | The explorer shows the graph and typeset pages |
| FEAT-013 | FEAT-005, FEAT-011, FEAT-012 | Required | Maps project claims and places inside the explorer |
| FEAT-014 | FEAT-001 | Required | Profiles belong to a project |
| FEAT-015 | FEAT-002, FEAT-003, FEAT-005, FEAT-007 | Required | Takeover creates unverified records and checks them |
| FEAT-015 | FEAT-001 | Required | A taken-over project has standing rules from M1 |
| FEAT-015 | FEAT-008 | Required | Fixes are written in the manuscript markup (FR-35, FR-73) |
| FEAT-008 | FEAT-015 | Required | The pilot typesets the Stemma copy that takeover writes (FR-83, FR-73) |

FEAT-010 has two parts. Its runtime, command line, packaging, and install tests
(FR-49, FR-50, FR-75, FR-78) come before other features. Its skill modes (FR-48)
route to each feature as that feature arrives.

Boundaries:

- Record structure and the graph belong to FEAT-011; what a record means belongs
  to the feature that owns it.
- The graph engine (FR-63) blocks no first-version feature. Until it exists,
  features read record files through a disposable index.
- The larger arras graph view belongs to FEAT-012 and blocks only the explorer.
- The graph engine (FR-63) and ChatGPT support (FR-77) are both P1; neither
  delays the pilot or the first Claude release.
- Reviewer comments (FR-79) belong to FEAT-009; the offline explorer that
  collects them comes from FEAT-012.

## Delivery Order

| Step | Scope | Features that contribute |
|------|-------|--------------------------|
| M1 | Checks, takeover, and a basic PDF: the first pilot | FEAT-002, FEAT-003 (including FR-15), FEAT-005, FEAT-007, FEAT-010, FEAT-011, FEAT-015, FEAT-001 standing rules, and FEAT-008 FR-83, the FR-35 working copy, and the FR-39 reports of those builds |
| M2 | New project to camera-ready PDF | FEAT-001, FEAT-004, FEAT-006, FEAT-008, FEAT-009, FEAT-014, FEAT-005 constructs and claim relations, FEAT-015 FR-82 |
| M3 | Explorer and maps | FEAT-012, FEAT-013, and the FEAT-009 reviewer package with comments |

## Relevant References

- `docs/stemma/00-discover/product-vision.md`
- `docs/stemma/00-discover/competitive-analysis.md`
- `docs/stemma/01-frame/prd.md`
- `docs/stemma/01-frame/principles.md`
- `docs/stemma/01-frame/concerns.md`
- `docs/stemma/01-frame/security-requirements.md`
- `docs/stemma/01-frame/threat-model.md`
- `docs/stemma/02-design/adr/`
- `docs/stemma/02-design/architecture.md` and `data-design.md`
- `docs/stemma/02-design/security-architecture.md`
- `docs/stemma/02-design/DESIGN.md` and user flows in `02-design/flows/`:
  UF-007 (FEAT-007), UF-012 (FEAT-012), UF-013 (FEAT-013), UF-015 (FEAT-015)
- `docs/stemma/02-design/solution-designs/`: SD-001 to SD-015, numbered as their
  features
- `docs/stemma/02-design/contracts/`

## Feature Categories

### Evidence strand
- FEAT-002, FEAT-003, FEAT-004, FEAT-005, FEAT-011, FEAT-015

### Manuscript strand
- FEAT-006, FEAT-008, FEAT-014

### Exploration
- FEAT-012, FEAT-013

### Governance, assurance, and distribution
- FEAT-001, FEAT-007, FEAT-009, FEAT-010

## ID Rules

1. Sequential numbering: FEAT-XXX (zero-padded 3 digits)
2. Never reuse IDs, even for cancelled features
3. Do not encode category or priority into the ID
4. Keep full behavior in Feature Specifications, not in this registry

## Deprecated/Cancelled

None.

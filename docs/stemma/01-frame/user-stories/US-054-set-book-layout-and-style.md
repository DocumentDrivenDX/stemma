---
ddx:
  id: US-054
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-008
---

# US-054: Set book layout and citation style

**Feature**: FEAT-008 — Typesetting and Publishing
**Feature Requirements**: BLD-03, BLD-04, BLD-08
**PRD Requirements**: FR-38
**Priority**: P0

## Story

**As a** Tomasz, the scholar outside the humanities,
**I want** to set style, trim size, fonts, and citation style in project settings
**So that** the book matches my press and I know whether its citation output is guaranteed.

## Context

Tomasz works to a field style. Only Chicago notes and bibliography is guaranteed, against examples a style-manual holder approved; anything else must say it is unverified.

## Walkthrough

1. Tomasz reads the documented defaults.
2. Tomasz sets a trim size and fonts and builds.
3. The pages use those settings.
4. Tomasz selects another citation style.
5. The output is labelled unverified.

## Acceptance Criteria

- [ ] **US-054-AC1** — Given a new project, when settings are read, then style, trim size, fonts, and citation style each have a documented default.
- [ ] **US-054-AC2** — Given a changed trim size or font setting, when a build runs, then the output uses it.
- [ ] **US-054-AC3** — Given Chicago notes and bibliography, when the approved example set is run, then the output matches every approved example.
- [ ] **US-054-AC4** — Given a citation style outside the guaranteed one, when a build runs, then the output is labelled unverified.
- [ ] **US-054-AC5** — Given each of the trim sizes 6 x 9 in, 5.5 x 8.5 in, and A5, when it is selected and the book is built, then the pages have that size.

## Edge Cases

- **No approved example set yet**: Chicago output is labelled unverified too (assumption).
- **Note form outside the approved examples**: The guarantee covers approved examples only; unsupported forms found are reported.
- **Font not available**: The build reports it and does not substitute silently.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Defaults | US-054-AC1 | New project | Read settings | Four documented defaults |
| Trim | US-054-AC2 | Trim 6 by 9 inches | Build | Page size 6 by 9 inches |
| Chicago | US-054-AC3 | Approved set with a short-form note | Run set | All match |
| Other style | US-054-AC4 | An author-date style | Build | Labelled unverified |
| Shipped sizes | US-054-AC5 | Each of the three sizes | Build | Page size matches the choice |

## Dependencies

- **Stories**: None.
- **Feature Spec**: FEAT-008 — Typesetting and Publishing
- **Feature Requirements**: BLD-03, BLD-04, BLD-08
- **PRD Requirements**: FR-38
- **External**: citeproc-js; a style-manual holder to approve examples.

## Out of Scope

- Guaranteeing other styles.
- Further shipped trim sizes.

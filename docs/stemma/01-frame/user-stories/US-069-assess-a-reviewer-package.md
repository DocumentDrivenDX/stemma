---
ddx:
  id: US-069
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-009
---

# US-069: Assess a manuscript from its reviewer package

**Feature**: FEAT-009 — Evolution, Audit, and Review
**Feature Requirements**: REL-02, REL-04, REL-07
**PRD Requirements**: FR-45, FR-46
**Priority**: P0

## Story

**As a** Noor, the reviewer or editor,
**I want** to open a reviewer package offline and read its report and disclosure
**So that** I can decide how far to trust the manuscript, knowing what was checked and what rests on records alone.

## Context

Noor cannot see the author's project or sources. This story bundles FR-45 and FR-46 because it is the recipient's single journey through the package that FR-46 requires to contain the FR-45 disclosure.

## Walkthrough

1. Noor receives the package.
2. Noor opens the PDF and, without a network, the explorer file.
3. Noor reads each check result, the label, and any annotation.
4. Noor reads the disclosure and its stated limits.

## Acceptance Criteria

- [ ] **US-069-AC1** — Given a reviewer package and no network, when the explorer file is opened, then it opens.
- [ ] **US-069-AC2** — Given the disclosure in the package, when it is read, then it states that support verdicts were not rerun at build and that review marks and annotations are not forgery-proof.
- [ ] **US-069-AC3** — Given the package, when its statements are read, then it does not present itself as sufficient to rerun the checks.

## Edge Cases

- **Removed source text**: The reviewer can see that material was withheld rather than read it as missing evidence.
- **Desktop file viewer blocks scripts**: The PDF, report, and disclosure remain readable; viewer support is unverified.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Offline | US-069-AC1 | Package on a disconnected machine, supported browser | Open explorer | Opens |
| Limits | US-069-AC2 | Package with 1 annotation | Read disclosure | Annotation and both limits present |
| No rerun | US-069-AC3 | Package | Read report | No claim that checks can be rerun |

## Dependencies

- **Stories**: US-067.
- **Feature Spec**: FEAT-009 — Evolution, Audit, and Review
- **Feature Requirements**: REL-02, REL-04, REL-07
- **PRD Requirements**: FR-45, FR-46
- **External**: FEAT-012 explorer.

## Out of Scope

- Returning comments to the author (US-104).
- Explorer navigation behavior (FEAT-012).

---
ddx:
  id: US-060
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-008
---

# US-060: Record image credit and permission

**Feature**: FEAT-008 — Typesetting and Publishing
**Feature Requirements**: IMG-07, IMG-08, IMG-09
**PRD Requirements**: FR-58
**Priority**: P1

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to record each image's source, credit, rights, permission, caption, alternative text, and figure identifier
**So that** every image I lack credit or recorded permission for is reported to me.

## Context

Images are often copyrighted or restricted. The record ties the file to its rights and to cross-references.

## Walkthrough

1. Idris adds a photograph and fills in its record.
2. Idris leaves permission empty on a second image.
3. The image check runs.
4. It reports the second image and says what is missing.

## Acceptance Criteria

- [ ] **US-060-AC1** — Given an image with a complete record, when a build runs, then its caption, alternative text, and figure identifier are available to layout and cross-references.
- [ ] **US-060-AC2** — Given an image with no credit, when the check runs, then it reports and names the image.
- [ ] **US-060-AC3** — Given an image with no recorded permission, when the check runs, then it reports and names the image.
- [ ] **US-060-AC4** — Given an image that lacks credit or recorded permission, when a camera-ready or reviewer build runs, then it completes and reports the finding.

## Edge Cases

- **Own photograph**: Permission is still recorded, for example as the author's own.
- **Recorded permission**: The record states what was entered; it does not prove the right exists.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Complete | US-060-AC1 | Record with identifier 'fig-harbor' | Build with cross-reference | Reference resolves; caption shown |
| No credit | US-060-AC2 | Empty credit | Check | Reported |
| No permission | US-060-AC3 | Empty permission | Check | Reported |
| Reported | US-060-AC4 | Image with no permission | Build camera-ready | Built; finding reported |

## Dependencies

- **Stories**: US-057.
- **Feature Spec**: FEAT-008 — Typesetting and Publishing
- **Feature Requirements**: IMG-07, IMG-08, IMG-09
- **PRD Requirements**: FR-58
- **External**: FEAT-011 records.

## Out of Scope

- Obtaining permissions.
- Derived-data lineage.

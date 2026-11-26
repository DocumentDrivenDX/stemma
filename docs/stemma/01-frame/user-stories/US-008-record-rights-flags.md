---
ddx:
  id: US-008
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-002
    - stemma.prd
---

# US-008: Record rights and permission flags

**Feature**: FEAT-002 — Source corpus
**Feature Requirements**: RGT-01, RGT-06
**PRD Requirements**: FR-7, FR-61
**Priority**: P0

## Story

**As a** Tomasz, the scholar outside the humanities,
**I want** to mark which sources carry rights, unpublished-data, or community-permission limits
**So that** Stemma and I can see each source's limits and keep protected material out of a reviewer package.

## Context

Tomasz works with fieldwork and datasets that carry limits. The rights fields decide what a reviewer package may hold. They do not limit what is sent to a hosted model: any source in a project may be sent.

## Walkthrough

1. Tomasz admits an unpublished interview summary.
2. Stemma asks about rights and permissions.
3. Tomasz sets the unpublished-data and community-permission flags.
4. Stemma stores the flags and shows them with the source.

## Acceptance Criteria

- [ ] **US-008-AC1** — Given a source record, when the author sets a rights field, an unpublished-data flag, or a community-permission flag, then the record holds it and checks can read it.
- [ ] **US-008-AC2** — Given an admission or takeover where rights were not stated, when the source is recorded, then Stemma offers to record them, records the source without them, and shows unanswered rights as unstated rather than cleared.
- [ ] **US-008-AC3** — Given rights being recorded, when Stemma explains them, then it says that no flag keeps the source from a hosted model.

## Edge Cases

- **A flag is removed**: The change is a visible change to the source record; Stemma does not remove a flag on its own.
- **Rights are unstated**: Stemma shows them as unstated. It does not say that the license permits sending the text to a model.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Flag set | US-008-AC1 | Synthetic interview summary; both permission flags and a rights field set | Save and read back | All values present and readable |
| Unstated | US-008-AC2 | Source added without rights answers | View source | Rights shown as unstated |
| No gate | US-008-AC3 | Community-permission flag set | Read the explanation | It says the source may still be sent to a hosted model |

## Dependencies

- **Stories**: US-007.
- **Feature Spec**: FEAT-002 — Source corpus
- **Feature Requirements**: RGT-01, RGT-06
- **PRD Requirements**: FR-7, FR-61
- **External**: Rights field shape belongs to Contract artifacts.

## Out of Scope

- What is prepared for a model (US-012).
- Image credit and permission (FR-58).
- Legal determination of rights.

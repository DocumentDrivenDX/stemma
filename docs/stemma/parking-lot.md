---
ddx:
  id: stemma.parking-lot
  authoring:
    home: repo
---

# Parking Lot (Deferred / Future Work)

## Purpose

Deferred work that the v1 PRD names as P2 or excludes, tracked without
distorting current commitments.

## Policy

- Rejected items do not belong here; close or cancel them instead.
- Active work does not belong here; track it in the Feature Registry.
- Deferred items include a rationale and a revisit trigger.
- Revisit triggers are objective enough for another agent to evaluate.

## Deferred / Future Items

### Additional citation styles
- **Type**: Deferred
- **Artifact Type**: Feature Spec
- **Source**: PRD P2
- **Rationale**: v1 ships a small set of styles that cover the pilot authors.
- **Impact if Omitted**: Authors in other fields convert styles by hand.
- **Dependencies**: FEAT-003
- **Revisit Trigger**: A pilot author needs a style outside the v1 set.
- **Target Activity/Milestone**: After v1
- **Owner**: product owner
- **Last Reviewed**: 2026-11-26

### Local open-weight model support
- **Type**: Future
- **Artifact Type**: Solution Design
- **Source**: PRD P2
- **Rationale**: Sensitive corpora may not leave the author's machine.
- **Impact if Omitted**: Authors with restricted data cannot use hosted models.
- **Dependencies**: FEAT-010
- **Revisit Trigger**: A pilot author with a restricted corpus requests it.
- **Target Activity/Milestone**: After v1
- **Owner**: product owner
- **Last Reviewed**: 2026-11-26

### Multi-author collaboration on one corpus
- **Type**: Future
- **Artifact Type**: Feature Spec
- **Source**: PRD P2
- **Rationale**: v1 serves one author with reviewers; shared editing adds conflict and permission rules.
- **Impact if Omitted**: Co-authors work through exports and branches.
- **Dependencies**: FEAT-001, FEAT-002
- **Revisit Trigger**: Two pilot authors need concurrent edits on one project.
- **Target Activity/Milestone**: After v1
- **Owner**: product owner
- **Last Reviewed**: 2026-11-26

### Dataset and figure provenance beyond file hashes
- **Type**: Future
- **Artifact Type**: Feature Spec
- **Source**: PRD P2
- **Rationale**: v1 records hashes and credits; lineage tracking for derived data is larger.
- **Impact if Omitted**: Authors in data-heavy fields document derivation by hand.
- **Dependencies**: FEAT-002, FEAT-008
- **Revisit Trigger**: A pilot author in a data-heavy field requests derivation tracking.
- **Target Activity/Milestone**: After v1
- **Owner**: product owner
- **Last Reviewed**: 2026-11-26

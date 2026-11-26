---
ddx:
  id: US-062
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-009
---

# US-062: Keep a dated changelog

**Feature**: FEAT-009 — Evolution, Audit, and Review
**Feature Requirements**: HST-01, HST-02
**PRD Requirements**: FR-41
**Priority**: P1

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to be told when a camera-ready or reviewer version has no dated changelog entry
**So that** I can trace any version I shared to what changed in it.

## Context

Without dated entries, a run of shared versions can become untraceable. Every release report shows a missing entry.

## Walkthrough

1. Idris builds a camera-ready copy.
2. No entry exists for the version; the build completes and its report says so.
3. Idris adds a dated entry when ready.
4. The next report shows no changelog finding.

## Acceptance Criteria

- [ ] **US-062-AC1** — Given a camera-ready or reviewer build for a version with no dated entry, when it runs, then it completes and its report names the missing entry.
- [ ] **US-062-AC2** — Given a version with a dated entry, when its history is read, then the entry is shown and the report has no changelog finding.
- [ ] **US-062-AC3** — Given no entry for the current work, when a draft build runs, then no changelog finding is raised.

## Edge Cases

- **Undated entry**: It does not satisfy the requirement.
- **Assistant-suggested text**: The author can edit it at any time.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Missing | US-062-AC1 | Version 0.3 without entry | Camera-ready build | Completes; missing entry reported |
| Present | US-062-AC2 | Entry '0.3, 2027-03-02' | Camera-ready build then read history | Entry shown; no finding |
| Draft | US-062-AC3 | No entry | Draft build | No changelog finding |

## Dependencies

- **Stories**: US-055.
- **Feature Spec**: FEAT-009 — Evolution, Audit, and Review
- **Feature Requirements**: HST-01, HST-02
- **PRD Requirements**: FR-41
- **External**: None.

## Out of Scope

- Entries for draft builds, which need none.
- Commit-message conventions.

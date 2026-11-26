---
ddx:
  id: US-027
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-007
    - stemma.prd
---

# US-027: Check changes as I work and everything at build

**Feature**: FEAT-007 — Verification and reports
**Feature Requirements**: FBK-01, FBK-02, BLK-02
**PRD Requirements**: FR-31
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist,
**I want** to have checks run for me as work changes, without setting up git hooks or a server
**So that** I learn of errors early and every build still gets a full recheck

## Context

Checks run inside the agent on changed records and their dependents. Edits made outside the agent are caught by the full rerun at every build.

## Walkthrough

1. Margit changes a note's extract in a session.
2. The agent runs checks on the note and the records that depend on it.
3. Margit sees the results.
4. At any build, Stemma reruns every scripted check over the whole project.

## Acceptance Criteria

- [ ] **US-027-AC1** — Given a record changed in an agent session, when the change is made, then checks run on it and on the records that depend on it, and their results are shown without stopping the work.
- [ ] **US-027-AC2** — Given a record edited outside the agent so that a quotation no longer matches, when a build runs, then the rerun detects it and the report shows it.
- [ ] **US-027-AC3** — Given saved results from earlier runs, when a build is requested, then every scripted check runs again over the whole project.
- [ ] **US-027-AC4** — Given a project with no commit hook and no CI, when the author works and builds, then checks and reports operate.

## Edge Cases

- **In-session check cannot run, for example the runtime is missing**: The agent says checks did not run; it does not report success.
- **Dependency links are incomplete**: The full build rerun still covers the whole project.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Changed | US-027-AC1 | Edit note used by 1 claim and 2 citations | Save in session | Results cover the note and dependents |
| Outside edit | US-027-AC2 | Quotation altered in a text editor; old report says pass | Camera-ready build | Reported; build completes |
| Full rerun | US-027-AC3 | Unchanged chapters with saved passes | Reviewer build | All checks recomputed |
| No hooks | US-027-AC4 | Plain folder without hooks or CI | Work and build | Checks run; reports produced |

## Dependencies

- **Stories**: US-026.
- **Feature Spec**: FEAT-007 — Verification and reports
- **Feature Requirements**: FBK-01, FBK-02, BLK-02
- **PRD Requirements**: FR-31
- **External**: A local agent host that runs scripts. Whether each host runs checks automatically on change is unverified. Command line without an AI is FR-49 (FEAT-010).

## Out of Scope

- Installing hooks or CI.
- Checks in chat or cloud sessions.

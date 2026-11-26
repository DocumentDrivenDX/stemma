---
ddx:
  id: US-086
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-010
---

# US-086: See where a release was exercised

**Feature**: FEAT-010 — Plugin, skill, and distribution
**Feature Requirements**: TST-01, TST-02, TST-03, TST-04, TST-05, TST-06
**PRD Requirements**: FR-78
**Priority**: P0

## Story

**As a** Priya, the technologist-researcher
**I want** to run the local install check and read each release's report by host and system
**So that** I know which promised hosts and systems were observed before I rely on a release.

## Context

Project test automation is local first and advisory (ADR-007). A listing or manifest check can succeed while a component is broken. Priya stands in for a technical user who develops against or evaluates a release; the PRD names no maintainer persona.

## Walkthrough

1. During development, Priya runs the local install script.
2. It reports whether the plugin installs and loads in each promised host it can exercise.
3. At a release tag, runs on macOS, Linux, and Windows produce a report.
4. Priya reads which entries passed, failed, or were not observed.

## Acceptance Criteria

- [ ] **US-086-AC1** — Given a promised host available locally, when the project's local script runs during development, then it shows whether the plugin installs and its components load there.
- [ ] **US-086-AC2** — Given a plugin with a seeded broken component that still lists as installed, when the install test runs, then the test reports a failure.
- [ ] **US-086-AC3** — Given a change that is not a release tag, when it is pushed, then no three-system hosted run starts.
- [ ] **US-086-AC4** — Given a release tag with one failing system, when the report is produced, then it shows the failure and automatically blocks nothing.
- [ ] **US-086-AC5** — Given the project's automation, when its jobs and hooks are inspected, then it has no required CI job, commit hook, or paid model call.
- [ ] **US-086-AC6** — Given a promised host or system with no run, when the release report is read, then it is listed as not observed.

## Edge Cases

- **Desktop app with no automated test**: It is checked by hand and recorded, or listed as not observed.
- **Release published despite a failure**: The failure is stated with the release (ADR-007).

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Local run | US-086-AC1 | Developer machine with a command-line host | Run the local script | Install and load result |
| Broken component | US-086-AC2 | Fixture plugin with an invalid hook file | Run the test | Failure reported |
| Ordinary push | US-086-AC3 | Push without a release tag | Observe hosted runs | None starts |
| Advisory failure | US-086-AC4 | Release tag; Windows fails | Read the report | Windows failed; nothing blocked automatically |
| Automation limits | US-086-AC5 | Repository configuration | Inspect | No required check, no commit hook, no model call |
| Unobserved | US-086-AC6 | No Claude desktop run recorded | Read the report | Claude desktop listed as not observed |

## Dependencies

- **Stories**: US-082.
- **Feature Spec**: FEAT-010
- **Feature Requirements**: TST-01, TST-02, TST-03, TST-04, TST-05, TST-06
- **PRD Requirements**: FR-78
- **External**: Hosted runners for release tags. Report format belongs in a Contract or test plan.

## Out of Scope

- Tests of check correctness (FEAT-007).
- Paid model evaluations.

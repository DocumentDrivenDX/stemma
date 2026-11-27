---
ddx:
  id: US-084
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-010
---

# US-084: Adjust persona defaults

**Feature**: FEAT-010 — Plugin, skill, and distribution
**Feature Requirements**: PER-01, PER-02, PER-03
**PRD Requirements**: FR-51
**Priority**: P1

## Story

**As a** Margit, the AI-cautious humanist
**I want** to start with guided defaults and change any of them
**So that** the guidance fits me while every report still shows me the same findings

## Context

Personas differ in comfort with AI and field. Defaults set onboarding, explanation level, and number of checkpoints. They never hide a finding or change when an output is called checked clean.

## Walkthrough

1. Margit starts a project and selects the defaults suited to a cautious author.
2. The skill guides her with that onboarding, explanation level, and number of checkpoints.
3. Later she lowers the explanation level and reduces checkpoints.
4. The skill follows her settings, and reports show the same findings as before.

## Acceptance Criteria

- [ ] **US-084-AC1** — Given a chosen persona default, when Margit starts a project, then onboarding, explanation level, and checkpoint count follow it.
- [ ] **US-084-AC2** — Given any default, when she overrides it, then her value applies.
- [ ] **US-084-AC3** — Given one project with an open finding, when it is built under each persona default, then every report shows the same findings and label.
- [ ] **US-084-AC4** — Given any override of a persona default, when a build runs, then the set of findings is unchanged.

## Edge Cases

- **No persona chosen**: The documented default for the primary persona, the technologist-researcher, applies (assumption).
- **Checkpoints off**: Review marks and annotations still record only what the author says.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Apply default | US-084-AC1 | New project; cautious persona | Start the project | Guided onboarding and its explanation level apply |
| Override | US-084-AC2 | Cautious persona | Set explanation level to brief | Brief explanations are used |
| Same findings | US-084-AC3 | Project with one out-of-range locator | Build camera-ready under each persona | All report it; none checked clean |
| Override keeps findings | US-084-AC4 | Same project; checkpoints off | Build camera-ready | Same report |

## Dependencies

- **Stories**: US-080.
- **Feature Spec**: FEAT-010
- **Feature Requirements**: PER-01, PER-02, PER-03
- **PRD Requirements**: FR-51
- **External**: FEAT-006 (checkpoints, FR-28), FEAT-007 (reports).

## Out of Scope

- The behavior of interpretive checkpoints.
- Voice and style profiles.

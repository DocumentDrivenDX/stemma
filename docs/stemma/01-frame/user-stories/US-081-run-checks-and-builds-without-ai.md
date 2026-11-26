---
ddx:
  id: US-081
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-010
---

# US-081: Run checks and builds without an AI

**Feature**: FEAT-010 — Plugin, skill, and distribution
**Feature Requirements**: CLI-01, CLI-02, CLI-03
**PRD Requirements**: FR-49
**Priority**: P0

## Story

**As a** Priya, the technologist-researcher
**I want** to run the scripted checks and the build from a terminal with no AI
**So that** my own scripts get the same scripted results the agent gets.

## Context

Priya works in git and a terminal and may wire checks into automation of their own. Stemma requires no CI (continuous integration) or commit hook, but the command line must support an author who chooses them. The checks and the basic pilot build arrive in M1 (FR-83); the camera-ready build arrives in M2.

## Walkthrough

1. Priya opens a terminal in their project with no AI host running.
2. They run the scripted checks.
3. The tool reports each result with its evidence and signals whether findings are open.
4. They run the build and get the PDF, report, and label FEAT-008 and FEAT-007 define.

## Acceptance Criteria

- [ ] **US-081-AC1** — Given a project and no AI host or model access, when Priya runs the delivered scripted checks, then they complete and report results.
- [ ] **US-081-AC2** — Given a project and no AI host or model access, when Priya runs a delivered build, then it completes with its report as FEAT-008 specifies.
- [ ] **US-081-AC3** — Given the same project files and tool versions, when checks run from the command line and from the agent, then the scripted results are identical.
- [ ] **US-081-AC4** — Given a project with nothing open, a project with open findings, and a tool that cannot run, when Priya's script runs the command on each, then the script can tell the three outcomes apart.

## Edge Cases

- **Run outside a Stemma project**: The tool says no project was found and reports no result.
- **No network**: Offline checks run; resolver-dependent items follow FR-33.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Checks without AI | US-081-AC1 | Synthetic project; no network; no AI host | Run the checks | Results with evidence |
| Build without AI | US-081-AC2 | Synthetic project with a finding, build delivered | Run a draft build | Draft PDF and report produced |
| Parity | US-081-AC3 | Project with one invented quotation | Run from terminal and from agent | Same failing result and evidence |
| Outcome signal | US-081-AC4 | Clean fixture; fixture with `p. 412` out of range; machine with a wrong runtime version | Run the command on each | Three distinguishable outcomes |

## Dependencies

- **Stories**: US-085
- **Feature Spec**: FEAT-010
- **Feature Requirements**: CLI-01, CLI-02, CLI-03
- **PRD Requirements**: FR-49
- **External**: The command-line Contract owns command names, options, outputs, and exit behavior.

## Out of Scope

- Check rules and result meanings (FEAT-007).
- A supplied CI workflow or commit hook.

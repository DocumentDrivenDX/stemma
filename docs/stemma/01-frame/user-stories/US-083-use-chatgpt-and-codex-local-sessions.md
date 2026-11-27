---
ddx:
  id: US-083
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-010
---

# US-083: Use Stemma in ChatGPT and Codex local sessions

**Feature**: FEAT-010 — Plugin, skill, and distribution
**Feature Requirements**: DST-04
**PRD Requirements**: FR-77
**Priority**: P1

## Story

**As a** Tomasz, the scholar outside the humanities
**I want** to install the Stemma plugin in ChatGPT desktop and work in my local sessions
**So that** I get the same checks and build without changing my assistant.

## Context

This is P1 and does not block the first version. Research read vendor documents only for desktop installation, and found no documented graphical way for a personal account to add a repository marketplace. A command-line plugin listing was observed on one macOS machine.

## Walkthrough

1. Tomasz installs the marketplace plugin in ChatGPT desktop.
2. The plugin sets up what it needs.
3. He opens a local session on his project and runs a scripted check and a build.
4. Both behave as they do in a Claude desktop local Code tab session.

## Acceptance Criteria

- [ ] **US-083-AC1** — Given a clean ChatGPT desktop profile, when Tomasz installs the marketplace plugin, then it installs and the Stemma skill is available in a local session.
- [ ] **US-083-AC2** — Given a local ChatGPT or Codex session, when he runs the scripted checks on shared fixtures, then the results match the command-line results.
- [ ] **US-083-AC3** — Given a local ChatGPT or Codex session, when he runs each delivered mode, then each has the function it has in a Claude desktop local Code tab session.
- [ ] **US-083-AC4** — Given no observed run for a host, when a release is described, then that host is not claimed as supported.

## Edge Cases

- **Host asks to review or trust plugin components**: The install instructions say so; untrusted components are not assumed to run.
- **Cloud session**: No local check or build is promised.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Install | US-083-AC1 | Clean ChatGPT desktop profile | Install the plugin | Skill available |
| Check parity | US-083-AC2 | Seeded fixtures | Run checks in a Codex local session | Same results as the command line |
| Mode parity | US-083-AC3 | Delivered modes | Exercise each mode | Same function as in the Claude desktop Code tab |
| Unobserved host | US-083-AC4 | No ChatGPT desktop run recorded | Read the release statement | ChatGPT desktop listed as not observed |

## Dependencies

- **Stories**: US-081; US-082.
- **Feature Spec**: FEAT-010
- **Feature Requirements**: DST-04
- **PRD Requirements**: FR-77
- **External**: ChatGPT desktop and Codex. Whether a command-line or administrator install is acceptable is an open owner question.

## Out of Scope

- Public directory submission.
- ChatGPT cloud or web sessions.

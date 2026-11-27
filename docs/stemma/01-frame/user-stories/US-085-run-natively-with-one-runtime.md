---
ddx:
  id: US-085
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-010
---

# US-085: Run natively with one runtime

**Feature**: FEAT-010 — Plugin, skill, and distribution
**Feature Requirements**: RUN-01, RUN-02, RUN-03, RUN-04, RUN-05, RUN-06
**PRD Requirements**: FR-75
**Priority**: P0

## Story

**As a** Tomasz, the scholar outside the humanities
**I want** Stemma's tools to run natively on my computer with nothing to install but the plugin
**So that** my checks give the same results as on a collaborator's different system.

## Context

Scholars use macOS, Linux, and Windows. Bun can download a missing package while running, and Bun on macOS uses the system's SQLite, so pinning Bun does not pin everything. Feasibility tests ran only on one macOS machine.

## Walkthrough

1. Tomasz installs the plugin on native Windows.
2. He asks for the scripted checks on his project without a Linux subsystem or Docker.
3. A collaborator runs the same project on macOS with the same tool versions.
4. Both get the same scripted results.

## Acceptance Criteria

- [ ] **US-085-AC1** — Given a supported system with the plugin installed and no runtime installed by the author, when a delivered deterministic tool runs, then the plugin has set up its pinned runtime and the tool runs natively.
- [ ] **US-085-AC2** — Given the same fixtures and tool versions, when they run on macOS, Linux, and Windows, then the scripted results are identical.
- [ ] **US-085-AC3** — Given a product release, when its tool record is inspected, then every tool the product uses has a pinned version recorded.
- [ ] **US-085-AC4** — Given an empty package cache and no network, when a scripted check runs, then it completes without attempting a package download.
- [ ] **US-085-AC5** — Given a missing or different runtime version, when a tool is started, then it says what is wrong and which version is needed.
- [ ] **US-085-AC6** — Given fixtures checked out with different line endings, when the checks run, then the results are identical.
- [ ] **US-085-AC7** — Given native Windows with no Windows Subsystem for Linux (WSL) and no Docker, when each required feature delivered so far is used, then it works without either.

## Edge Cases

- **Project path with spaces or non-Latin characters**: The tools run, or name the path as the cause.
- **A system with no observed run**: It is described as untested.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| One runtime | US-085-AC1 | Native Windows; documented Bun only | Run the checks | Checks complete |
| Three systems | US-085-AC2 | Seeded fixture set | Run on all three systems | Zero differing results |
| Pinned tools | US-085-AC3 | Release tool record | Compare with tools invoked | No unrecorded or unpinned tool |
| No downloads | US-085-AC4 | Empty cache; network disabled | Run the checks | Complete; no download attempt |
| Wrong version | US-085-AC5 | A Bun version other than the pin | Run a check | Plain message names required version |
| Line endings | US-085-AC6 | Same fixture with LF and CRLF line endings | Run checks on each | Identical results |
| No WSL or Docker | US-085-AC7 | Windows without both | Run delivered required features | All run |

## Dependencies

- **Stories**: None.
- **Feature Spec**: FEAT-010
- **Feature Requirements**: RUN-01, RUN-02, RUN-03, RUN-04, RUN-05, RUN-06
- **PRD Requirements**: FR-75
- **External**: Bun. Typst and other build tools arrive with their features. The pinned version is a design choice; Linux and Windows are untested.

## Out of Scope

- Installing anything on the author's system: the plugin sets up its pinned tools only in its own data directory.
- Shipping compiled programs as the supported route.

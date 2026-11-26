---
ddx:
  id: stemma.adr-007
  type: adr
  activity: design
  authoring:
    home: repo
  depends_on:
    - stemma.prd
    - stemma.concerns
---

# ADR-007: Project test automation is local first and never blocks work

## Problem

The scripted tools must run on three systems, and the plugin in its promised
hosts (FR-75, FR-78).
Several HELIX library concerns expect required CI and commit-hook gates, whose
cost and blocking the owner rejects.

## Decision

We will run the project's tests, lint, and install checks locally during
development. Hosted runs on macOS, Linux, and Windows happen only for release
tags and are advisory. Stemma's repository requires no CI job and no commit hook,
and its automation makes no paid model calls. A failing result is still a defect
to fix or to state at release.

Each function is tested end to end through the command line first. A web
interface is then tested with Playwright, which drives it in a real browser
against the built bundle. No Playwright test or browser tool is added until
there is a web interface to test.

## Why We Chose This

### Over required checks on every change
They add cost and block forward progress.

### Over advisory runs on every change
They give earlier warning at the price of more runs and noise.

### Over local testing only
Linux and Windows would stay untested unless someone ran them by hand.

## Consequences

**Good**: Work is not blocked or billed by automation.

**Trade-offs**: A defect on another system can stay hidden until a release tag.
Desktop apps need manual checks.

**Drift signals to watch**: A required status check; a scheduled or per-change
matrix; a released system with no observed run.

## Concern Impact

- **Override / deviation**: Changes where the quality gates of `typescript-bun`,
  `testing`, `verification`, `modularity-and-encapsulation`,
  `code-shape-ceilings`, `e2e-playwright`, `a11y-wcag-aa`, and
  `security-owasp` run. `concerns.md` lists each override.

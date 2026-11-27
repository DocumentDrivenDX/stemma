---
ddx:
  id: US-082
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-010
---

# US-082: Install in Claude desktop

**Feature**: FEAT-010 — Plugin, skill, and distribution
**Feature Requirements**: DST-01, DST-02, DST-03, DST-05, RUN-05, DST-06
**PRD Requirements**: FR-50
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist
**I want** to add Stemma from a marketplace in Claude desktop
**So that** I can run its checks on my own computer by installing the plugin and nothing else.

## Context

The first version promises full function only in the local Code tab of Claude desktop. A plugin may load elsewhere where local tools cannot run, and Margit must not mistake guidance there for a check.

## Walkthrough

1. In Claude desktop she adds the DocumentDrivenDX marketplace (the DocumentDrivenDX/plugins repository) and installs the Stemma plugin.
2. She starts a local Code tab session on her project and asks for a check.
3. Claude says it is setting the plugin up, and she allows it if asked.
4. A scripted check runs.

## Acceptance Criteria

- [ ] **US-082-AC1** — Given a clean profile in Claude desktop and the DocumentDrivenDX marketplace, when Margit installs the plugin, then it loads in a local Code tab session and the Stemma skill is available.
- [ ] **US-082-AC2** — Given the plugin is installed and no Bun is on the computer's search path, when she asks for a scripted check in a local Code tab session, then the plugin sets up its pinned runtime without any step of hers beyond the host's permission prompt, and the check runs on her computer and reports results.
- [ ] **US-082-AC3** — Given a session that does not run on her computer, when she asks for a check or build, then Stemma says it makes no promise there and reports no check result it did not run.
- [ ] **US-082-AC4** — Given setup fails or is declined, when she asks for a scripted check, then a plain-language message names the problem and says nothing was checked, and she is not asked to install anything by hand.
- [ ] **US-082-AC5** — Given the published product description, when an author reads which sessions are supported, then it promises full function only for Claude desktop's local Code tab and says command-line results do not verify the desktop app.
- [ ] **US-082-AC6** — Given the published product description, when an author reads about local models, then it calls their use an unsupported experiment that is not blocked, promised, or tested.
- [ ] **US-082-AC7** — Given a release, when Margit installs from the DocumentDrivenDX marketplace, then the release's command line is delivered in `plugins/stemma` of the marketplace repository and runs, although it is not committed to the Stemma repository.

## Edge Cases

- **Organization blocks added marketplaces**: The install instructions say an administrator may control this.
- **Plugin loads but the host blocks scripts**: The check is reported as not run, never as passed.
- **Linux**: No desktop-app integration is promised in v1; the local tools and command line are the target there.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Install | US-082-AC1 | Clean Claude desktop profile | Add the marketplace and install | Plugin loads in the Code tab |
| Local check | US-082-AC2 | Synthetic project; documented Bun version | Ask to verify | Scripted results appear |
| Non-local session | US-082-AC3 | Session with no access to the author's computer | Ask to verify | No result; limit stated |
| Setup fails | US-082-AC4 | No Bun and no network | Ask to verify | Message names the failed setup and says nothing was checked; no pass |
| Support statement | US-082-AC5 | Release description | Read the support statement | Only the desktop local Code tab is promised |
| Local models | US-082-AC6 | Release description | Read the support statement | The three limits are stated; no support claimed |
| Bundle delivery | US-082-AC7 | Clean profile; tagged release | Install; run a check | Command line present and runs; repository holds no bundle |

## Dependencies

- **Stories**: US-085
- **Feature Spec**: FEAT-010
- **Feature Requirements**: DST-01, DST-02, DST-03, DST-05, RUN-05, DST-06
- **PRD Requirements**: FR-50
- **External**: Claude desktop and a plugin marketplace. Plugin manifest surfaces belong in Contracts. Desktop installation is unverified.

## Out of Scope

- ChatGPT and Codex (US-083).
- Listing in an official directory, which comes after v1.

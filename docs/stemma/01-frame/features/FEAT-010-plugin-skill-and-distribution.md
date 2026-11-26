---
ddx:
  id: FEAT-010
  type: feature-specification
  activity: frame
  authoring:
    home: repo
  depends_on:
    - stemma.prd
    - stemma.concerns
    - stemma.feature-registry
---

# Feature Specification: FEAT-010 — Plugin, skill, and distribution

**Feature ID**: FEAT-010
**Priority**: P0
**Owner**: product owner
**Covered PRD Subsystem(s)**: 10. Plugin, skill, and distribution
**Covered PRD Requirements**: FR-48, FR-49, FR-50, FR-51, FR-75, FR-77, FR-78
**Cross-Subsystem Rationale**: None — single subsystem.

## Overview

This feature is how an author gets Stemma and reaches its capabilities: one
plugin, one skill with modes, and command-line tools on the Bun runtime. It
also covers the evidence that the plugin installs where Stemma promises it.

## Ideal Future State

An author on macOS, Linux, or Windows installs one documented runtime version
and runs Stemma's local tools. On macOS and Windows they add the Stemma plugin
to Claude desktop from a marketplace; v1 makes no desktop-app promise on Linux. They state what they want in
plain language, and the one skill takes them to the matching mode. The scripted
checks and the build give the same results from the command line without an AI.
For each release, the author can see which systems and hosts were exercised,
which failed, and which are untested.

## Problem Statement

- **Current situation**: Authors who check AI output use hand-built registers
  and their own scripts. Research found no script runtime that every plugin host
  guarantees.
- **Pain points**: A cautious author cannot manage prompts and scripts. A
  technical author needs checks that run without an AI. A plugin can install in
  a host and still be unable to run its tools there.
- **Desired outcome**: A local Code tab session of Claude desktop on a supported system runs
  Stemma's modes, checks, and build, and every support claim traces to an
  observed run.

## Functional Areas

| Area | User question or job | Feature responsibility |
|------|----------------------|------------------------|
| Skill and modes | How do I ask Stemma to do something? | One public skill that routes to modes |
| Command line | Can I check and build without an AI? | The same scripted checks and build outside an agent |
| Runtime | What must I install? | One pinned Bun version and recorded tools on three systems |
| Hosts and distribution | Where does it work? | Marketplace install and a stated promise per host |
| Persona defaults | How much guidance do I get? | Overridable onboarding, explanation, and checkpoint defaults |
| Install evidence | Was it tried on my system? | Local and release-tag install and load tests with honest reports |

A **host** is an application that loads the plugin. A **local session** runs on
the author's computer. A **mode** is a route inside the one skill and is not a
separate skill. A **promised host** has a support statement; a host that only
installs the plugin gets none.

## Task Model

N/A — the tasks are traced in the user stories.

## Requirements

### Functional Requirements by Area

#### Skill and modes (FR-48)

- SKL-01. The system must ship exactly one public skill.
- SKL-02. The skill must provide modes that cover starting a project, takeover,
    research, notes, outlining, drafting, voice and style, verification,
  building, audit, and review.
- SKL-03. The skill must route a plain-language request to the matching mode.
- SKL-04. When the feature behind a mode has not been delivered, the skill must
  say that the mode is unavailable and must not imitate its checks or outputs.
- SKL-05. A mode that runs a scripted check or build must report the result as
  the tool gave it; FEAT-007 owns result meaning.
- SKL-06. The skill must treat text from sources and imported files as data and
  never as instructions.

#### Command line (FR-49)

- CLI-01. The system must run every delivered scripted check and build from a
  command line with no AI host and no model.
- CLI-02. For the same project files and tool versions, a command-line run must
  give the same scripted results as a run started from the agent.
- CLI-03. A command-line run must let a script distinguish a run with nothing
  open, a run with open findings, and a tool that could not run. Stemma itself
  must not treat open findings as a reason to stop.

#### Runtime and portability (FR-75)

- RUN-01. Deterministic scripts and tools must run natively on macOS, Linux, and
  Windows. No required feature may need the Windows Subsystem for Linux (WSL) or
  Docker.
- RUN-02. An author must need to install only one runtime, one documented Bun
  version.
- RUN-03. Every other tool the product uses must be pinned to a version and
  recorded.
- RUN-04. A run must not download a package at run time. Stemma installs
  nothing unless the author asks.
- RUN-05. When the runtime or a pinned tool is missing or at another version,
  the system must say what is wrong and what to install, in plain language.
- RUN-06. Results must not depend on platform line endings, file-system case
  behavior, shell, or an unrecorded system library version.

#### Hosts and distribution

- DST-01. Stemma must be published as a plugin in the project's repository
  marketplace and install from it in Claude desktop (FR-50). An official
  directory listing comes later.
- DST-02. The first version must promise full function only in the local Code
  tab of Claude desktop (FR-50), with no desktop-app integration promised on
  Linux, where the local tools and command line are the target. The Claude command-line tool may be used as a
  test harness; its results do not verify the desktop app.
- DST-03. The product must state that other sessions get no promise of local
  checks or builds, and a session that cannot run them must not report results
  as if it had (FR-50).
- DST-04. The marketplace plugin must install in ChatGPT desktop and give full
  function in ChatGPT and Codex sessions that run on the author's computer
    (FR-77, P1). Until that is observed, no such support is claimed. FR-77 delays
  neither the pilot nor the first Claude release.
- DST-06. The bundled command line must not be committed to the Stemma
  repository. It must ship in release packages, and the repository marketplace
  install must deliver it (FR-50). If the marketplace cannot deliver release
  packages, a separate distribution repository for built files may be used.
  That delivery is untested.
- DST-05. The product must describe use with a local model as an unsupported
  experiment: not blocked, not promised, and not tested (PRD Non-Goals; FR-50
  promises Claude desktop's local Code tab only).

#### Persona defaults (FR-51, P1)

- PER-01. Persona defaults must set onboarding, explanation level, and number of
  checkpoints.
- PER-02. The author must be able to override every default.
- PER-03. No persona default or override of one may hide a finding or change
  when an output is called checked clean.

#### Install evidence (FR-78)

- TST-01. The project's tests must show that the plugin installs and loads in
  each promised host.
- TST-02. A local script must run these tests during development.
- TST-03. Tests on macOS, Linux, and Windows must run only for release tags, and
  their results must be advisory and stop no work.
- TST-04. Project automation must use no required CI (continuous integration)
  job, no commit hook, and no paid model call (ADR-007).
- TST-05. The test report must list each promised host and supported system as
  passed, failed, or not observed. A desktop host with no automated test must be
  checked by hand or listed as not observed.
- TST-06. A successful manifest validation or plugin listing alone must not be
  reported as proof that the plugin's components load or run.

### Non-Functional Requirements

- **Reliability**: On shared fixtures, command-line and agent-started runs differ
  in 0 scripted results. Across the three systems they differ in 0 results; a
  system with no observed run is reported as not observed.
- **Security**: A run of the scripted checks or the build makes 0 package
  downloads.
- **Cost**: Project test automation makes 0 paid model calls.
- **Process**: The Stemma repository has 0 required CI checks and installs 0
  commit hooks, in its own repository and in authors' projects.
- **Performance**: N/A — the PRD sets no target for this feature.

## User Stories

- [US-080 — Reach every mode through one skill](../user-stories/US-080-reach-modes-through-one-skill.md)
- [US-081 — Run checks and builds without an AI](../user-stories/US-081-run-checks-and-builds-without-ai.md)
- [US-082 — Install in Claude desktop](../user-stories/US-082-install-in-claude-desktop.md)
- [US-083 — Use Stemma in ChatGPT and Codex local sessions](../user-stories/US-083-use-chatgpt-and-codex-local-sessions.md)
- [US-084 — Adjust persona defaults](../user-stories/US-084-adjust-persona-defaults.md)
- [US-085 — Run natively with one runtime](../user-stories/US-085-run-natively-with-one-runtime.md)
- [US-086 — See where a release was exercised](../user-stories/US-086-see-where-a-release-was-exercised.md)

## Edge Cases and Error Handling

- **Runtime installed but not visible to a desktop app**: The failure names the
  runtime and how to make the host see it. It does not report a check result.
- **Host sandbox blocks a script**: The session reports that the check did not
  run. A check that did not run is never reported as passed.
- **Chat or cloud session**: The skill states that local checks and builds are
  not promised there.
- **Install without the rights to add a marketplace**: The install instructions
  state that an organization may control which marketplaces its users can add.
- **Paths with spaces or non-Latin characters**: Tools run on such project
  paths, or report the path as the cause.

## Success Metrics

N/A — the PRD success metric for matching results across systems covers this
feature.

## Constraints and Assumptions

- TypeScript on Bun only; other tools are allowed when pinned and recorded
  (ADR-004). Feasibility tests used Bun 1.4.5; design chooses the pinned version.
- Local-first, advisory project testing follows ADR-007.
- Delivery order: FR-49, FR-50, FR-75, and FR-78 precede other features. FR-48
  routes to each feature as it arrives.
- Assumption (PRD): "outlining" is a mode of its own within FR-48.
- **Assumption**: SKL-04 and DST-03 apply the `honest-assurance` and
  `plugin-distribution` concerns to modes and sessions the product cannot serve.
- **Risk**: A marketplace that installs a git reference does not by itself
  deliver a bundle that exists only in release packages. How the install does so
  is a design question, and untested.
- **Unverified**: One repository layout installed and listed in the Claude Code
  and Codex command-line tools on one macOS machine. Desktop apps, Linux,
  Windows, and hooks in a live session were not tested.
- **Risk**: Which Claude desktop session types run on the author's computer and
  can run local scripts is not verified. Research read vendor documents that
  describe some task types running remotely or in a virtual machine.
- **Risk**: A host sandbox or app search path may prevent finding or installing
  Bun. Bun installs missing packages by default unless a run disables it.

## Dependencies

- **Other features**: None for the runtime, command line, packaging, and install
  tests. Each mode depends on the feature it routes to (FEAT-001, FEAT-002 to
  FEAT-009, FEAT-014, FEAT-015).
- **External services**: Claude desktop, a plugin marketplace, Bun; for FR-77,
  ChatGPT desktop and Codex. Exact command, manifest, and result surfaces belong
  in Contracts.
- **PRD requirements**: P0: FR-48, FR-49, FR-50, FR-75, FR-78 (M1). P1: FR-51,
  FR-77.

## Out of Scope

- What each mode does: the owning feature specifies it.
- Full function or a promise of local checks in chat or cloud sessions.
- Supporting or testing local models, and an official directory listing in v1.
- Separate public Stemma skills per mode.
- A second script runtime or shipped compiled programs as a supported route.
- Requiring authors to run CI or a commit hook.
- An access control for AI roles (FEAT-001, FR-5 records roles as guidance).

## Open Questions

- [ ] Is a command-line or administrator install acceptable for ChatGPT desktop?
  Blocks FR-77; product owner after a hands-on test (PRD).

- [ ] How does the repository marketplace install deliver the release package?
  Blocks DST-01 and DST-06; design owner, untested (PRD).

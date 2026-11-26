---
ddx:
  id: SD-010
  type: solution-design
  activity: design
  authoring:
    home: repo
  depends_on:
    - FEAT-010
    - stemma.prd
    - stemma.concerns
    - stemma.architecture
    - stemma.adr-001
    - stemma.adr-003
    - stemma.adr-004
    - stemma.adr-007
    - CONTRACT-002
    - CONTRACT-004
---

# Solution Design: SD-010 Plugin, skill, and distribution

**Feature**: [[FEAT-010]] | **Artifact**: `docs/stemma/02-design/solution-designs/SD-010-plugin-skill-and-distribution.md`

## Scope

- Covers the runtime, the bundled command line, the plugin and its one skill, release packages, install delivery, and install tests.
- Governed by the Architecture, ADR-001, ADR-003, ADR-004, ADR-007, CONTRACT-002 (commands, reports, exit codes), CONTRACT-004 (plugin, modes, agent obligations, host claims), and Project Concerns.
- M1, first in the design order. A first part is built: the runtime guard, the bundle script, part of the command line, and a local load script that installs a locally built tree with the Claude command-line tool. Install and host behaviour below is otherwise unverified unless a row says so.

## Requirements Mapping

### Functional Requirements

FEAT-010 identifiers carry the PRD requirement in parentheses.

| Requirement | Technical Capability | Component | Priority |
|---|---|---|---|
| SKL-01 to SKL-03 (FR-48) | One skill file routes to one file per mode | Skill | P0 |
| SKL-04 to SKL-06 (FR-48) | Delivery table in the skill, exit 2 backstop, relay and data-not-instruction rules | Skill, command line | P0 |
| CLI-01 to CLI-03 (FR-49) | One bundle for terminal and agent; distinct exit codes | `cli` | P0 |
| CLI-04, CLI-05 (FR-49) | Each function is a command over a core operation that interfaces also use | `cli`, `core` | P0 |
| RUN-01 to RUN-06 (FR-75) | One pinned Bun, tool record, no run-time packages, platform rules | Runtime guard, bundler, release check | P0 |
| DST-01, DST-06 (FR-50) | Self-contained release package delivered by the repository marketplace | Packager, manifests | P0 |
| DST-02, DST-03, DST-05 (FR-50) | Support statement and skill wording per session type | Skill, README, release report | P0 |
| DST-04 (FR-77) | Same package; claim withheld until observed | Manifests | P1 |
| PER-01 to PER-03 (FR-51) | Persona settings read by the skill only | Skill, project settings | P1 |
| TST-01 to TST-06 (FR-78) | Local and release-tag install and load script with a three-state report | Install harness | P0 |

### NFR Impact on Architecture

| NFR | Requirement | Architectural Impact | Design Decision |
|---|---|---|---|
| Reliability | 0 differing scripted results between agent and terminal, and across systems | One execution path | The skill runs the same bundle with the same options; the report records tools and inputs. A system with no run is "not observed" |
| Security | 0 package downloads during checks or builds | No run-time resolution | Every library is bundled; invocation uses `--no-install` (CONTRACT-002 A) |
| Cost | 0 paid model calls in automation | No model in tests | The harness drives host command-line tools and the bundle only |
| Process | 0 required CI checks, 0 commit hooks | Local-first | One local check command; tag workflow is advisory (ADR-007) |

## Solution Approaches

The open choice is how a repository marketplace install delivers a bundle that is not in git.

### Approach 1: Commit the bundle to the repository

**Pros**: A plain git marketplace source delivers a runnable plugin.
**Cons**: A built file in git.
**Evaluation**: Rejected by owner decision. A release branch in the Stemma repository is the same thing and is rejected too.

### Approach 2: Fetch the bundle on first run

**Pros**: The git source stays small.
**Cons**: The installed plugin downloads code while in use, needs network, and runs it. CONTRACT-004 A requires an installed plugin to run without downloading packages.
**Evaluation**: Rejected.

### Approach 3: Release package that is the whole plugin, delivered by the marketplace entry

**Description**: A release script builds one directory tree holding the manifests, skill, templates, bundle, and bundle assets. The repository marketplace entry points at that released tree.
**Pros**: Meets the owner decision; install is atomic; skill and bundle share one version.
**Cons**: No delivery mechanism has been shown to work in Claude desktop. The current entry is a git reference to the repository, which would deliver no bundle.
**Evaluation**: Selected for the package. The pointing mechanism stays open (PRD open question).

**Selected Approach**: Approach 3. Everything except the marketplace entry is independent of the mechanism, so the proof below can run first and change only the entry and the publish step.

**Delivery proof (S-DIST, before dependent M1 work)**. The proof tries mechanisms in this order and stops at the first that passes. The order is a design proposal. None is claimed to be supported.

| Candidate | What must be learned | Concern |
|---|---|---|
| A marketplace source that names a versioned release archive | Whether Claude desktop accepts such a source at all | Not shown by research |
| A marketplace source that names a package-registry release | Desktop support, and whether the author needs a second tool such as npm | A second install would conflict with RUN-02 |
| A git source naming a separate distribution repository that holds release trees | Whether Claude desktop installs it and updates skill and bundle together | Allowed by owner decision when the marketplace requires git; the Stemma repository still holds no built file |

Pass criteria, from an empty profile in a Claude desktop local Code tab session: add the repository marketplace, install, list exactly one skill, and run `doctor` and `check` from the delivered bundle with network denied after install. Updating to a second version must replace skill and bundle together. A manual archive upload does not pass, because FR-50 requires a repository marketplace install. If no candidate passes, FR-50 cannot be met and the owner decides what changes.

**Architecture/ADR impact**: No change now. The proof result is recorded in the Architecture, and in an ADR if the distribution repository is used.

## Domain Model

```mermaid
erDiagram
    RELEASE ||--|| RELEASE_PACKAGE : publishes
    RELEASE_PACKAGE ||--|| BUNDLE : holds
    RELEASE_PACKAGE ||--|| SKILL : holds
    RELEASE_PACKAGE ||--|| TOOL_RECORD : holds
    SKILL ||--|{ MODE : routes
    MARKETPLACE_ENTRY ||--|| RELEASE : selects
    RELEASE ||--o{ OBSERVATION : "exercised by"
```

An **observation** is one result for a host and operating system: passed, failed, or not observed. A **tool record** lists each pinned tool and version.

### Business Rules

- **BR-1001** — One version: the plugin manifest, marketplace entry, skill, bundle, and prompts of a release carry one version. The release script fails on a mismatch.
- **BR-1002** — No built file in git: `dist/` is ignored, and the local check fails if a built bundle is tracked.
- **BR-1003** — Self-contained package: the bundler fails if an import stays unresolved at run time. A library data file (fonts, character maps, workers) ships inside the package and is loaded by a package-relative path.
- **BR-1004** — Readable bundle: the bundle is unminified. Bundled third-party licenses ship with it. The citeproc-js license review precedes the first package that contains it (ADR-005).
- **BR-1005** — One pin: one source file states the Bun version. The runtime guard, `doctor`, the tool record, the install instructions, and the harness all derive from it. The first pin is Bun 1.4.5 (Architecture assumption).
- **BR-1006** — Guard first: the version guard runs before any command work. A wrong version exits 4 and names the found version, the required version, and the install instructions.
- **BR-1007** — Missing runtime: the bundle cannot report that Bun is absent. The skill and install instructions own that message: nothing was checked, how to install, and how to make a desktop app find Bun. A terminal user without Bun sees only the shell's error.
- **BR-1008** — Runtime lookup: the skill tries `bun` on the search path, then Bun's documented per-user install location, and then stops. It installs nothing unless the author asks (CONTRACT-004 D).
- **BR-1009** — Mode availability: `SKILL.md` marks each mode delivered or not in the shipped version. A release marks a mode delivered only when its commands are implemented; a package test compares the two. An unimplemented command exits 2.
- **BR-1010** — Platform neutrality: scripts are TypeScript run by Bun. The bundle builds paths with platform functions, passes subprocess arguments as lists, sorts by code point, and depends on no shell or locale. Record normalization is SD-011's.
- **BR-1011** — Observed claims only: a listing or manifest validation never yields "passed". "Passed" requires that the installed skill is loadable and the delivered command line ran.
- **BR-1012** — Persona isolation: no persona value reaches the check engine's findings or label rule. `core` takes no persona input for either.

## System Decomposition

### Component: Skill (`skills/stemma`)

- **Purpose**: The one public entry for agent hosts.
- **Responsibilities**: Route by first argument or wording and ask when two modes fit; state unavailable modes; run `doctor` first; state that only Claude desktop's local Code tab carries the full-function promise; describe local models as an unsupported experiment; hold the obligations of CONTRACT-004 C and the versioned support prompt.
- **Requirements Addressed**: SKL-01 to SKL-06, DST-02, DST-03, DST-05, PER-01, PER-02.
- **Interfaces**: Runs the command line only (CONTRACT-002; CONTRACT-004).
- **Owned by TDs**: US-080, US-082, US-083, US-084. Each mode's dialogue belongs to the owning feature's design.

Stemma does not enforce these instructions against an agent with file access (CONTRACT-004 C). Relaying a result faithfully and treating source text as data are instructions, not controls.

### Component: Command-line shell and runtime guard (`packages/cli`)

- **Purpose**: One composition root for every caller.
- **Responsibilities**: Guard the version; parse arguments; read environment variables in one environment module with one schema; construct adapters; map outcomes to exit codes; answer unimplemented commands.
- **Requirements Addressed**: CLI-01 to CLI-05, RUN-02, RUN-05.
- **Interfaces**: CONTRACT-002.
- **Owned by TDs**: US-081, US-085.

A desktop app can start with a different environment from a terminal. If a store directory variable differs, results can differ because one run cannot find blobs. `doctor` shows the resolved paths, and a missing blob is `unverifiable`, never a pass.

### Component: Bundler and release packager (`scripts/`)

- **Purpose**: Turn the workspace into a release package.
- **Responsibilities**: Generate code from the record schema (SD-011); bundle; copy assets, skill, manifests, and templates; write the tool record; check versions, unresolved imports, tracked build output, and licenses.
- **Requirements Addressed**: RUN-03, RUN-04, DST-01, DST-06.
- **Interfaces**: Package layout in CONTRACT-004 A.
- **Owned by TDs**: US-082, US-085.

The tool record covers every tool and bundled library that can change a result, including Typst and extraction libraries. `doctor` compares installed external tools with it. SQLite is only reported, since Bun uses the system library on macOS (ADR-004).

### Component: Install harness (`scripts/`)

- **Purpose**: Evidence that a release installs and loads.
- **Responsibilities**: Install into a throwaway host profile; list skills; run the installed bundle on a seeded project with network denied where the system allows; report each promised host on each system.
- **Requirements Addressed**: TST-01 to TST-06.
- **Interfaces**: Reads host command-line output; runs CONTRACT-002 commands.
- **Owned by TDs**: US-086.

The harness runs locally during development and in one workflow triggered only by release tags, which stops nothing. A desktop app with no automated route gets a recorded hand check or "not observed". A seeded broken component that still lists as installed must produce "failed". In the tested Claude Code version, folder validation missed broken hooks and manifest validation caught them; the harness still requires a load and run.

**Runtime configuration.** On Bun 1.4.5 (macOS), `bunfig.toml` and `.env` in the working directory were loaded even with `--no-install`; adding `--no-env-file --config=/dev/null` stopped both. The invocation uses all three flags, starts in the plugin root, and passes absolute paths (CONTRACT-002 A); the guard exits 4 without `--no-install`. A seeded-file test covers SEC-014. Windows is untested. The author's own global Bun settings and environment, such as `BUN_OPTIONS`, are outside this control.

**Release integrity and delivery.** Each release publishes one release package with its version and SHA-256. The install proof compares the installed bundle with that digest (SEC-028), and the marketplace manifest claims no delivery it does not perform: today it says the command line is not delivered. A digest from the same publisher does not protect against a compromised publisher account. Claude's command-line tool may drive repeatable install tests; its results are recorded as command-line observations and never as desktop ones.

### Component Interactions

```mermaid
graph TD
    Source["Repository source"] --> Packager
    Packager --> Package["Release package"]
    Entry["Marketplace entry"] -.->|"unproven delivery"| Package
    Package --> Host["Agent host plugin cache"]
    Host --> Skill
    Skill -->|"bun --no-install"| CLI["Bundle: guard then commands"]
    Terminal["Author or script"] --> CLI
    Harness --> Host
    Harness --> CLI
```

## Technology Rationale

| Layer | Choice | Why | Alternatives Rejected |
|---|---|---|---|
| Bundling | Bun's bundler, unminified, one entry file plus package assets | No second build tool; authors and reviewers can read the output | Compiled per-system executables: not a supported route (FEAT-010 Out of Scope) |
| Environment validation | One schema in the environment module (`typescript-bun`) | One place reads the environment | Reads scattered across packages |

Layered configuration files from `typescript-bun` are not used: CONTRACT-002 fixes precedence among options, environment, and `stemma.json`. The runtime choice is ADR-004.

## Traceability

| Requirement ID | Component | Design Element | Test Strategy |
|---|---|---|---|
| SKL-01 | Skill | BR-1001 | Installed package lists one skill |
| SKL-02, SKL-03 | Skill | Mode files | Hand-run request script per mode in a live session; not automatable without model calls |
| SKL-04 | Skill, `cli` | BR-1009 | Package test of table against commands; hand check of wording |
| SKL-05, SKL-06 | Skill | CONTRACT-004 C | Hand check with a seeded failing result and a source containing instructions |
| CLI-01, CLI-02 | `cli` | One bundle | Same fixtures from terminal and harness; compare report bodies |
| CLI-03 | `cli` | CONTRACT-002 I | Nothing-open, open-findings, and missing-tool fixtures |
| CLI-04 | `cli` | CONTRACT-002 B | Command-line end-to-end test per function; then a Playwright test of the same function against the built interface (ADR-007) |
| CLI-05 | `core` | Architecture, Command line first | Boundary check; review |
| RUN-01, RUN-06 | `cli`, packager | BR-1010 | Seeded set with CRLF checkout, spaced and non-Latin paths; three systems on tags |
| RUN-02, RUN-05 | Guard, skill | BR-1005 to BR-1008 | Wrong-version fixture; missing-Bun hand check in a desktop app |
| RUN-03 | Packager | Tool record | Inspect record against lockfile and `doctor` |
| RUN-04 | Packager | BR-1003 | Empty package cache, network denied |
| DST-01, DST-06 | Packager, manifests | BR-1002, S-DIST | S-DIST pass criteria |
| DST-02, DST-03, DST-05 | Skill, README | Support statement | Read published text; hand check in a non-local session |
| DST-04 | Manifests | No claim until observed | ChatGPT desktop and Codex hand test (P1) |
| PER-01, PER-02 | Skill | Persona settings | Override fixtures (P1) |
| PER-03 | `core` | BR-1012 | Same findings and label under every persona |
| TST-01, TST-02, TST-05, TST-06 | Harness | BR-1011 | Seeded broken component; report states |
| TST-03, TST-04 | Harness, workflow | ADR-007 | Inspect triggers, hooks, and jobs |

### Gaps

- [ ] DST-01 and DST-06: delivery is unproven. S-DIST is the mitigation.
- [ ] RUN-01: nothing has run on Linux, Windows, or any desktop app. Those cells stay "not observed". On Linux the harness exercises the command line only; no desktop-app integration is promised there in v1.
- [ ] RUN-05: no tool can report a missing Bun from a bare terminal (BR-1007).
- [ ] RUN-03: how Typst reaches a non-technical author is undecided; Stemma installs nothing unless the author asks.
- [ ] RUN-03: no contract defines the tool record, which `doctor` compares with installed tools.
- [ ] PER-01 and PER-02: `Project.persona` (CONTRACT-001) holds name, explanation level, and checkpoints only; any further persona default needs a field before the P1 work.
- [ ] The ChatGPT install route stays open (FEAT-010).

## Concern Alignment

- **Concerns used**: `plugin-distribution`, `typescript-bun`, `cross-platform`, `honest-assurance`, `lightweight-verification`, `modularity-and-encapsulation`, `hexagonal-architecture`, `security-owasp`, `verification`, `testing`, `code-shape-ceilings`.
- **Constraints honored**: Strict TypeScript, `bun:test`, Biome, committed `bun.lock`, shape ceilings, and `bun run check:boundaries` sit in one local check command. The checker and its allowed and forbidden cases precede feature code. A dependency audit and secret scan run before a release. Only `cli` names concrete adapters.
- **ADRs referenced**: ADR-001, ADR-003, ADR-004, ADR-007.
- **Departures**: Only the recorded overrides (ADR-007): no required CI job and no commit hook.

Diagnostic flow: N/A, `o11y-otel` is not selected; `doctor` and command output are the diagnostics.

## Schema Basis

The domain model above only explains release concepts and adds no record kind. Plugin and marketplace manifests keep each host's native format, so UMF is not used for them (CONTRACT-004). No UMF definition was inspected for the release concepts. The tool record becomes a structured interface once `doctor` reads it; its shape needs a contract addition that records the UMF inspection.

## Constraints & Assumptions

- **Constraints**: The first version needs no host hook (CONTRACT-004 E). Required features need no WSL or Docker.
- **Assumptions**: A host lets the skill run a Bun process on the author's computer; if not, that host gets no full-function claim. Package size stays within host plugin limits; research read limits of 200 MB and 5,000 files, unverified here.
- **Dependencies**: Claude desktop and its marketplace, Bun, git hosting for releases.

## Risks

| Risk | Prob | Impact | Mitigation |
|---|---|---|---|
| No marketplace mechanism delivers a release package in Claude desktop | M | H | Run S-DIST first; owner decides if all candidates fail |
| A desktop app or sandbox cannot find or run Bun | M | H | BR-1008; hand check per system; claim only observed cells |
| A bundled library needs files or native code that bundling breaks | M | M | BR-1003; run extraction and citation fixtures from the installed package |
| The skill claims a check ran, or paraphrases a result | M | H | CONTRACT-004 C; hand checks; the author can rerun from a terminal; not enforceable |
| A defect on another system appears only at a release tag | H | M | Advisory three-system run; state failures with the release (ADR-007) |

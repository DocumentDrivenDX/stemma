---
ddx:
  id: stemma.security-requirements
  type: security-requirements
  activity: frame
  authoring:
    home: repo
  depends_on:
    - stemma.prd
    - stemma.concerns
---

# Security Requirements

**Project**: Stemma
**Date**: 2026-11-26
**Security Champion**: unassigned (open question)

## Overview

Stemma runs on the author's computer: a skill in an agent host, a command line, a
project of plain files, two private stores, and static browser outputs. It has no
server, account, or hosted database. The requirements protect the author's
machine from hostile input, keep material marked as protected out of outputs Stemma generates and report what it cannot remove,
protect the tool supply chain, and keep assurance claims honest. Threats and
STRIDE owners (spoofing, tampering, repudiation, information disclosure, denial
of service, elevation of privilege) are in the [threat model](threat-model.md).

By owner decision (ADR-003), no finding blocks work or a build: edits to
verdicts and review marks are not prevented, no source is gated from a hosted
model, and stray restricted coordinates, protected text that cannot be removed,
image problems, and unsupported claims are reported. Excluding structured
restricted values and redacting outputs is how outputs are built. No
requirement here adds a build block, commit hook, or required CI (continuous
integration) job.

Basis in the matrix: **G** is already required by the PRD, a contract, an ADR,
or a selected concern. **P** is proposed here under the `security-owasp` concern.
Each P item is an assumption until the owning design or contract accepts it.

## Required Controls

Each item states its acceptance criterion.

### Authentication

- **SEC-001**: A search of a seeded project, release package, and repository
  finds no Stemma account, token, or credential. No command asks for a password.
- **SEC-002**: Every user-facing text about review marks, annotations,
  confirmations, restriction marks, and support verdicts, including the disclosure, calls them
  records and not proof of who acted or verification of support.

### Authorization

Stemma cannot authorize the agent or any other process with file access. These
controls cover only its instructions and its own commands.

- **SEC-003**: The skill carries CONTRACT-004 C items 3 to 5, 8, and 10. No text
  says Stemma enforces them against an agent with file access.
- **SEC-004**: With edited saved reports, index, and cache in a seeded project,
  a build recomputes every scripted result and calls no model.
- **SEC-005**: Hostile paths, including a symbolic link that resolves into a
  refused location, cause no write outside the intended project, store, or output
  directory. Original files keep their hashes. Link resolution is the P part.

### Data Protection

- **SEC-015**: No held copy, full extraction, or original file is written inside
  a git-tracked path. A store set there is refused, and a seeded corrupt blob is
  detected by digest.
- **SEC-016**: A seeded structured restricted value appears in no tracked file,
  derived file, report field, or reviewer output. A restricted-store path inside
  the project is refused.
- **SEC-017**: Reviewer outputs meet CONTRACT-005 E and CONTRACT-002 E1. A
  seeded protected string in a generated part is redacted; one that cannot be
  removed is reported with a warning and the package is not checked clean.
- **SEC-018**: For every file and free-text field in a reviewer package, the
  design states whether it is allowed, redacted, scanned, or unchecked. This
  covers the PDF, manuscript and claim text, model-written text, and images.
- **SEC-019**: Setup documentation says the repository holds source excerpts and
  must be treated as private. It also says Stemma encrypts neither store, and the
  author protects and backs up both.

### Privacy

- **SEC-020**: `excerpt` and `support prepare` output only what CONTRACT-002 G
  and H allow. The skill prefers them. Setup and documentation say that any
  source in a project may be sent to the model.
- **SEC-021**: The skill tells the agent to read the restricted store only when a
  task needs exact coordinates, to say that they then reach the model, never to
  write them into project files or outputs, and not to repeat one it meets while
  handling a leak warning. This is an instruction, not a control on the agent.
- **SEC-022**: A seeded coordinate in prose, and an absent restricted store,
  each produce the CONTRACT-002 C warning on screen and in the report, and a
  packaged report gives no location.
- **SEC-023**: With network access denied, check, build, export, and explorer
  viewing succeed with 0 network requests.
- **SEC-031**: A seeded image with embedded location metadata (EXIF position data), placed in a
  build, produces a finding that names the file, and
  changes no original.

### Input Validation

- **SEC-006**: Hostile Word and library fixtures meet every CONTRACT-003 G rule,
  and `doctor` shows the limits.
- **SEC-007**: PDF, scan, and web extraction cap input size, page count, time,
  and memory. They execute no embedded script, disable library code evaluation,
  and fetch nothing named inside a file.
- **SEC-008**: Invalid records, oversized or malformed resolver payloads, and
  hostile comment files are rejected or reported as the contracts state. None
  yields a pass.
- **SEC-009**: Source, library, manuscript, resolver, web, and comment text is
  handled as data. No command interprets it, and CONTRACT-004 C item 7 is in the
  skill. Seeded injection text is also tried in a live session on each claimed
  host, and the observed behavior is reported.
- **SEC-010**: Seeded Typst syntax in manuscript, record, and citation text is
  printed as text. Compilation reads no file outside the build directory and
  downloads no package (CONTRACT-006 G).
- **SEC-011**: Seeded markup, script, closing script tags, and active SVG
  (Scalable Vector Graphics) execute 0 scripts in the built explorer. The page
  declares a content security policy that permits no remote connection or script.
  The policy is the P part.
- **SEC-012**: TIFF and EPS (Encapsulated PostScript, which is executable code)
  conversion uses a pinned converter with no network and no file access beyond
  its input and output. A hostile EPS fixture shows it.
- **SEC-013**: `source add <url>` accepts only HTTP and HTTPS. It caps size and
  time, refuses loopback, link-local, and private addresses after each redirect,
  and never renders or executes the stored page.
- **SEC-014**: Seeded `bunfig.toml` and `.env` files in a project and in the
  calling directory run no code and change no Stemma setting or store location,
  using the CONTRACT-002 A invocation. The test passes before the pilot.

### Logging and Audit

- **SEC-024**: Records carry the provenance stamps and builds the build record
  that the contracts define. Error messages and reason codes carry no source text
  or restricted value. Documentation says stamps and git history can be altered.

### Supply Chain

- **SEC-025**: A wrong Bun version is refused and no run downloads a package.
  Dependencies are in a committed lockfile. Fonts and Typst packages are
  vendored or pinned by digest. Stemma installs no tool unless the author asks
  it to (CONTRACT-004 D).
- **SEC-026**: Before each release, a local `bun audit` and secret scan are run
  and reported. A known high-severity advisory or secret needs a stated
  decision.
- **SEC-027**: Dependency installs run no lifecycle script unless that package
  is listed with a reason.
- **SEC-028**: An installed plugin comes from one identified release package.
  Its SHA-256 digest is published, and the install proof compares the installed
  bundle with it. Until delivery is designed, the manifest claims no bundle. If
  delivery uses a separate distribution repository for built files, the
  marketplace entry pins a commit or tag in it, that repository holds only
  release outputs built from a tagged Stemma revision, and each release records
  which Stemma revision produced it.
- **SEC-029**: The public repository and release packages hold only synthetic or
  openly licensed fixtures, with no private source, personal data, or secret.
- **SEC-030**: A license review of citeproc-js is recorded before the pilot
  bundles it (FR-83).

## Requirements Matrix

| ID | Requirement | Source | Risk Level | Verification |
|----|-------------|--------|------------|--------------|
| SEC-001 | No accounts or credentials | G: concerns (no `auth-provider`); TM-S-004 | Low | Secret scan, review |
| SEC-002 | Honest wording for records | G: FR-23, FR-32; TM-S-002 | High | Text review |
| SEC-003 | Agent obligations, no enforcement claim | G: CONTRACT-004 C; TM-S-002, TM-T-001 | High | Skill review |
| SEC-004 | Recompute at every build | G: ADR-003; TM-T-005 | Medium | Tampered-cache test |
| SEC-005 | Confined writes, originals unchanged | G, P: CONTRACT-001 B; TM-T-003 | Medium | Hostile-path test |
| SEC-006 | Codec limits | G: CONTRACT-003 G; TM-D-001, TM-E-002 | High | Hostile fixtures |
| SEC-007 | Extraction limits, no execution | P; TM-D-001, TM-E-002 | High | Hostile fixtures |
| SEC-008 | Validate stored and returned data | G: CONTRACT-001, 005; TM-D-003, TM-D-004 | Medium | Negative tests |
| SEC-009 | Source text is data | G: CONTRACT-004 C; TM-S-001, TM-E-001, TM-I-003, TM-T-002 | High | Fixtures, live session |
| SEC-010 | No input becomes Typst code | G, P (package download); TM-E-005 | Medium | Escape and sandbox tests |
| SEC-011 | Inert, offline explorer | G, P: FEAT-012; TM-E-006, TM-I-012 | High | Browser test |
| SEC-012 | Contained image conversion | P: FR-55, FR-56; TM-E-004 | Medium | Hostile EPS fixture |
| SEC-013 | Bounded URL fetch | P; TM-I-011 | Medium | Redirect and address tests |
| SEC-014 | Runtime ignores project config | P; TM-E-003 | Medium | Seeded config test |
| SEC-015 | Binaries outside git | G: FR-6, Data Design; TM-I-009, TM-T-004 | Medium | Store tests |
| SEC-016 | Restricted values stay outside | G: FR-68; TM-I-004 | High | Seeded-leak test |
| SEC-017 | Reviewer filtering and redaction | G: FR-46; TM-I-007 | High | Seeded-package test |
| SEC-018 | Stated coverage of every package part | P; TM-I-006, TM-I-007 | High | Design review |
| SEC-019 | Private repository and stores disclosed | G, P; TM-I-009, TM-I-010, TM-D-002 | Medium | Documentation review |
| SEC-020 | Needed excerpts; state no gate | G: FR-61; TM-I-001 | Critical | Output tests, documentation review |
| SEC-021 | Restricted store read only when needed | G: FR-68; P; TM-I-002 | Medium | Skill review, live session |
| SEC-022 | Coordinate warnings; no location in packages | G: FR-68; TM-I-004, TM-I-005 | Medium | Seeded test |
| SEC-023 | Offline operation | G: FR-33, CONTRACT-002 A; TM-I-011, TM-D-005 | Medium | Network-denied run |
| SEC-024 | Provenance, safe messages | G: CONTRACT-001 I, 002 E1; TM-R-001, TM-R-003 | Low | Report tests |
| SEC-025 | Pinned toolchain | G: ADR-004, 005; TM-T-007, TM-E-007 | Medium | Version and digest tests |
| SEC-026 | Audit and secret scan at release | G: ADR-007, `security-owasp`; TM-T-007 | Medium | Release report |
| SEC-027 | No unreviewed install scripts | P; TM-E-007 | Medium | Manifest review |
| SEC-028 | Identified release package | P; TM-S-004, TM-T-007 | Medium | Install proof |
| SEC-029 | Clean public repository | G: concern conflicts; TM-I-013 | Medium | Fixture review, secret scan |
| SEC-030 | citeproc-js license review | G: FR-83; compliance | Medium | Recorded review |
| SEC-031 | Warn on image location metadata | P; TM-I-006 | Medium | Seeded image |

## Compliance Requirements

No compliance-requirements artifact exists, and no governing document determines
an applicable privacy, data protection, or sector regulation (open question).

**Applicable Regulations**: none determined.
**Applicable Standards**: the OWASP (Open Worldwide Application Security
Project) Top 10, through the selected `security-owasp` concern. No ASVS
(Application Security Verification Standard) level is adopted.

| Obligation recorded upstream | Controls |
|---|---|
| Stored sources are often copyrighted; the corpus is private to the project (PRD, Legal/Compliance) | SEC-015, SEC-017, SEC-018, SEC-019, SEC-029 |
| Restricted data and restricted sites (FR-46, FR-68) | SEC-016, SEC-021, SEC-022, SEC-031 |
| Unpublished and community permissions are recorded and filter reviewer outputs; they do not gate model use (FR-7) | SEC-017, SEC-020 |
| Third-party license terms for distribution (citeproc-js: Common Public Attribution License or GNU Affero General Public License) | SEC-030 |

The author is responsible for whether a license, permission, or community term
allows hosted processing. Stemma does not decide or enforce it.

## Security Risks

### High-Risk Areas

1. **Hosted-model exposure** (High to Critical): any project source may be sent.
   Accepted by owner decision; SEC-020 only informs the author.
2. **Prompt injection with agent tools** (High): hostile text can steer an agent
   that has file, shell, and network access. SEC-009 is not a containment
   boundary; the host's permissions are outside Stemma.
3. **Reviewer package disclosure** (High): scans find verbatim stored text only,
   and coordinate findings only warn.
4. **Forgeable records** (Medium): accepted by owner decision; SEC-002 and
   SEC-003 keep the claims honest.
5. **Hostile files in parsers and the explorer** (High): SEC-006, SEC-007, and
   SEC-011 limit it. The PDF and recognition libraries are undecided.

## Security Architecture Requirements

- [ ] Network segmentation: N/A, no service; SEC-023 bounds network use.
- [ ] Application security testing: hostile fixtures for the criteria above.
- [ ] Dependency vulnerability scanning: SEC-026.
- [ ] Server hardening: N/A, no server.
- [ ] Patch management: pins change only through a new release (SEC-025, SEC-026).
- [ ] Backup and recovery tested: the author backs up git and both stores; a
  restore is confirmed by digest.

## Security Testing Requirements

- [ ] Penetration testing: N/A, no deployed service.
- [ ] Vulnerability assessments: advisory review at each release (SEC-026).
- [ ] Security code review: parsers, Typst conversion, explorer rendering,
  packaging redaction, and path handling.
- [ ] Automated security scanning: local runs and advisory release-tag runs only
  (ADR-007). No paid model call runs in automation.

## Assumptions and Dependencies

- The author's account, computer, disk, backups, agent host, and model provider
  are trusted to the extent the author chooses. Stemma does not secure them.
- Host permission prompts and sandboxes are not counted as Stemma controls.
- No control here is built or tested. Feasibility tests ran on one macOS system.
  On Linux the local tools are targeted; no desktop-app integration is promised
  there in v1, so host-dependent controls (SEC-009 live sessions, install proof)
  are claimed only for hosts that were exercised.
- Risk levels are design assumptions; no owner risk tolerance is recorded.

Open questions:

- Who is the security champion, and where are vulnerability reports sent?
- Does any regulation or institutional data rule apply to pilot authors?
- How long may a short matching excerpt of a copyrighted source in a reviewer
  package be (FR-46)? Until set, none is kept.

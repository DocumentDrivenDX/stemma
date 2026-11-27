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
project of plain files that holds the full text of its sources, a restricted
store for coordinates, static browser outputs, and, when the author asks to
browse, a server that listens on the same computer's loopback address only
(ADR-012). It has no hosted server, account, or hosted database. Anyone who can read the project repository can read its source
files, so publishing the repository publishes them. The requirements protect the author's
machine from hostile input, keep restricted values and unasked-for source files out of outputs Stemma generates and report what it cannot remove,
protect the tool supply chain, and keep assurance claims honest. Threats and
STRIDE owners (spoofing, tampering, repudiation, information disclosure, denial
of service, elevation of privilege) are in the [threat model](threat-model.md).

By owner decision (ADR-003), no finding blocks work or a build: edits to
verdicts and review marks are not prevented, no source is gated from a hosted
model, and stray restricted coordinates, long source text in a package that
cannot be removed, image problems, and unsupported claims are reported.
Excluding structured restricted values and source files from reviewer outputs is
how outputs are built. No
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
- **SEC-034**: The local server gives project data only to a request signed with
  the run's secret, with the exact `Host`, `Origin`, content type, and request
  header of CONTRACT-005 M, rules 2 to 6. It sets no cookie and permits no
  cross-origin read. A one-time code is exchanged for the secret once and within
  10 minutes (rule 7). This is access control for the running server, not an
  account.
- **SEC-035**: Neither the secret nor the one-time code is in a process argument,
  standard output or error, or a log; the code is in one launch file readable
  only by its owner and removed after use, and the secret is in no file Stemma
  writes (CONTRACT-005 M, rules 8 and 9).
- **SEC-036**: The local server listens on 127.0.0.1 only, serves a fixed set of
  routes, lets no request name a file, bounds request size, time, connections,
  the work of a search, and the size of an answer to a query or search, sends the headers and policy of CONTRACT-005 M, rules 10 and 11,
  writes nothing in the project, and makes no outbound request.
- **SEC-037**: No request carries the code or the secret. The server accepts each
  signed call once, and the page uses no byte of an answer whose proof, bound to
  its request, is missing or wrong; it then drops the secret and what it showed
  (CONTRACT-005 M, "Proofs"). When the code is redeemed the command says so with
  the time, and a page given a used code says that another page or program opened
  the link first. A page served by another program is not covered (TM-S-009).
- **SEC-038**: The local server gives the bytes of an original only for a digest
  that a source file in effect records, found only in `.stemma/originals/` or a
  place named with `--originals`, following no symbolic link, and only the bytes
  it has just hashed to that digest, within a size limit, as an inert attachment
  under SEC-034 and SEC-037. It fetches no recorded address.
- **SEC-039**: The served page uses no byte of an original, or of pdf.js's data,
  before its proof has been checked, and draws an original only on a canvas with
  the pinned pdf.js or the browser's image decoder, with no scripting, XFA,
  evaluation, WebAssembly, link or form layer, or attachment, within bounds, and
  with the content security policy of CONTRACT-005 M, rule 11, unchanged. It
  never uses the browser's PDF viewer, and shows no page that CONTRACT-007 C does
  not establish.
- **SEC-002**: Every user-facing text about review marks, annotations, text
  reviews, comparisons, restriction marks, and support verdicts, including the disclosure, calls them
  records and not proof of who acted or verification of support.

### Authorization

Stemma cannot authorize the agent or any other process with file access. These
controls cover only its instructions and its own commands.

- **SEC-003**: The skill carries CONTRACT-004 C items 3 to 5, 8, and 10. No text
  says Stemma enforces them against an agent with file access.
- **SEC-004**: With edited saved reports, index, and cache in a seeded project,
  a build recomputes every scripted result and calls no model.
- **SEC-005**: Hostile paths, including a symbolic link that resolves into a
  refused location, cause no write outside the intended project or output
  directory. Original files keep their hashes. Link resolution is the P part.

### Data Protection

- **SEC-015**: No binary of a source is written into the project: converters
  write only text source files, originals go only to the ignored
  `.stemma/originals/` cache, a stray file in `sources/` is reported, and a
  changed or missing part is detected by digest.
- **SEC-016**: A seeded structured restricted value appears in no tracked file,
  derived file, report field, or reviewer output. A restricted-store path inside
  the project is refused.
- **SEC-017**: Reviewer outputs meet CONTRACT-005 E and CONTRACT-002 E1. They
  hold no source file unless the author asks. A seeded long source passage in a
  generated part is shortened; one that cannot be removed is reported with a
  warning and the package is not checked clean.
- **SEC-018**: For every file and free-text field in a reviewer package, the
  design states whether it is allowed, redacted, scanned, or unchecked. This
  covers the PDF, manuscript and claim text, model-written text, and images.
- **SEC-019**: Setup documentation says once that the repository holds the full
  text of its sources, so anyone who can read it can read them and publishing it
  publishes them, and that Stemma does not encrypt the restricted store, which
  the author protects and backs up.
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
  viewing succeed with 0 network requests. The served explorer's requests go to
  its own loopback server only.
- **SEC-031**: A seeded image with embedded location metadata (EXIF position data), placed in a
  build, produces a finding that names the file, and
  changes no original.

### Input Validation

- **SEC-006**: Hostile Word and library fixtures meet every CONTRACT-003 G rule,
  and `doctor` shows the limits.
- **SEC-007**: Converters of PDF, EPUB, DOCX, HTML, Markdown, and text cap
  input size, expanded size, part count, and time. They execute no embedded
  script, disable library code evaluation, expand no external entity, and fetch
  nothing named inside a file.
- **SEC-032**: Source text can form no Stemma annotation: a `<` in converted
  text is escaped, and an unknown or unescaped annotation is reported. A seeded
  source that imitates annotations stays plain text.
- **SEC-033**: No command lets a model produce or correct source text: a model's
  correction or seal of changed words is refused, and its review is a flag.
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
- **SEC-013**: A fetch by `ingest` or `resolve` accepts only HTTPS. It caps size
  and time, refuses loopback, link-local, and private addresses after each
  redirect, sends only the address and a user-agent naming Stemma and its
  version, and never renders or executes what it receives. A refusal is
  reported and not worked around.
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
  vendored or pinned by digest. The plugin obtains only pinned tools, from fixed
  HTTPS addresses, verified against a digest shipped in the plugin before they
  are unpacked or run, into its own data directory, through the host's
  permission prompts; it changes no system or shell setting (CONTRACT-004 D).
- **SEC-026**: Before each release, a local `bun audit` and secret scan are run
  and reported. A known high-severity advisory or secret needs a stated
  decision.
- **SEC-027**: Dependency installs run no lifecycle script unless that package
  is listed with a reason.
- **SEC-028**: An installed plugin comes from one identified release: one
  version of `plugins/stemma` in the DocumentDrivenDX/plugins repository, a
  release tree built from the Stemma repository. Different content is never
  published under a published version, and the install check compares the installed bundle with the built one. Each release records which
  Stemma revision produced it.
- **SEC-029**: The public repository and release packages hold only synthetic or
  openly licensed fixtures, with no private source, personal data, or secret.
- **SEC-030**: A license review of citeproc-js is recorded before the pilot
  bundles it (FR-83). Recorded in ADR-005 (CPAL-1.0 chosen).

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
| SEC-015 | Binaries outside git | G: FR-6, Data Design; TM-I-009, TM-T-004 | Medium | Conversion and stray-file tests |
| SEC-016 | Restricted values stay outside | G: FR-68; TM-I-004 | High | Seeded-leak test |
| SEC-017 | Reviewer filtering and redaction | G: FR-46; TM-I-007 | High | Seeded-package test |
| SEC-018 | Stated coverage of every package part | P; TM-I-006, TM-I-007 | High | Design review |
| SEC-019 | Publication and restricted store disclosed | G, P; TM-I-009, TM-I-010, TM-D-002 | Medium | Documentation review |
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
| SEC-032 | Source text cannot form annotations | G: CONTRACT-007 F; TM-T-013 | High | Injection fixture |
| SEC-033 | No model-written source text | G: FR-84, ADR-010; TM-T-014 | High | Refusal tests, skill review |
| SEC-034 | Only the opened page reads the local server | G: CONTRACT-005 M, ADR-012; TM-S-008, TM-I-016, TM-I-017 | High | One refusal test per rule |
| SEC-035 | Code and secret stay out of arguments, output, and files | G: CONTRACT-005 M; TM-I-017, TM-I-018 | High | Run and search output, arguments, files |
| SEC-036 | Loopback only, fixed routes, bounds, no outbound request | G: CONTRACT-005 M; TM-D-010, TM-I-016, TM-E-008 | High | Socket, path, size, time, and header tests |
| SEC-037 | Page and server prove themselves; the author is told of a first opener | G: CONTRACT-005 M, ADR-012; TM-S-008, TM-I-018 | High | A program on the port, changed, moved, and repeated answers and requests, and both code notices |
| SEC-038 | Only recorded originals, from named places, as hashed | G: CONTRACT-005 M; TM-I-019, TM-D-011 | High | Unknown digest, paths, links, swapped, changed, oversize, and unsupported files |
| SEC-039 | Originals drawn inert, after their proof | G: CONTRACT-005 M, ADR-012; TM-E-009, TM-D-011 | High | A PDF with script, links, a form, and an attachment; changed answers; the policy |

## Compliance Requirements

No compliance-requirements artifact exists, and no governing document determines
an applicable privacy, data protection, or sector regulation (open question).

**Applicable Regulations**: none determined.
**Applicable Standards**: the OWASP (Open Worldwide Application Security
Project) Top 10, through the selected `security-owasp` concern. No ASVS
(Application Security Verification Standard) level is adopted.

| Obligation recorded upstream | Controls |
|---|---|
| The repository holds the research, including full texts, many under copyright (PRD, Legal/Compliance) | SEC-015, SEC-017, SEC-018, SEC-019, SEC-029 |
| Restricted data and restricted sites (FR-46, FR-68) | SEC-016, SEC-021, SEC-022, SEC-031 |
| Rights fields are optional metadata and gate nothing (FR-7) | SEC-020 |
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
3. **Reviewer package disclosure** (High): scans find verbatim source text only,
   and coordinate findings only warn.
4. **Forgeable records** (Medium): accepted by owner decision; SEC-002 and
   SEC-003 keep the claims honest.
5. **Hostile files in parsers and the explorer** (High): SEC-006, SEC-007,
   SEC-011, and SEC-032 limit it.

## Security Architecture Requirements

- [ ] Network segmentation: the local server binds loopback only (SEC-036);
  SEC-023 bounds network use.
- [ ] Application security testing: hostile fixtures for the criteria above.
- [ ] Dependency vulnerability scanning: SEC-026.
- [ ] Server hardening: the local server follows SEC-034 to SEC-039. There is no
  hosted server.
- [ ] Patch management: pins change only through a new release (SEC-025, SEC-026).
- [ ] Backup and recovery tested: the author backs up git, source files
  included, and the restricted store.

## Security Testing Requirements

- [ ] Penetration testing: no deployed service. The local server's refusals are
  tested; no outside review has been made.
- [ ] Vulnerability assessments: advisory review at each release (SEC-026).
- [ ] Security code review: parsers, Typst conversion, explorer rendering,
  packaging redaction, and path handling.
- [ ] Automated security scanning: local runs and advisory release-tag runs only
  (ADR-007). No paid model call runs in automation.

## Assumptions and Dependencies

- The author's account, computer, disk, backups, agent host, and model provider
  are trusted to the extent the author chooses. Stemma does not secure them.
- Host permission prompts and sandboxes are not counted as Stemma controls.
- Of these controls, converter limits, escaping, confined writes, bounded
  fetches, and the model-correction refusals have tests on one macOS system; the
  rest are untested. On Linux the local tools are targeted; no desktop-app
  integration is promised there in v1, so host-dependent controls (SEC-009 live
  sessions, install proof) are claimed only for hosts that were exercised.
- Risk levels are design assumptions; no owner risk tolerance is recorded.

Open questions:

- Who is the security champion, and where are vulnerability reports sent?
- Does any regulation or institutional data rule apply to pilot authors?
- How long may a short matching excerpt of a copyrighted source in a reviewer
  package be (FR-46)? Until set, none is kept.

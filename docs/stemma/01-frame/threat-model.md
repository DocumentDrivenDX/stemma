---
ddx:
  id: stemma.threat-model
  type: threat-model
  activity: frame
  authoring:
    home: repo
  depends_on:
    - stemma.prd
    - stemma.concerns
    - stemma.security-requirements
---

# Threat Model

**Project**: Stemma
**Date**: 2026-11-26

## Executive Summary

**System Overview**: a plugin skill, a command line, plain record files in git,
a restricted coordinate store, a Typst build, a browser explorer (an offline file,
or served on the loopback address by a local server, ADR-012), all run by
one author with an AI agent.
**Key Assets**: the author's machine; the captured source texts and unpublished material;
restricted site positions; the integrity of citation evidence; the release
supply chain.
**Primary Threats**: material reaching a hosted model against its terms (TM-I-001);
reviewer packages disclosing more than the author means to send (TM-I-007); prompt injection
driving the agent (TM-E-001, TM-I-003); undetected record edits (TM-T-001);
restricted positions leaking (TM-I-002, TM-I-004 to TM-I-006).
**Risk Level**: High. Several leading risks are accepted or only reported, by
owner decision (ADR-003).

Stemma has no code yet. The analysis follows the
[architecture](../02-design/architecture.md); library behavior named here is
unverified unless stated.

## System Description

### Boundaries and Components

**In Scope**: the components below, their inputs and outputs, and how releases
reach the author.
**Out of Scope**: securing the author's computer and accounts, the agent host's
internals and permission system, the model provider's data handling, the git
host, any static host the author chooses, and the publisher.
**Trust Boundaries**:

| ID | Boundary |
|---|---|
| B1 | Outside files and web content into the machine |
| B2 | Untrusted text into the agent's context |
| B3 | Local machine to the hosted model |
| B4 | Agent and other local processes to project files and the restricted store |
| B5 | Local machine to network services |
| B6 | Project to reviewer, static host, or publisher |
| B7 | Publisher of tools and releases to the author's machine |
| B8 | Another person's changes into the project (clone, merge, comment file) |
| B9 | Anything that can reach the local server's port (another web page in the author's browser, another local program or user) to the project's text |

### Components

| Component | Description | Trust Level |
|-----------|-------------|-------------|
| C1 Agent host, model, and skill | Reads text, runs commands, edits files | Acts with the author's rights; behavior not controllable by Stemma |
| C2 Command line | Records, checks, packaging policy | Trusted code, untrusted data |
| C3 Intake and conversion | Word, libraries, PDF, EPUB, HTML, DOCX, text, library fetches | Parses hostile input |
| C4 Network clients | Resolvers, URL admission, research | Remote responses untrusted |
| C5 Project files | Records, manuscript, rules, settings, in git | Writable by any local process or collaborator |
| C6 Source files | The full text of every captured source, in the repository | Readable by whoever can read the repository |
| C7 Restricted store | Exact restricted coordinates | Most sensitive, unencrypted by Stemma |
| C8 Derived index and reports | SQLite and saved reports | Disposable, never authoritative |
| C9 Build | Citation formatting, image conversion, Typst, packaging | Processes untrusted content |
| C10 Explorer and exports | Graph export, offline page, reviewer package, comment file | Leaves the machine |
| C11 Distribution and toolchain | Plugin, release package, Bun, Typst, libraries, fonts | Runs with the author's rights |
| C12 Local server | `browse`: a loopback HTTP listener and a child process holding the author export | Trusted code; every request untrusted until it passes CONTRACT-005 M |

### Data Flows

- **External Sources**: sources as Word, PDF, scan, image, and web files;
  BibLaTeX, CSL-JSON, and RIS libraries; resolver and search results; reviewer
  comment files; collaborators' commits; tools and releases.
- **Internal Processing**: originals become source files and records. The
  agent reads and writes them. Checks, builds, and exports derive outputs.
- **External Destinations**: the hosted model, resolver and search services, the
  git remote, backups, static hosts, reviewers, and publishers.

What can reach the hosted model (B3):

| Data | How |
|---|---|
| Source excerpts | `excerpt`, bounded by the command |
| Claim, full cited passage, and prompt | `support prepare` |
| Manuscript text, notes, claims, constructs, rules, voice samples | The agent reads or writes them in takeover, drafting, audit, and checks |
| Source text quoted in check results, including both texts of a near match | Unredacted reports in the author's own session |
| Intake, resolver, search, and imported comment text | Command output or file reads |
| Anything else the agent opens, including whole source files and the restricted store | Ordinary file access; `excerpt` limits only its own output |

No source or rights flag gates this flow. A project is for material that may be
sent to its model. Running the whole process on a local model is an unsupported
experiment.

## Assets

### Data Assets

| Asset | Classification | Confidentiality | Integrity | Availability |
|-------|---------------|-----------------|-----------|--------------|
| Restricted coordinates | Restricted | Critical | High | Medium |
| Unpublished and community-restricted sources | Sensitive | High | High | High |
| Source files and excerpts in records, many copyrighted | Third-party protected | High | High | High |
| Manuscript, notes, claims | Private | High | High | High |
| Review marks, annotations, confirmations, support records | Records of what was said or judged | Medium | High | Medium |
| Reviewer package | Leaves the project | High | Medium | Low |

### System Assets

| Asset | Criticality | Dependencies |
|-------|-------------|--------------|
| Author's machine, files, and credentials | Critical | Agent host, parsers, toolchain |
| Plugin, skill text, and bundle | High | Marketplace, release packages |
| Pinned Bun, Typst, libraries, fonts | High | Their publishers |
| Public Stemma repository | High | Contributors, fixtures |

## STRIDE Threat Analysis

Impact (I) and likelihood (L) are 1 to 5 and are design assumptions; the score
is their product, before any unbuilt control. SEC IDs are in
[security requirements](security-requirements.md). Owners are architecture
modules, or the product owner for accepted risks.

### Coverage by component

| Component | S | T | R | I | D | E |
|---|---|---|---|---|---|---|
| C1 | TM-S-001, 006 | TM-T-002, 009 | TM-R-002 | TM-I-001 to 003 | TM-D-008 | TM-E-001 |
| C2 | TM-S-002 | TM-T-003 | TM-R-001 | TM-I-004, 005 | TM-D-003 | TM-E-003 |
| C3 | TM-S-003 | TM-T-003, 010 | n1 | TM-I-014 | TM-D-001 | TM-E-002 |
| C4 | TM-S-007 | TM-T-011 | n1 | TM-I-011 | TM-D-005 | n2 |
| C5 | TM-S-002, 006 | TM-T-001, 006 | TM-R-001 | TM-I-009, 013, 014 | TM-D-003 | n3 |
| C6 | TM-S-003 | TM-T-004 | n1 | TM-I-010 | TM-D-002 | n3 |
| C7 | n4 | TM-T-012 | n1 | TM-I-002, 010 | TM-D-002 | n3 |
| C8 | n4 | TM-T-005 | n1 | TM-I-015 | TM-D-009 | n3 |
| C9 | n4 | TM-T-006 | TM-R-003 | TM-I-004, 006 | TM-D-007 | TM-E-004, 005 |
| C10 | TM-S-005 | TM-T-008 | TM-R-003 | TM-I-006 to 008, 012 | TM-D-004 | TM-E-006 |
| C11 | TM-S-004 | TM-T-007, 009 | TM-R-004 | TM-I-013 | TM-D-006 | TM-E-007 |
| C12 | TM-S-008 | n5 | n1 | TM-I-016 to 018 | TM-D-010 | TM-E-008 |

- n1: no separate actions or identities of its own; attribution falls under
  TM-R-001.
- n2: a response is data; hostile files it delivers are C3 (TM-E-002) and
  hostile text is C1 (TM-E-001).
- n3: saved data runs nothing; execution through it is counted at the component
  that reads it.
- n4: no identity is presented to or by this component; forged content counts as
  tampering.
- n5: it writes nothing in the project and has no write call.

### Spoofing

| ID | Threat | I | L | Score | Owner | Controls |
|----|--------|---|---|-------|-------|----------|
| TM-S-001 | Text in a source, page, or library poses as an instruction from the author, system, or Stemma | 4 | 3 | 12 | `skills/stemma` | SEC-009 |
| TM-S-002 | Any process writes a review mark, annotation, confirmation, restriction change to public, or support record as the author, edits a reviewed item as the author so its mark stays, or claims a separate context | 4 | 3 | 12 | Product owner (accepted) | SEC-002, SEC-003 |
| TM-S-003 | A fake or altered file, or embedded reference-manager data, passes as the cited work; checks compare with its converted text | 4 | 2 | 8 | Author; `intake`, `core` | None sufficient; provenance, `meta.*` checks, author review |
| TM-S-004 | A look-alike marketplace, plugin, or tool download is installed as genuine | 5 | 1 | 5 | Release maintainer | SEC-001, SEC-028 |
| TM-S-005 | A comment file claims another reviewer or package; a made-up package is shown as Stemma-checked | 2 | 2 | 4 | `core`, `publish` | SEC-002; CONTRACT-005 E2 |
| TM-S-006 | `rules.md`, agent instruction files, or manuscript text from a shared project are followed as the author's rules | 4 | 2 | 8 | Author; `skills/stemma` | SEC-009; rules cannot relax the contract in text only |
| TM-S-007 | A wrong or spoofed resolver or search response is saved as authoritative metadata | 2 | 1 | 2 | `workspace` | SEC-008; saved with source and date |
| TM-S-008 | Another local program, of any user: after the server stops, it takes the same port, and a still-open page sends it the secret or shows its invented records as current | 4 | 2 | 8 | `server`, `explorer` | SEC-037: requests are signed and the code and secret are never sent; the page uses no answer without a proof bound to its request, and on one drops the secret and its data. It receives the bodies of calls under way. Not covered: TM-S-009 |
| TM-S-009 | Another local program holds the port when the browser asks for the page itself (a reload or restore after the server stopped, or a launch file left behind), and serves its own page; it may also leave a service worker for that address, which a later run on the same port would meet | 4 | 1 | 4 | Author (accepted) | None in the page, whose script comes from the port. The stopped notice says to close the tab without reloading it; the launch file is removed when the command ends |

### Tampering

| ID | Threat | I | L | Score | Owner | Controls |
|----|--------|---|---|-------|-------|----------|
| TM-T-001 | Verdicts, review marks, annotations, confirmations, or round choices are altered or fabricated and a report reads cleaner than it should | 4 | 3 | 12 | Product owner (accepted) | SEC-002, SEC-003 |
| TM-T-002 | Text in a passage or claim steers the support judgment to "supported" | 4 | 3 | 12 | `skills/stemma` | SEC-009; error rates measured (FR-52) |
| TM-T-003 | Archive entries, paths, or links in input write outside intended directories | 4 | 2 | 8 | `intake`, `workspace` | SEC-005, SEC-006 |
| TM-T-004 | A source part is damaged or edited; rewriting part and digest together goes unnoticed except in history or against the original | 3 | 2 | 6 | `workspace` | SEC-015 |
| TM-T-013 | Text in a source imitates Stemma annotations to move words between streams, fake a page, or hide text | 4 | 2 | 8 | `extract`, `records` | SEC-032 |
| TM-T-014 | A model writes or tidies source text, so fluent invented words pass quotation checks | 4 | 3 | 12 | `cli`, `skills/stemma` | SEC-033; comparisons with the original; the agent can still edit files directly |
| TM-T-005 | The index or a saved report is edited to hide a finding | 3 | 2 | 6 | `core`, `graph` | SEC-004 |
| TM-T-006 | A printed sentence is strengthened while its claim is unchanged; the support record stays current | 4 | 3 | 12 | Product owner (accepted) | SEC-002 |
| TM-T-007 | A compromised dependency, release package, tool binary, or skill text changes behavior. The plugin installs from the DocumentDrivenDX/plugins marketplace repository, a second publishing surface that whoever can push there can alter apart from the Stemma source. The first-use setup downloads Bun, which is refused unless it matches the pinned digest | 5 | 2 | 10 | Release maintainer | SEC-025 to SEC-028 |
| TM-T-008 | A package or export is altered after production; nothing is signed | 3 | 1 | 3 | Author | None; manifest hashes detect only accidental change |
| TM-T-009 | The agent or malware edits the installed bundle or skill | 4 | 2 | 8 | Author | SEC-028 allows comparison; nothing prevents |
| TM-T-010 | A fix or takeover changes an original file | 4 | 1 | 4 | `intake`, `workspace` | SEC-005 |
| TM-T-011 | Retrieved web content differs from what the author saw, or changes later | 2 | 3 | 6 | `workspace` | Upstream record with hash and retrieval time; source files in git (FR-6) |
| TM-T-012 | Restricted-store entries are changed or removed, so the scan misses a value | 4 | 1 | 4 | Author | SEC-022 warns only for an absent store, not a missing entry |

### Repudiation

| ID | Threat | I | L | Score | Owner | Controls |
|----|--------|---|---|-------|-------|----------|
| TM-R-001 | Nobody can show who made a record; stamps are self-asserted and git history can be rewritten | 3 | 3 | 9 | Product owner (accepted) | SEC-002, SEC-024 |
| TM-R-002 | The author cannot show what was or was not sent to a model; Stemma keeps no such log | 3 | 3 | 9 | Product owner | None; disclosure records AI roles, not data sent |
| TM-R-003 | A delivered package or PDF cannot be tied beyond doubt to a build | 2 | 2 | 4 | `publish` | SEC-024 build record |
| TM-R-004 | A release cannot be tied to its source, since the bundle is not in the Stemma repository and sits only in the marketplace repository | 3 | 2 | 6 | Release maintainer | SEC-028 |

### Information Disclosure

| ID | Threat | I | L | Score | Owner | Controls |
|----|--------|---|---|-------|-------|----------|
| TM-I-001 | Unpublished, community-restricted, licensed, or personal material is sent to a hosted model against its terms | 4 | 5 | 20 | Product owner (accepted) | SEC-020 |
| TM-I-002 | The agent reads exact coordinates, from the restricted store or a warned location, and they reach the model or new text | 4 | 3 | 12 | Product owner (reading accepted); `skills/stemma` | SEC-021 |
| TM-I-003 | Injected text makes the agent send private files, stores, coordinates, or unrelated secrets elsewhere | 5 | 3 | 15 | Author and host; `skills/stemma` | SEC-009 only |
| TM-I-004 | A restricted coordinate typed in prose, notes, or a restricted place record reaches git, a PDF, or a package; the scan only warns and knows only stored values and listed forms | 4 | 3 | 12 | Product owner (reported only) | SEC-016, SEC-022 |
| TM-I-005 | An unmarked or late-marked site, a broad area, a place name, a gazetteer identifier, a nearby relation, or another public location discloses a position; history, exports, and model input keep it | 4 | 3 | 12 | Author | SEC-022; unmarked places are public by decision, and the restriction mark covers a location only |
| TM-I-006 | Location or personal metadata inside images or documents travels into the PDF or package, unseen by text scans | 4 | 3 | 12 | `publish` | SEC-018, SEC-031 |
| TM-I-007 | A reviewer package carries long source text through manuscript quotations, claim text, model-written support text, sentence fields, paraphrase, figures, or short allowed excerpts; nothing stops sending it | 4 | 4 | 16 | `publish`, `graph`, `core`; author | SEC-017, SEC-018 |
| TM-I-008 | An author export or hosted explorer exposes passage text to anyone who gets it; the static profile has no access control | 4 | 2 | 8 | Author | CONTRACT-005 C states it |
| TM-I-009 | The repository, with full source texts, is made public or shared more widely than the author means, or text stays in history after removal | 4 | 2 | 8 | Author | SEC-019 states it once |
| TM-I-010 | The unencrypted restricted store and project files are read by other processes, shared accounts, sync services, or backups | 4 | 2 | 8 | Author | SEC-019 |
| TM-I-011 | Lookups reveal research interests; an injected URL makes a fetch reach a local or private service, and the result is stored and read | 3 | 2 | 6 | `workspace` | SEC-013, SEC-023 |
| TM-I-012 | A remote reference in explorer or package content reveals that a reviewer opened it | 3 | 2 | 6 | `explorer` | SEC-011, SEC-023 |
| TM-I-013 | Private sources, personal data, or secrets enter the public Stemma repository or a release | 4 | 2 | 8 | Release maintainer | SEC-026, SEC-029 |
| TM-I-014 | Preserved legacy fields or file names carry local paths, private annotations, or names into committed records | 3 | 4 | 12 | `intake` | None; lossless import keeps them. Exports omit `legacy` |
| TM-I-015 | The index and saved reports copy source text; sharing the working folder shares them | 3 | 2 | 6 | Author | SEC-019 |
| TM-I-016 | Hostile web page in the author's browser reads the local server: a cross-origin fetch or form post, DNS rebinding to 127.0.0.1, framing, or guessing paths | 4 | 3 | 12 | `server` | SEC-034, SEC-036: exact Host and Origin, no cross-origin permission, JSON and custom header, secret header, no cookie, framing refused |
| TM-I-017 | Another local port: a page or program on another loopback port reaches the server, or receives its cookie or secret | 4 | 2 | 8 | `server`, `explorer` | SEC-034: origin includes the port; no cookie (cookies are shared between ports); the secret is in per-origin session storage |
| TM-I-019 | The local server is made to give a file that is not a recorded original: a request naming a path, a link placed where originals are looked for, or a file swapped for another after it was checked | 4 | 2 | 8 | `server` | SEC-038: a request names only a digest a source file records; no link is followed; the bytes sent are the bytes hashed |
| TM-I-020 | An original shown shows what the source text and the export leave out, such as a download stamp naming a person or a restricted position | 2 | 2 | 4 | Author (accepted) | Shown only through the local server on the author's computer; no export or package holds it; stated in CONTRACT-005 M |
| TM-I-018 | Another local user learns the secret or one-time code from process arguments, output, logs, or files, and reads the project through the port | 4 | 2 | 8 | `server` | SEC-035: private launch file, nothing in arguments or output; whoever reads the file first wins the one-time code, which file permissions prevent on macOS and Linux; Windows permissions are untested. Neither is sent (SEC-037). A process running as the author that redeems the code first gets in; the author's page and the command's output then say that the link was opened first, which tells of it and does not prevent it |

### Denial of Service

| ID | Threat | I | L | Score | Owner | Controls |
|----|--------|---|---|-------|-------|----------|
| TM-D-001 | Archive bombs, deep XML, huge fields, or hostile PDFs and images exhaust memory or time | 2 | 3 | 6 | `intake`, `extract` | SEC-006, SEC-007 |
| TM-D-002 | The restricted store is lost, and coordinates are gone | 4 | 3 | 12 | Author | SEC-019 |
| TM-D-003 | A bad record or merge keeps parts of a build unreadable or stops a tool | 2 | 3 | 6 | `records` | SEC-008; named errors |
| TM-D-004 | A very large export or comment file hangs the explorer or import | 2 | 2 | 4 | `explorer`, `core` | SEC-008; chapter scope |
| TM-D-005 | A resolver is unavailable or throttles, leaving results unverifiable | 2 | 3 | 6 | `workspace` | SEC-023; cached resolutions |
| TM-D-006 | A pinned tool is withdrawn, or a flaw forces a change that alters results | 3 | 2 | 6 | Release maintainer | SEC-025, SEC-026 |
| TM-D-007 | Pathological content stalls citation formatting or Typst | 2 | 2 | 4 | `publish` | None specific |
| TM-D-008 | Injected or oversized text makes the agent loop, spend, or stop | 2 | 2 | 4 | Author | Bounded excerpts |
| TM-D-009 | The index is corrupt or stale | 1 | 2 | 2 | `graph` | Rebuilt from records |
| TM-D-011 | A hostile or very large original takes the memory or time of the server or the page | 2 | 2 | 4 | `server`, `explorer` | SEC-039: size limit before reading, two originals held at once, bounded canvas, image pixels, and drawing time |
| TM-D-010 | Oversize, slow, or many requests, from a web page or another local user, stall the local server | 2 | 2 | 4 | `server` | SEC-036 bounds, including a search's work and answer size (CONTRACT-005 M, rule 13). Another user can still use up the connection limit while it connects; the author loses browsing, not data |

### Elevation of Privilege

| ID | Threat | I | L | Score | Owner | Controls |
|----|--------|---|---|-------|-------|----------|
| TM-E-001 | Hostile text makes the agent run commands, edit files or records, or record annotations or review marks | 5 | 3 | 15 | Author and host; `skills/stemma` | SEC-009, SEC-003 |
| TM-E-002 | A crafted file exploits a parser or recognition engine and runs code. PDF libraries have had script-execution flaws | 5 | 2 | 10 | `extract`, `intake` | SEC-006, SEC-007, SEC-026 |
| TM-E-003 | Bun reads `bunfig.toml` or `.env` from a working directory, which could preload code or redirect stores. Observed on the pinned version on macOS under `--no-install` alone; stopped by the CONTRACT-002 A flags | 5 | 2 | 10 | `cli`, `skills/stemma` | SEC-014 |
| TM-E-004 | A hostile EPS file runs code or reads files in a converter | 5 | 2 | 10 | `publish` | SEC-012 |
| TM-E-005 | Content becomes Typst code, reads files, or pulls a package | 4 | 2 | 8 | `publish` | SEC-010 |
| TM-E-006 | Record, comment, resolver, or SVG content runs script in the explorer, including by breaking out of inlined data. In-browser Typst may need a looser policy | 4 | 3 | 12 | `explorer` | SEC-011 |
| TM-E-007 | A malicious dependency, install script, or update runs with the author's rights | 5 | 2 | 10 | Release maintainer | SEC-025 to SEC-028 |
| TM-E-009 | A hostile PDF or image shown in the served page exploits pdf.js or the browser's image decoders, or its scripts, links, forms, or attachments act | 5 | 2 | 10 | `explorer` | SEC-039: only files whose digest a source file records; pinned pdf.js drawing a canvas from bytes, no scripting, XFA, evaluation, WebAssembly, annotation or link layer, or attachment; policy unchanged. A flaw in a parser or decoder is not contained beyond the page's policy |
| TM-E-008 | A crafted request reads a file outside the served set or makes the local server run something | 5 | 1 | 5 | `server` | SEC-036: fixed routes, assets held in memory, a record ID only looked up in the snapshot; arras runs queries over memory only |

## Risk Assessment

**Scoring**: Impact (1-5) x Likelihood (1-5). Bands: Critical 20-25, High 15-19,
Medium 10-14, Low 1-9. The bands set priority. Timing follows delivery steps,
not day counts. No owner risk tolerance is recorded.

### Top Risks

| Risk ID | Threat | Impact | Likelihood | Score | Priority |
|---------|--------|--------|------------|-------|----------|
| TM-I-001 | Material sent to a hosted model against its terms | 4 | 5 | 20 | Critical, accepted |
| TM-I-007 | Long source text in a reviewer package | 4 | 4 | 16 | High |
| TM-I-003 | Injection-driven exfiltration | 5 | 3 | 15 | High |
| TM-E-001 | Injection-driven commands and edits | 5 | 3 | 15 | High |

Medium (10-14): TM-S-001, TM-S-002, TM-T-001, TM-T-002, TM-T-006, TM-T-007,
TM-I-002, TM-I-004, TM-I-005, TM-I-006, TM-I-014, TM-D-002, TM-E-002 to
TM-E-004, TM-E-006, TM-E-007.

## Mitigation Strategies

### TM-I-001 - Hosted-model exposure

- **Controls**: needed excerpts; plain statement at setup. No gate, by decision.
- **Timeline**: M1.
- **Owner**: product owner (acceptance); `skills/stemma` (statement). The author
  decides what enters a project.
- **Verification**: SEC-020.

### TM-I-007 - Reviewer package disclosure

- **Controls**: allow-list export, report redaction, a verbatim scan whose
  unremovable hits are reported, and stated coverage for every part. The author
  decides whether to send the package after reading its warnings.
- **Timeline**: M3; the redacted report rules apply to any report shared earlier.
- **Owner**: `publish`, with `graph` and `core`.
- **Verification**: SEC-017, SEC-018.

### TM-I-003 and TM-E-001 - Prompt injection

- **Controls**: source text treated and marked as data; bounded excerpts; commands
  never interpret input. These do not contain a steered agent. Containment
  depends on the host's permissions and sandbox, which Stemma neither sets nor
  verifies. Documentation should say so.
- **Timeline**: M1.
- **Owner**: `skills/stemma`; the author for host permissions.
- **Verification**: SEC-009, with live-session results reported as observations.

### Medium risks

| Risks | Action and verification | Step | Owner |
|---|---|---|---|
| TM-S-001, TM-T-002 | SEC-009; seeded injections in the support test set | M1 | `skills/stemma` |
| TM-S-002, TM-T-001, TM-T-006 | Accepted; SEC-002, SEC-003 | M1 | Product owner |
| TM-I-002, TM-I-004, TM-I-005 | SEC-016, SEC-021, SEC-022; reported | M1, maps M3 | `skills/stemma`, `core`, author |
| TM-I-006 | SEC-018, SEC-031 | M2, package M3 | `publish` |
| TM-I-014 | No control; the author reviews records before sharing the repository | M1 | Author |
| TM-D-002 | SEC-019 | M1 | Author |
| TM-E-002 | SEC-006, SEC-007, SEC-026 | M1 | `extract`, `intake` |
| TM-E-003 | SEC-014; test before the pilot | M1 | `cli` |
| TM-E-004, TM-E-006 | SEC-012, SEC-011 | M2, M3 | `publish`, `explorer` |
| TM-T-007, TM-E-007 | SEC-025 to SEC-028 | Before first release | Release maintainer |

## Security Controls Summary

- **Preventive**: input limits, escaping, inert rendering, path refusals,
  restricted store outside the project, export allow list, redaction, pinned tools.
- **Detective**: digests, recomputed scripted checks, coordinate warnings,
  package scan, release audit and secret scan. There is no monitoring.
- **Corrective**: fix and re-release; rebuild derived data; restore from the
  author's backups. Removing material from git history or from recipients is
  manual, and material sent to a model cannot be recalled by Stemma.

## Local server stages not yet built

ADR-012's later stages add threats that are analysed here before they are built
and have no control yet:

- **Injection through MCP** (an MCP surface): record and source text returned to
  an agent can pose as instructions (TM-S-001, TM-E-001), and a tool argument
  can try to name an address or a file. The plan is read-only tools, results
  marked as quoted data and bounded, record IDs only, and no tool that takes a
  path or address. There is no MCP surface now.

## Assumptions and Dependencies

- Attackers are authors of files, web pages, libraries, or upstream packages, and
  careless or hostile collaborators. A fully compromised author account is out of
  scope.
- The author is not an attacker, but can make mistakes.
- Host, model provider, git host, and tool publishers are external dependencies.
- Other than the local server's request rules and the local tests the security
  architecture names, no control is built or tested. Linux, Windows, and desktop apps are untested.
  Linux is a target for the local tools only; no desktop-app integration is
  promised there in v1.

Open: the PDF text library, recognition engine, TIFF and EPS converter, Typst
distribution, and marketplace delivery are undecided. Each changes TM-E-002,
TM-E-004, TM-T-007, or TM-E-007.

---
ddx:
  id: FEAT-001
  type: feature-specification
  activity: frame
  authoring:
    home: repo
  depends_on:
    - stemma.prd
    - stemma.principles
    - stemma.concerns
---

# Feature Specification: FEAT-001 — Workspace and governance

**Feature ID**: FEAT-001
**Priority**: P0
**Owner**: product owner
**Covered PRD Subsystem(s)**: 1. Workspace and governance
**Covered PRD Requirements**: FR-1, FR-2, FR-3, FR-4, FR-5, FR-60
**Cross-Subsystem Rationale**: None — single subsystem.

## Overview

Workspace and governance gives a book project its starting inputs and the records that govern later work (PRD FR-1, FR-60). It also covers the standing rules the assistant reads each session (FR-2) and the P1 consistency checks and role record (FR-3 to FR-5).

## Ideal Future State

An author starts a project, or takes one over, and can read in plain files what the book argues, for whom, under which rules, and what has been decided and corrected. Theoretical constructs and research methodology can wait until the author is ready. Each rule has an identifier, so a report can say which rule applies. The author can see which AI roles exist without mistaking that record for access control.

## Problem Statement

- **Current situation**: Authors who use AI openly keep standing instructions, registers, errata, and decision records by hand.
- **Pain points**: Hand-kept registers drift, rules are restated in each session, and a good run of versions can become untraceable.
- **Desired outcome**: Setup creates the governing records from the author's inputs, and every session starts from the same identified rules.

## Functional Areas

| Area | User question or job | Feature responsibility |
|------|----------------------|------------------------|
| Project setup | What is this book, and where are its governing records? | Capture inputs and create the records |
| Standing rules | Which rules does the assistant work under? | Load identified plain-text rules |
| Document consistency (P1) | Which documents are out of date or duplicated? | Detect stale dependents and duplicate identities |
| AI roles (P1) | Which AI roles work on this book? | Record roles as guidance |

## Requirements

### Functional Requirements by Area

Domain terms: a **standing rule** directs the assistant's work. A **decision** is an entry in the decision log. A **construct** is a theoretical concept the book uses; its register entry belongs to FEAT-005. The **research methodology** is the book's own method and is separate from the AI-use disclosure.

#### Project setup

SET-01 (FR-1, P0, M2). Starting a project must capture the thesis, audience, scope, and citation style as the author states them.

SET-02 (FR-1, P0, M2). Starting a project must create the standing rules, changelog record, errata record, decision log, and registers. Registers vary by persona only once persona defaults exist (FR-51, P1).

SET-03 (FR-1, P0, M2). A taken-over project must get the same records as a new project once SET-02 is delivered; in M1, takeover needs only the standing rules.

SET-04 (FR-1, P0, M2). The assistant must not invent a missing input; a missing input must be shown as missing.

SET-05 (FR-60, P0, M2). Starting a project must ask for the theoretical constructs and the research methodology alongside the thesis, and the author must be able to skip either.

SET-06 (FR-60, P0, M2). The author must be able to add or revise constructs and methodology at any time.

SET-07 (FR-60, P0, M2). A check or review step that depends on constructs or methodology must run only once the input it depends on exists, and must not report a pass before then.

#### Standing rules

RUL-01 (FR-2, P0, M1). Standing rules must be plain text that the assistant reads at the start of every session.

RUL-02 (FR-2, P0, M1). Each rule must have a unique identifier that checks and reports can cite.

RUL-03 (FR-2, P0, M1). Every project must have the standing rules from M1, including one begun by takeover.

#### Document consistency

DOC-01 (FR-3, P1). When a recorded decision changes, a check must list the documents that declare a dependency on it and have not been updated since.

DOC-02 (FR-4, P1). Each document must have one canonical location.

DOC-03 (FR-4, P1). A check must detect two documents that declare the same identity and name both locations.

#### AI roles

ROL-01 (FR-5, P1). The project must record each AI role, what it may read and write, and which checks it runs.

ROL-02 (FR-5, P1). Wherever the role record is explained or reported, it must be described as guidance and not as access control.

### Non-Functional Requirements

- **Reliability**: Running setup where governing records already exist overwrites none of them without the author's explicit choice.
- **Portability**: The same governing records load with the same rule identifiers on macOS, Linux, and Windows. This is untested on all three until a run is observed.
- **Scalability and performance**: No target is set by a governing source.

## User Stories

- [US-001 — Start a project with its governing records](../user-stories/US-001-start-a-project.md)
- [US-002 — Add constructs and methodology when ready](../user-stories/US-002-add-constructs-and-methodology.md)
- [US-003 — Work under identified standing rules](../user-stories/US-003-work-under-standing-rules.md)
- [US-004 — Find documents left stale by a changed decision](../user-stories/US-004-find-stale-dependents.md)
- [US-005 — Find two documents with one identity](../user-stories/US-005-find-duplicate-identities.md)
- [US-006 — Record AI roles as guidance](../user-stories/US-006-record-ai-roles.md)

## Edge Cases and Error Handling

- **Interrupted setup**: The project reports which governing records are missing; resuming creates only those.
- **Edit outside the agent**: Record files stay the source of truth. The next session and the next check read the edited files.
- **Unreadable standing rules**: The assistant reports that the rules did not load and does not state that it is working under them.
- **Removed construct or methodology**: Dependent checks report that their input is absent, not a pass.

## Constraints and Assumptions

- Record structure and storage belong to FEAT-011 (ADR-002); this feature owns what the governing records mean.
- Standing rules and roles guide a model. Stemma cannot guarantee that a model follows them (ADR-003, `honest-assurance`).
- Standing rules (RUL-01 to RUL-03) are M1 and project setup is M2, so M1 takeover has standing rules and none of the other governing records.
- Assumption: a rule identifier is not reassigned to a different rule after removal.
- Open: which registers does setup create, and how will persona defaults vary them once FR-51 (P1) arrives?
- An author's own constructs are register entries marked as the author's (FEAT-005). Advice on how drafts use constructs and methodology is not a finding.
- Assumption: the DOC-01 and DOC-03 checks report like any other (PRD FR-30).
- Open: what counts as a change to a decision, and as an update to a dependent document (design)?

## Dependencies

- **Other features**: FEAT-011 holds the records. FEAT-005 owns the construct register. FEAT-010 owns the skill modes and persona defaults. FEAT-015 invokes setup records for takeover.
- **External services**: A local agent host for session loading; hosts other than the tested ones are unverified. Exact record shapes belong to Contract artifacts.
- **PRD requirements**: FR-1, FR-2, FR-60 (P0); FR-3, FR-4, FR-5 (P1).

## Out of Scope

- Enforcing role permissions or preventing the agent from editing files.
- Offering a mode that prevents the agent from writing manuscript text.
- Generating the changelog entries, errata workflow, and AI-use disclosure (FEAT-009).
- Outline and chapter specifications derived from the inputs (FEAT-006).
- Several authors editing one project at the same time.

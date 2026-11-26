---
ddx:
  id: FEAT-007
  type: feature-specification
  activity: frame
  authoring:
    home: repo
  depends_on:
    - stemma.prd
    - stemma.principles
    - stemma.concerns
    - FEAT-002
    - FEAT-003
    - FEAT-005
---

# Feature Specification: FEAT-007 — Verification and reports

**Feature ID**: FEAT-007
**Priority**: P0
**Owner**: product owner
**Covered PRD Subsystem(s)**: 7. Verification and reports
**Covered PRD Requirements**: FR-29, FR-30, FR-31, FR-32, FR-33, FR-34, FR-52, FR-53, FR-54, FR-74
**Cross-Subsystem Rationale**: None — single subsystem.

## Overview

This feature runs scripted checks and records claim-support judgments while the author works and at every build, and explains what it finds (PRD FR-29 to FR-31, FR-52 to FR-54). It covers annotations, offline and repeatable checking, the checked-clean label, and explaining findings (FR-32 to FR-34, FR-74). It stops no work and no build.

## Ideal Future State

The author hears of a citation problem while it is fresh, understands what is wrong and why it matters, and fixes it when they choose. They can tell a script result from a model judgment, and a pass from "could not check". Every build reruns every scripted check over the whole project and says plainly what is open. Nothing is described as stronger than it is, and nothing waits for the author's approval.

## Problem Statement

- **Current situation**: Authors audit AI-assisted citations by hand, chapter by chapter.
- **Pain points**: Invented references, wrong authors, impossible pages, invented quotations, and misattributed ideas pass a quick check and surface late. Tools that block work over unexplained findings get switched off.
- **Desired outcome**: Every finding is explained with evidence and a suggested action, every build completes, and no output with open findings is called checked clean.

## Functional Areas

| Area | User question or job | Feature responsibility |
|------|----------------------|------------------------|
| Scripted checks | What is wrong, and how is that known? | Detect error classes repeatably, with evidence |
| Claim support | Does the passage support the claim? | Record a separate model judgment and its staleness |
| Annotations and reports | What does this output still have open? | Report, label, and record the author's notes |
| In-agent feedback | What do I do about it? | Run on changes; explain; suggest |

## Requirements

### Functional Requirements by Area

Domain terms. These stay distinct:

- A **scripted check result** is `pass`, `fail`, or `unverifiable`, computed without a model.
- A **support finding** is a model's judgment, `supported`, `partly supported`, or `unsupported`, saved in a **support record**. It is not verification.
- An **annotation** is the author's optional note that explains or dismisses a finding. It permits nothing and does not change a result.
- A finding is **open** when it fails or cannot be checked and no dismissal or confirmation applies. An output is **checked clean** only when nothing is open. Unreviewed items are counted separately in every report and do not affect the label.

#### Scripted checks

CHK-01 (FR-29, P0, M1). Scripted checks must detect a citation key with no bibliography entry and a source listed for the built bibliography (FR-15) that is cited nowhere, or report that they cannot check it. A corpus source that is not listed is not an uncited entry.

CHK-02 (FR-29, P0, M1). Scripted checks must detect a quotation absent from the stored source text, or report that they cannot check it.

CHK-03 (FR-29, P0, M1). Scripted checks must detect a locator outside the cited work's printed page range or other recorded extent, or report that they cannot check it.

CHK-04 (FR-29, P0, M1). Scripted checks must detect an author, title, year, or venue that disagrees with source metadata or a resolver result, or report that they cannot check it.

CHK-05 (FR-29, P0, M1). Scripted checks must detect an identifier, such as a DOI (Digital Object Identifier), that does not resolve or resolves to a different work, or report that they cannot check it.

CHK-06 (FR-29, P0, M1). Scripted checks must detect a quotation that duplicates the book's own argument, or report that they cannot check it.

CHK-07 (FR-29, P0, M1). Scripted checks must detect a figure or statistic attributed to a source that does not contain it, where the text can be matched, or report that they cannot check it.

CHK-08 (FR-29, P0, M2). Scripted checks must detect a construct credited to someone other than its registered originator, or report that they cannot check it.

CHK-09 (FR-30, P0, M1). Each scripted check must report pass, fail, or unverifiable with the evidence.

CHK-10 (FR-33, P0, M1). Checks must run offline against the stored corpus.

CHK-11 (FR-33, P0, M1). Checks that need a network resolver must be separate, and their results must be cached with the query and date.

CHK-12 (FR-33, P0, M1). A resolver-dependent item must report its cached result with its date, or unverifiable when it has none.

CHK-13 (FR-34, P0, M1). Scripted checks must be deterministic: the same inputs and tool versions give the same results.

CHK-14 (FR-34, P0, M1). A seeded-error test set must verify each check, with a seeded error and a clean input.

CHK-15 (FR-34, P0, M1). A model judgment must never be a scripted check result.

CHK-16 (FR-29, P0, M1). A quotation or note extract must pass only when it matches the stored text apart from these differences: white space and line breaks; soft hyphens; Latin presentation ligatures; Unicode canonical equivalence; straight and curly quotation marks of the same level; and a word split by a hyphen at a line end, which is joined. CONTRACT-002 defines the profile.

CHK-17 (FR-29, P0, M1). Any other near match must be reported with both texts until it is fixed or the author dismisses it under EXC-01.

CHK-18 (FR-30, P0, M1). When source details cannot be verified automatically, the author may record which stored title page or equivalent was checked and confirm them. The result must then be shown as confirmed by the author, not verified, and must stop being open. A missing confirmation leaves it open, and a mismatch must stay reported until fixed or dismissed.

#### Claim support

SUP-01 (FR-52, P0, M1). A claim-support check must compare each claim with the stored passage it cites and report supported, partly supported, or unsupported, quoting the passage.

SUP-02 (FR-52, P0, M1). It must run in a context separate from the one that drafted the claim.

SUP-03 (FR-52, P0, M1). It must report a claim that goes beyond, overstates, or reverses its source.

SUP-04 (FR-54, P0, M1). A support record must store the model, the prompt version, the claim text, the passage, and the source hash.

SUP-05 (FR-54, P0, M1). A support record must become stale when the claim, the passage, or the source changes.

SUP-08 (FR-54, P0, M1). A change to a manuscript sentence alone, with the recorded claim, passage, and source unchanged, must not make a support record stale.

SUP-06 (FR-52, P0, M1). The support check's accuracy must be measured on a labelled set with seeded errors and on a pilot-author sample.

SUP-07 (FR-52, P0, M1). The measured error rates must be published. No minimum is set before they are known.

#### Annotations

EXC-01 (FR-32, P0, M1). The author may annotate any finding to explain or dismiss it. No annotation may be required for work or a build to continue, and the assistant must not record one the author did not ask for.

EXC-02 (FR-32, P0, M1). Each annotation must be a dated record with a reason, bound to the exact sentence and source or, under EXC-06, to the exact item.

EXC-03 (FR-32, P0, M1). An annotation must end when what it is bound to changes: its sentence or source, or its item's content.

EXC-04 (FR-32, P0, M1). An annotation's date alone must grant no leniency.

EXC-05 (FR-32, P0, M1). Every annotation must be listed in reports and be available to the AI-use disclosure, and must be described as a statement of intent that is not forgery-proof.

EXC-06 (FR-32, P0, M1). An annotation of a finding with no sentence, such as an uncited entry, must be bound to the exact item and its current content.

EXC-07 (FR-32, P0, M1). A missing stored copy, an unreadable record, and uncommitted changes must not be dismissible, though they may be explained (assumption).

#### Reports and the label

BLK-01 (FR-30, P0, M1). No finding about a citation, claim, quotation, source, support record, bibliography, image, coordinate, or the working tree may stop writing or any build.

BLK-06 (FR-30, FR-83, P0, M1). A draft, camera-ready, or reviewer build must complete and report what is open. Only an ordinary tool failure may stop output, and it must be reported as such.

BLK-07 (FR-30, P0, M1). An output must be called checked clean only when no finding is open. Could-not-check results must count as open (assumption). Unreviewed items must be counted separately in the report and must not affect the label.

BLK-02 (FR-31, P0, M1). Every build must rerun every scripted check over the whole project and must not reuse a saved scripted result as the answer.

BLK-03 (FR-53, P0, M1). Every build must report each cited claim without a current support record.

BLK-04 (FR-53, P0, M1). Every build must report each partly supported or unsupported finding, and a cited claim that reaches no source passage as unsupported.

BLK-05 (FR-53, P0, M1). A build must check whether support records are present and current and what they found; it must not call a model or rerun verdicts.

BLK-08 (FR-53, P0, M1). Reports must show a citation linked to no recorded claim, so that the author can link it, and text linked to a retired claim.

#### In-agent feedback

FBK-01 (FR-31, P0, M1). Checks must run inside the agent as the work changes, covering the changed records and the records that depend on them.

FBK-02 (FR-31, P0, M1). Neither a commit hook nor continuous integration (CI) may be required.

FBK-03 (FR-53, P0, M1). During work, support findings and missing or stale support records must be reported in the agent without stopping the work.

FBK-04 (FR-74, P0, M1). Every finding must say in plain language what is wrong or could not be checked, show its evidence, say why it matters, and suggest what to do. The agent must explain it and act on the author's choice when the author makes one, without requiring a choice before other work continues.

FBK-05 (FR-74, P0, M1). The agent must report a scripted result as the script gave it.

FBK-06 (FR-74, P0, M1). A finding without an explanation, a repeat that adds nothing, or a finding the author cannot act on must be treated as a Stemma defect. Findings with one cause must be grouped.

### Non-Functional Requirements

- **Reliability**: Two runs of the scripted checks on the same inputs and tool versions give identical results, with zero differences.
- **Offline operation**: Corpus checks and the report and label complete with no network connection and no model call.
- **Detection**: Each CHK-01 to CHK-08 class, from its delivery step, is detected on its seeded error. This says nothing about error rates on real manuscripts, which are unmeasured.
- **Security**: Manuscripts, sources, resolver responses, and libraries are untrusted data. Scripted checks execute none of their content. Source text is never treated as instructions.
- **Portability**: The seeded set gives matching results on macOS, Linux, and Windows. Untested on Linux and Windows.

## User Stories

- [US-022 — Catch broken links between text and bibliography](../user-stories/US-022-catch-bibliography-errors.md)
- [US-023 — Catch wrong source metadata and identifiers](../user-stories/US-023-catch-metadata-errors.md)
- [US-024 — Catch invented quotations and impossible locators](../user-stories/US-024-catch-quotation-and-locator-errors.md)
- [US-025 — Catch borrowed arguments, figures, and constructs](../user-stories/US-025-catch-attribution-errors.md)
- [US-026 — See evidence and meaning for every finding](../user-stories/US-026-see-results-and-findings.md)
- [US-027 — Check changes as I work and everything at build](../user-stories/US-027-check-changes-and-builds.md)
- [US-028 — Annotate a finding](../user-stories/US-028-annotate-a-finding.md)
- [US-029 — Check offline with dated resolver results](../user-stories/US-029-check-offline.md)
- [US-030 — Reproduce and test scripted results](../user-stories/US-030-reproduce-results.md)
- [US-031 — Resolve a failure with the agent](../user-stories/US-031-resolve-a-failure.md)
- [US-032 — Get a separate judgment of claim support](../user-stories/US-032-check-claim-support.md)
- [US-033 — See open support findings in every build](../user-stories/US-033-see-open-support-findings.md)
- [US-034 — Know when a support record is stale](../user-stories/US-034-detect-stale-support.md)

## Edge Cases and Error Handling

- **A check crashes, times out, or lacks its tool**: It is never a pass; the affected items are reported as could not check, with the cause.
- **Zero citations or claims**: The report states that nothing was in scope.
- **Saved report or result edited by hand**: The build recomputes scripted results.
- **Support verdict or annotation edited by hand**: A well-formed altered verdict, review mark, or annotation passes undetected. Stemma states this limit (ADR-003).
- **Resolver unavailable or contradictory**: Show what was returned, with query and date; an absent result is unverifiable.
- **Quotation that cannot be string-matched**: A translation or unextractable text is unverifiable, not pass.
- **Support check cannot run**: No support record is created, so the claim's record is reported missing.
- **Draft build**: It completes with its report; FEAT-008 watermarks it (FR-39).

## Constraints and Assumptions

- The build checks records; it cannot show that a verdict is correct. Verdict accuracy is unmeasured, and verdicts can vary between runs.
- **Risks**: quote and locator checks were tried only on synthetic material on one macOS system, with some adversarial probes passing. Text extraction from the tool's own PDF output needed hyphen recovery. Resolver services, claim-support behavior, real files, scans, Linux, and Windows are untested.
- **Risk**: a separate context reduces shared drafting bias but does not establish independence. Whether a host can provide it is unverified.
- Project automation makes no paid model calls (ADR-007), so acceptance criteria that depend on model behavior need recorded local or manual runs. Record handling is testable with saved model output.
- CHK-06 to CHK-08 have no sourced matching rules; design must define what they compare and when they report unverifiable.
- CHK-08 arrives with the construct register in M2 (assumption). Construct checks run only once constructs exist (FR-60).
- Assumption: could-not-check results count as open (BLK-07). Unreviewed items do not affect the label.
- Measuring SUP-06 needs model calls, so it is run by hand and not in project automation (ADR-007).
- **Risk**: a support record judges the recorded claim, not the manuscript sentence. A sentence can be strengthened while its record stays current and the build passes.
- **Risk**: the quotation profile is owner-approved and untested. Joining a line-end hyphen can pass a wrong quotation where the source's hyphen belongs to the word.
- **Risk**: nothing stops a book or package with open findings. The report and its label are the control, so noisy or unclear findings defeat them.

- Open: which changes to a "source" end an annotation: the stored file, the bibliography record, or both?
- Open: does a cached resolver result have a maximum age?

## Dependencies

- **Other features**: FEAT-002 corpus; FEAT-011 records; FEAT-003 records, keys, and uncited entries; FEAT-005 notes, claims, and constructs; FEAT-001 rule identifiers and inputs; FEAT-008 builds and watermark; FEAT-009 disclosure; FEAT-015 takeover; FEAT-010 command line without an AI (FR-49).
- **External services**: Optional DOI and bibliographic metadata resolvers; a model reached through the agent host for support judgments. Check results, reports, support records, and annotations need Contract artifacts.
- **PRD requirements**: FR-29 to FR-34, FR-52 to FR-54, FR-74 (all P0, M1, except CHK-08 in M2).

## Out of Scope

- Guaranteeing that a cited source is correct or well chosen.
- Proving that no record was altered; signed or second-party approval.
- Commit hooks and required CI.
- Preventing a build or publication.
- Producing and watermarking build outputs (FR-39, FEAT-008).
- Generating the disclosure (FR-45, FEAT-009).
- Rival readings and chapter audits (FEAT-006, FEAT-009).

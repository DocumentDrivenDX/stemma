---
ddx:
  id: stemma.parking-lot
  type: parking-lot
  activity: frame
  authoring:
    home: repo
---

# Parking Lot (Deferred / Future Work)

## Purpose

Deferred work that the PRD names as P2 or excludes, tracked without
distorting current commitments.

## Policy

- Rejected items do not belong here; close or cancel them instead.
- Active work does not belong here; track it in the Feature Registry.
- Deferred items include a rationale and a revisit trigger.
- Revisit triggers are objective enough for another agent to evaluate.

## Deferred / Future Items

### Accessible PDF standard
- **Type**: Deferred
- **Artifact Type**: Feature Spec
- **Source**: FR-57
- **Rationale**: PDF/A is the first special PDF standard. No accessible standard such as PDF/UA is promised in v1.
- **Impact if Omitted**: Readers and presses that need a conforming accessible PDF get no promise.
- **Dependencies**: FEAT-008
- **Revisit Trigger**: A pilot author or press requires an accessible PDF.
- **Target Activity/Milestone**: After v1
- **Owner**: product owner
- **Last Reviewed**: 2026-11-26

### Additional citation styles
- **Type**: Deferred
- **Artifact Type**: Feature Spec
- **Source**: PRD P2
- **Rationale**: The first version guarantees only Chicago notes and bibliography.
- **Impact if Omitted**: Authors using other styles get output labelled unverified.
- **Dependencies**: FEAT-003
- **Revisit Trigger**: A pilot author or press needs another guaranteed style.
- **Target Activity/Milestone**: After v1
- **Owner**: product owner
- **Last Reviewed**: 2026-11-26

### Supported local open-weight model use
- **Type**: Future
- **Artifact Type**: Solution Design
- **Source**: PRD P2
- **Rationale**: Material that may not be sent to a hosted model needs the whole process on a local model. In v1 this is an unsupported experiment: not blocked, not promised, and not tested.
- **Impact if Omitted**: Authors with such material have no supported way to use Stemma.
- **Dependencies**: FEAT-010
- **Revisit Trigger**: A pilot author with a restricted corpus requests it.
- **Target Activity/Milestone**: After v1
- **Owner**: product owner
- **Last Reviewed**: 2026-11-26

### Multi-author collaboration on one corpus
- **Type**: Future
- **Artifact Type**: Feature Spec
- **Source**: PRD P2
- **Rationale**: v1 serves one author with reviewers; shared editing adds conflict and permission rules.
- **Impact if Omitted**: Co-authors work through git branches and the PDF.
- **Dependencies**: FEAT-001, FEAT-002
- **Revisit Trigger**: Two pilot authors need concurrent edits on one project.
- **Target Activity/Milestone**: After v1
- **Owner**: product owner
- **Last Reviewed**: 2026-11-26

### Dataset and figure provenance beyond file hashes
- **Type**: Future
- **Artifact Type**: Feature Spec
- **Source**: PRD P2
- **Rationale**: v1 records hashes and credits; lineage tracking for derived data is larger.
- **Impact if Omitted**: Authors in data-heavy fields document derivation by hand.
- **Dependencies**: FEAT-002, FEAT-008
- **Revisit Trigger**: A pilot author in a data-heavy field requests derivation tracking.
- **Target Activity/Milestone**: After v1
- **Owner**: product owner
- **Last Reviewed**: 2026-11-26

### PDF/X output
- **Type**: Deferred
- **Artifact Type**: ADR
- **Source**: PRD Non-Goals, ADR-005
- **Rationale**: Typst does not produce PDF/X.
- **Impact if Omitted**: A printer that requires PDF/X cannot accept the output unconverted.
- **Dependencies**: FEAT-008
- **Revisit Trigger**: A pilot printer or press requires PDF/X.
- **Target Activity/Milestone**: After v1
- **Owner**: product owner
- **Last Reviewed**: 2026-11-26

### Agent-never-writes mode
- **Type**: Deferred
- **Artifact Type**: Feature Spec
- **Source**: PRD Non-Goals
- **Rationale**: The first version offers no mode that prevents the agent from writing prose.
- **Impact if Omitted**: Authors under publisher rules that bar AI-written text get no enforcement from Stemma.
- **Dependencies**: FEAT-006
- **Revisit Trigger**: A pilot author is bound by such a rule.
- **Target Activity/Milestone**: After v1
- **Owner**: product owner
- **Last Reviewed**: 2026-11-26

### Signed or second-party records
- **Type**: Future
- **Artifact Type**: ADR
- **Source**: ADR-003
- **Rationale**: Review marks and annotations are plain dated records in the first version.
- **Impact if Omitted**: Altered records or verdicts can go undetected.
- **Dependencies**: FEAT-007
- **Revisit Trigger**: A publisher or pilot requires stronger assurance, or an altered record is found.
- **Target Activity/Milestone**: After v1
- **Owner**: product owner
- **Last Reviewed**: 2026-11-26

### Editing on maps
- **Type**: Future
- **Artifact Type**: Feature Spec
- **Source**: FR-66
- **Rationale**: Maps are view-only.
- **Impact if Omitted**: Authors change records through the agent or files.
- **Dependencies**: FEAT-013
- **Revisit Trigger**: Pilot authors repeatedly ask to edit on a map.
- **Target Activity/Milestone**: After v1
- **Owner**: product owner
- **Last Reviewed**: 2026-11-26

### Checks in chat and cloud sessions
- **Type**: Future
- **Artifact Type**: Solution Design
- **Source**: FR-50
- **Rationale**: These surfaces get no promise of local checks or builds.
- **Impact if Omitted**: Authors must use a local session.
- **Dependencies**: FEAT-010
- **Revisit Trigger**: A host documents local file, script, and tool access for these sessions.
- **Target Activity/Milestone**: After v1
- **Owner**: product owner
- **Last Reviewed**: 2026-11-26

### Word, LaTeX, and HTML export
- **Type**: Deferred
- **Artifact Type**: Feature Spec
- **Source**: PRD P2, FR-40
- **Rationale**: The owner deferred manuscript export past v1. No native Word export from Typst was found.
- **Impact if Omitted**: Co-authors and publishers who need an editable format get none from Stemma. Legacy bibliography export (FR-13) is unaffected.
- **Dependencies**: FEAT-008
- **Revisit Trigger**: A pilot author's co-author or press requires an editable format; decide then what each format must keep.
- **Target Activity/Milestone**: After v1
- **Owner**: product owner
- **Last Reviewed**: 2026-11-26

### Right-to-left main text
- **Type**: Deferred
- **Artifact Type**: Feature Spec
- **Source**: FR-37
- **Rationale**: v1 promises left-to-right books with right-to-left quotations. Right-to-left main text is experimental.
- **Impact if Omitted**: Authors writing right-to-left books get no promise.
- **Dependencies**: FEAT-008
- **Revisit Trigger**: A pilot author needs a right-to-left main text.
- **Target Activity/Milestone**: After v1
- **Owner**: product owner
- **Last Reviewed**: 2026-11-26

### Desktop-app integration on Linux
- **Type**: Deferred
- **Artifact Type**: Solution Design
- **Source**: FR-50, FR-75
- **Rationale**: v1 targets the scripted tools on Linux but makes no desktop-app promise there; the Claude desktop app on Linux is a beta for some distributions (unverified).
- **Impact if Omitted**: Linux authors run the tools without a promised desktop host.
- **Dependencies**: FEAT-010
- **Revisit Trigger**: A desktop host documents general availability on Linux and an install there is observed.
- **Target Activity/Milestone**: After v1
- **Owner**: product owner
- **Last Reviewed**: 2026-11-26

### Official plugin directory listing
- **Type**: Deferred
- **Artifact Type**: Solution Design
- **Source**: FR-50
- **Rationale**: v1 installs from the project's repository marketplace.
- **Impact if Omitted**: Authors add the marketplace by address, which an organization may restrict.
- **Dependencies**: FEAT-010
- **Revisit Trigger**: v1 is released from the repository marketplace and a directory review is wanted or needed by pilot users.
- **Target Activity/Milestone**: After v1
- **Owner**: product owner
- **Last Reviewed**: 2026-11-26

### Graph engine writes and wider server compatibility
- **Type**: Deferred
- **Artifact Type**: Solution Design
- **Source**: FR-63, ADR-006
- **Rationale**: The first engine scope is the data reads arras's static browser needs.
- **Impact if Omitted**: Changes go to record files, and arras features that need a fuller server are unavailable.
- **Dependencies**: FEAT-011
- **Revisit Trigger**: The read scope passes its conformance cases and a family or pilot use needs writes or another server behavior.
- **Target Activity/Milestone**: After the first engine scope
- **Owner**: product owner
- **Last Reviewed**: 2026-11-26

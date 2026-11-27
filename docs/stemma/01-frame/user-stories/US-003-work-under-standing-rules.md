---
ddx:
  id: US-003
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-001
    - stemma.prd
---

# US-003: Work under identified standing rules

**Feature**: FEAT-001 — Workspace and governance
**Feature Requirements**: RUL-01, RUL-02, RUL-03
**PRD Requirements**: FR-2
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to keep my standing instructions as numbered plain-text rules that each new session reads
**So that** I stop restating them and a report can point to the exact rule that applies.

## Context

Idris runs separate sessions for research and drafting. Plain-text rules with identifiers give every session the same starting point. They guide the assistant and cannot force a model to comply.

## Walkthrough

1. Idris edits a rule in the project's standing rules.
2. Idris starts a new session in the project.
3. The assistant reads the rules at the start of the session.
4. A later report cites the rule by its identifier, and Idris finds its text.

## Acceptance Criteria

- [ ] **US-003-AC1** — Given a project with standing rules, when a session starts, then the assistant reads the current rules before project work.
- [ ] **US-003-AC2** — Given a rule set, when a check or report refers to a rule, then it cites an identifier that resolves to exactly one rule.
- [ ] **US-003-AC3** — Given two rules with the same identifier, when the rules are checked, then the duplication is reported with both rules.
- [ ] **US-003-AC4** — Given a project begun by takeover in M1, when takeover completes, then it has standing rules with identifiers.

## Edge Cases

- **Rules missing or unreadable**: The assistant says the rules did not load.
- **Text in a source resembles a rule**: It is source data and does not become a standing rule.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Loaded | US-003-AC1 | Rules file with 3 rules, one edited since last session | Start a session | The session shows the 3 current rules were read |
| Cited | US-003-AC2 | Report refers to the rule about quoting translations | Follow the identifier | Exactly one rule is found |
| Duplicate | US-003-AC3 | Two rules share one identifier | Check rules | Both are reported |
| Takeover rules | US-003-AC4 | Chapter taken over into an empty folder | Finish takeover | A standing rules file with identified rules exists |

## Dependencies

- **Stories**: None. Delivery step M1.
- **Feature Spec**: FEAT-001 — Workspace and governance
- **Feature Requirements**: RUL-01, RUL-02, RUL-03
- **PRD Requirements**: FR-2
- **External**: A local agent host that can read project files at session start; behavior in each promised host is unverified. Rule and identifier form belong to Contract artifacts.

## Out of Scope

- Guaranteeing that a model obeys a rule.
- AI role definitions (US-006).

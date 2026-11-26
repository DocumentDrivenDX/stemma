---
ddx:
  id: US-001
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-001
    - stemma.prd
---

# US-001: Start a project with its governing records

**Feature**: FEAT-001 — Workspace and governance
**Feature Requirements**: SET-01, SET-02, SET-03, SET-04
**PRD Requirements**: FR-1
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist,
**I want** to state my book's thesis, audience, scope, and citation style once and have the project's records set up
**So that** every later session starts from files that hold my own inputs, with none to build by hand.

## Context

Margit does not want to manage prompts or scripts. Setup is where the governing records come from, for a new book and for one taken over, and any input the assistant filled in unasked would pass as their own.

## Walkthrough

1. Margit asks Stemma to start a book project in an empty folder.
2. Stemma asks for the thesis, audience, scope, and citation style.
3. Margit answers and confirms.
4. Stemma creates the standing rules, changelog, errata, decision log, and registers, and shows where each is.

## Acceptance Criteria

- [ ] **US-001-AC1** — Given an empty project folder, when Margit completes setup with a thesis, audience, scope, and citation style, then the project holds all four as they stated them.
- [ ] **US-001-AC2** — Given completed answers, when setup finishes, then standing rules, changelog, errata, decision log, and registers exist.
- [ ] **US-001-AC3** — Given a taken-over project without governing records, when the author sets it up, then it gets the same record kinds as a new project.
- [ ] **US-001-AC4** — Given an author who supplies no scope, when setup finishes, then the scope is shown as missing and holds no assistant-written text.

## Edge Cases

- **Governing records already exist**: Stemma reports them and overwrites none without the author's explicit choice.
- **Setup stops partway**: Stemma lists the missing records and creates only those on resume.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Inputs kept | US-001-AC1 | Thesis "River trade shaped the town's charter"; audience "historians"; scope "1180-1320"; style Chicago notes and bibliography | Complete setup | All four values are stored unchanged |
| Records created | US-001-AC2 | Completed answers | Finish setup | Each named record exists |
| Takeover parity | US-001-AC3 | Taken-over chapter folder; same answers as US-001-AC2 | Set up | Same record kinds as US-001-AC2 |
| Missing input | US-001-AC4 | Scope left blank | Finish setup | Scope reported missing; no value invented |

## Dependencies

- **Stories**: None.
- **Feature Spec**: FEAT-001 — Workspace and governance
- **Feature Requirements**: SET-01, SET-02, SET-03, SET-04
- **PRD Requirements**: FR-1
- **External**: Record shapes belong to Contract artifacts. Which registers setup creates is open; they vary by persona only once FR-51 (P1) arrives. Delivery step M2: an M1 takeover has only the standing rules.

## Out of Scope

- Constructs and methodology (US-002).
- Converting the manuscript itself during takeover (FEAT-015).
- Outline derivation (FEAT-006).

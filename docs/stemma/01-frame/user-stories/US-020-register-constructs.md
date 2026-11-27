---
ddx:
  id: US-020
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-005
    - stemma.prd
---

# US-020: Register the constructs the book uses

**Feature**: FEAT-005 — Notes, claims, constructs
**Feature Requirements**: CON-01, CON-02, CON-03, CON-04, CON-05, CON-06, CON-07
**PRD Requirements**: FR-22
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to register each concept with its definition, the chapters using it, and its source when borrowed
**So that** I can spot a concept that has lost its definition or its originator.

## Context

Construct drift and misplaced credit are recorded error types. Constructs stated at setup and those borrowed from sources share one register. The author's own construct is marked as the author's and needs a definition. Scripts check references; advice about use is only advice.

## Walkthrough

1. Idris registers a concept borrowed from a captured source.
2. Idris gives its definition, source, and the chapters that use it.
3. Stemma checks the register.
4. The entry passes and appears alongside constructs stated at setup.

## Acceptance Criteria

- [ ] **US-020-AC1** — Given a concept the book uses, when it is registered, then the entry holds its definition and the chapters that use it.
- [ ] **US-020-AC2** — Given a construct taken from a source, when it is registered, then the entry names that source.
- [ ] **US-020-AC3** — Given a construct the author stated under FR-60, when the register is read, then it appears in the same register as other constructs.
- [ ] **US-020-AC4** — Given a borrowed construct with no definition or no source, when the register check runs, then it fails and names what is missing.
- [ ] **US-020-AC5** — Given the author's own construct with no definition, when the register check runs, then it fails, and given one with a definition, then it is shown as the author's.
- [ ] **US-020-AC6** — Given a reference to a construct that is not in the register, when scripted checks run, then the reference is reported.
- [ ] **US-020-AC7** — Given inconsistent use of a construct or of the methodology that the agent notices, when it advises, then the advice is not a check result.

## Edge Cases

- **A listed chapter no longer exists**: The check reports the broken reference.
- **Origin is unknown**: Stemma does not fill in an originator.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Entry | US-020-AC1 | "charter community", definition, chapters 2 and 5 | Save | Definition and chapters stored |
| Borrowed | US-020-AC2 | Taken from source ellery1911rolls | Save | Source named |
| Author stated | US-020-AC3 | Construct added through setup inputs | Read register | One register holds it |
| Incomplete | US-020-AC4 | Entry marked borrowed; no definition, no source | Check | Fail naming both |
| Own construct | US-020-AC5 | Author-marked entry without a definition, then with one | Check | Fail, then pass marked as the author's |
| Reference | US-020-AC6 | Reference to an unregistered construct | Check | Reported |
| Advice | US-020-AC7 | Saved advice on drifting use; no other finding | Build camera-ready | The advice appears in no check result |

## Dependencies

- **Stories**: US-002, US-007, US-016. Delivery step M2.
- **Feature Spec**: FEAT-005 — Notes, claims, constructs
- **Feature Requirements**: CON-01, CON-02, CON-03, CON-04, CON-05, CON-06, CON-07
- **PRD Requirements**: FR-22
- **External**: Originator representation belongs to Contract artifacts.

## Out of Scope

- Checking how drafts credit constructs (US-025).
- Suggestions at takeover (US-106).
- Deriving relations between constructs.

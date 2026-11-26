---
ddx:
  id: US-049
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-014
---

# US-049: Choose and extend a built-in voice profile

**Feature**: FEAT-014 — Voice and Style
**Feature Requirements**: PRO-01, PRO-02, PRO-03
**PRD Requirements**: FR-69
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist,
**I want** to pick a shipped voice profile and add my own preferences
**So that** drafts follow my preferences in later sessions without my restating them.

## Context

Margit does not want to manage prompts. A shipped profile gives a start, and the additions stay separate from it.

## Walkthrough

1. Margit asks which voice profiles are available.
2. Margit chooses one.
3. Margit adds a preference for short sentences, saved as an extension.
4. A later draft follows it.
5. Margit changes the citation style, and the voice profile is unaffected.

## Acceptance Criteria

- [ ] **US-049-AC1** — Given a new project, when the author asks for profiles, then at least one shipped profile can be used without writing one.
- [ ] **US-049-AC2** — Given a shipped profile, when the author extends it, then the extension applies and the shipped profile is unchanged.
- [ ] **US-049-AC3** — Given a project with a profile and a citation style, when either one is changed, then the other is unchanged.

## Edge Cases

- **No profile chosen**: Drafting proceeds without one.
- **An extension asks to alter quotations**: That instruction is not applied to quotations (FR-70).

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Shipped | US-049-AC1 | New project | List profiles | One or more usable profiles |
| Extend | US-049-AC2 | Extension 'no semicolons' | Draft | Extension applies; shipped profile bytes unchanged |
| Separate | US-049-AC3 | Profile set, Chicago notes set | Change voice profile | Citation style setting unchanged |

## Dependencies

- **Stories**: None.
- **Feature Spec**: FEAT-014 — Voice and Style
- **Feature Requirements**: PRO-01, PRO-02, PRO-03
- **PRD Requirements**: FR-69
- **External**: None.

## Out of Scope

- Which profiles ship (open in FEAT-014).
- Citation formatting.

---
ddx:
  id: US-012
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-002
---

# US-012: Send a hosted model only the excerpts needed

**Feature**: FEAT-002 — Source corpus
**Feature Requirements**: RGT-02, RGT-06
**PRD Requirements**: FR-61
**Priority**: P0

## Story

**As a** Tomasz, the scholar outside the humanities,
**I want** to see that a hosted model receives only the excerpts my task needs, and to be told plainly that no source is held back
**So that** I can decide what belongs in the project at all.

## Context

Stemma is for material that may be sent to a language model. It keeps what it prepares to the needed excerpts and does not gate sources. Material that may not be sent needs the whole process on a local model, which v1 neither blocks, promises, nor tests.

## Walkthrough

1. Tomasz asks for help with a claim that cites one page of a long source.
2. Stemma prepares only the needed excerpt.
3. Tomasz asks whether one source can be kept from the model, and Stemma says it cannot.

## Acceptance Criteria

- [ ] **US-012-AC1** — Given a task that needs one passage from a source, when Stemma prepares model input, then it holds that excerpt and no other source text.
- [ ] **US-012-AC6** — Given the author asks whether a source can be kept from a hosted model, when Stemma answers, then it says there is no per-source control, any source in the project may be sent, and an agent with file access can read source files directly.

## Edge Cases

- **Source with community-permission limits**: Its excerpt may be sent like any other; the flag is metadata.
- **Local model**: Stemma does not block it and does not claim to support it.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Needed only | US-012-AC1 | 30-page synthetic source; task needs a page 41 passage | Prepare task input | Only the identified excerpt is present |
| No gate | US-012-AC6 | Author asks to keep one source from the model | Ask | The absence of that control and its consequence are stated |

## Dependencies

- **Stories**: US-008, US-009.
- **Feature Spec**: FEAT-002 — Source corpus
- **Feature Requirements**: RGT-02, RGT-06
- **PRD Requirements**: FR-61
- **External**: A hosted model through the agent host. Delivery of excerpts in each host is unverified. A local session with file access can read source files directly.

## Out of Scope

- Per-source gating of hosted models.
- Restricting the host agent's file access.
- Supporting local models.

---
ddx:
  id: US-115
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-002
    - stemma.prd
---

# US-115: Capture a source and add to it over time

**Feature**: FEAT-002 — Source corpus
**Feature Requirements**: ITR-01, ITR-02, ITR-03, ITR-04
**PRD Requirements**: FR-94
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to start with a source and add its text, library details, and tags when I get to them
**So that** I can use each source at once and improve what I know about it without redoing earlier work.

## Context

The system needs to support iterative metadata capture: start with the source, map it to text, and add library information and tags over time.

## Walkthrough

1. Idris gives Claude a file; Claude captures it before it has any text or details.
2. Later Claude maps it to text, then cites a passage.
3. Claude adds identifiers, takes details from a saved catalogue lookup, and shows where the lookup and the record disagree.
4. Claude tags sources, lists them by tag or stage, and shows a source's history.

## Acceptance Criteria

- [ ] **US-115-AC1** — Given an original with no text or details, when captured, then the source is listed as captured, no finding results, and capturing it again writes nothing.
- [ ] **US-115-AC2** — Given a cited source, when details and tags are added, then its source files, passages, and passage addresses are byte for byte unchanged and no finding results from the additions.
- [ ] **US-115-AC3** — Given a recorded value, when a different one is typed or comes from a lookup, then both are shown and the recorded one is kept unless the author asks to replace it.
- [ ] **US-115-AC4** — Given a replaced value, when the project is checked, then what was selected under the earlier details is reported and the source text results are as before.
- [ ] **US-115-AC5** — Given tagged sources at different stages, when listed by tag, namespace, or stage, then only the matching sources are listed.
- [ ] **US-115-AC6** — Given an enriched source, when its history is shown, then each recorded step says who, when, and, where given, from where.

## Edge Cases

- **A catalogue record of one volume of a set**: Its date may date the set, so it is not taken.
- **One bad tag or source among several**: Nothing is written.
- **A hand edit to a record**: The history does not show it; Git does.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Capture first | US-115-AC1 | A Markdown file | Capture twice, check | One record; nothing open |
| Enrich | US-115-AC2 | A cited passage | Add details and tags | Same bytes and addresses; nothing open |
| Disagree | US-115-AC3 | A lookup giving another year | Apply it | Both years shown; record keeps its year |
| Replace | US-115-AC4 | A recorded title | Replace it | The passage is reported; quotation results unchanged |
| List | US-115-AC5 | Two tagged sources | List by namespace and stage | Matching sources only |
| History | US-115-AC6 | An enriched source | Show history | Actor, time, and origin of each step |

## Dependencies

- **Stories**: US-007, US-112.
- **Feature Spec**: FEAT-002 — Source corpus
- **Feature Requirements**: ITR-01, ITR-02, ITR-03, ITR-04
- **PRD Requirements**: FR-94
- **External**: Source records (CONTRACT-001); the commands (CONTRACT-002 B).

## Out of Scope

- A controlled tag vocabulary or tag records.
- Fetching a catalogue other than those `resolve` already reaches.

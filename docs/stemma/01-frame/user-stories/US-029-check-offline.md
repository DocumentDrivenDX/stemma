---
ddx:
  id: US-029
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-007
    - stemma.prd
---

# US-029: Check offline with dated resolver results

**Feature**: FEAT-007 — Verification and reports
**Feature Requirements**: CHK-10, CHK-11, CHK-12
**PRD Requirements**: FR-33
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist,
**I want** to run my checks without a network and see how old any resolver result is
**So that** I can verify in the field and know which answers came from an earlier lookup.

## Context

Corpus checks depend only on the project's source files and saved lookups. Network lookups are a separate step whose cached results carry the query and date.

## Walkthrough

1. Idris runs resolver checks while online.
2. Stemma caches each result with its query and date.
3. Later Idris runs checks without a network.
4. Corpus checks run, and resolver items show cached dates or unverifiable.

## Acceptance Criteria

- [ ] **US-029-AC1** — Given a complete local corpus and no network, when checks run, then every corpus check completes without network access.
- [ ] **US-029-AC2** — Given a resolver lookup, when its result is saved, then it is cached with the query and date.
- [ ] **US-029-AC3** — Given a cached result and no network, when the item is reported, then the report shows the cached result's date.
- [ ] **US-029-AC4** — Given no cached result and no network, when a resolver-dependent item is checked, then it is unverifiable.

## Edge Cases

- **Record changed after the lookup**: A cached result for a different query is not applied to it.
- **Very old cached result**: Its date is shown; no maximum age is defined.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Offline | US-029-AC1 | Network disabled | Run checks | Corpus checks complete |
| Cache | US-029-AC2 | Lookup of fixture identifier on 2026-02-01 | Run resolver check | Result, query, and date stored |
| Cached | US-029-AC3 | Cache from 2026-02-01 | Run offline | Date shown |
| No cache | US-029-AC4 | Empty cache | Run offline | Unverifiable |

## Dependencies

- **Stories**: US-026.
- **Feature Spec**: FEAT-007 — Verification and reports
- **Feature Requirements**: CHK-10, CHK-11, CHK-12
- **PRD Requirements**: FR-33
- **External**: Optional resolvers; cached-result shape belongs to Contract artifacts. Resolver terms and limits are unverified.

## Out of Scope

- Fetching sources.
- Setting a cache expiry policy.

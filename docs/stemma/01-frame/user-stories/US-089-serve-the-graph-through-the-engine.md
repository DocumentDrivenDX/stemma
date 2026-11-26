---
ddx:
  id: US-089
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-011
---

# US-089: Serve the graph through the engine

**Feature**: FEAT-011 — Evidence graph and graph engine
**Feature Requirements**: ENG-01, ENG-02, ENG-03, ENG-04, ENG-05
**PRD Requirements**: FR-63
**Priority**: P1

## Story

**As a** Priya, the technologist-researcher
**I want** to serve my project's graph to arras from a local graph engine
**So that** I can query a large graph in arras while my record files stay the source of truth.

## Context

The family has no local graph engine in TypeScript. This is P1: no P0 feature waits for it. Its first scope is the data reads arras's static browser needs; writes and wider server compatibility come later.

## Walkthrough

1. Priya builds the engine database from their record files.
2. They start the engine and connect arras to it.
3. They browse and query the graph in arras.
4. They delete the database, rebuild it, and see the same graph.

## Acceptance Criteria

- [ ] **US-089-AC1** — Given a project's record files, when the engine builds its database, then the engine serves the graph from it.
- [ ] **US-089-AC2** — Given the engine database is deleted, when it is rebuilt from the record files, then the served graph content is the same.
- [ ] **US-089-AC3** — Given the same records, when the engine and a direct load are compared, then their graph content matches.
- [ ] **US-089-AC4** — Given the compatibility behaviors defined in the engine Contract, when arras uses the engine, then each defined behavior passes.
- [ ] **US-089-AC5** — Given the engine source, when it is inspected, then it is TypeScript running on Bun with SQLite storage.
- [ ] **US-089-AC6** — Given a project without the engine, when any P0 feature runs, then it does not require the engine.
- [ ] **US-089-AC7** — Given the first engine scope, when arras's static browser makes each data read it needs, then the engine answers it, and a write request is not applied.

## Edge Cases

- **Records changed after the engine build**: The engine does not present stale content as current.
- **Invalid record**: The engine reports the load failure and does not serve the graph as complete.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Serve | US-089-AC1 | Synthetic project | Build and serve | Graph served |
| Rebuild | US-089-AC2 | Delete database | Rebuild | Same content |
| Agreement | US-089-AC3 | Seeded fixtures | Compare engine with direct load | No differences |
| Compatibility | US-089-AC4 | Contract conformance cases | Run with arras | All defined cases pass |
| Stack | US-089-AC5 | Engine source | Inspect | TypeScript, Bun, SQLite |
| Not required | US-089-AC6 | Engine absent | Run P0 checks | Checks complete |
| Read scope | US-089-AC7 | Contract read cases and one write | Send each | Reads answered; write not applied |

## Dependencies

- **Stories**: US-087; US-088.
- **Feature Spec**: FEAT-011
- **Feature Requirements**: ENG-01, ENG-02, ENG-03, ENG-04, ENG-05
- **PRD Requirements**: FR-63
- **External**: arras. The engine interface and compatibility behaviors belong in a Contract.

## Out of Scope

- Claiming conformance to Truss.
- Hosting the engine as a shared service.

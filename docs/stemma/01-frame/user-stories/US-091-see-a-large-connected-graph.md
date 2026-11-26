---
ddx:
  id: US-091
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-012
---

# US-091: See a large connected graph

**Feature**: FEAT-012 — Explorer and typeset preview
**Feature Requirements**: GRV-01, GRV-02, GRV-03, GRV-04
**PRD Requirements**: FR-64
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist
**I want** to view a larger connected part of my evidence graph than arras draws today
**So that** I can see how a book's evidence connects and open any record from the picture.

## Context

A feasibility test found that the arras console view draws at most 150 nodes. The larger view is contributed to arras before the explorer relies on it (ADR-008), so its schedule depends on arras acceptance. The target size is an open question.

## Walkthrough

1. Idris opens the connected-graph view on his project.
2. The view draws a connected set larger than arras offers today.
3. He narrows it and selects a node.
4. The record for that node opens.

## Acceptance Criteria

- [ ] **US-091-AC1** — Given a synthetic connected set with more nodes than the current arras limit, when Idris opens the view, then it draws the set.
- [ ] **US-091-AC2** — Given a released explorer that uses the view, when its dependencies are inspected, then the view comes from arras, not a private fork.
- [ ] **US-091-AC3** — Given a drawn node, when he selects it, then its record opens.
- [ ] **US-091-AC4** — Given a graph the view shows only in part, when it renders, then the view states that content is omitted.
- [ ] **US-091-AC5** — Given keyboard use only, when he explores the graph content, then every node and link is reachable as text.

## Edge Cases

- **arras has not accepted the view**: The explorer does not rely on it.
- **Graph beyond the supported size**: The user is asked to narrow it, with the limit stated.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Larger view | US-091-AC1 | Synthetic connected graph of 600 nodes (assumed test size) | Open the view | All 600 drawn, or the omission stated per AC4 |
| Upstream | US-091-AC2 | Released explorer | Inspect dependencies | arras release holds the view |
| Open record | US-091-AC3 | Drawn claim node | Select it | Claim record opens |
| Partial | US-091-AC4 | Graph above the view's limit | Render | Omission stated |
| Keyboard | US-091-AC5 | 600-node graph | Use keyboard only | Text equivalent lists nodes and links |

## Dependencies

- **Stories**: US-090.
- **Feature Spec**: FEAT-012
- **Feature Requirements**: GRV-01, GRV-02, GRV-03, GRV-04
- **PRD Requirements**: FR-64
- **External**: arras acceptance of the larger view.

## Out of Scope

- Argument and geographic maps (FEAT-013).
- Path finding and graph analytics.

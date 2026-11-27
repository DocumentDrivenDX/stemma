---
ddx:
  id: US-031
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-007
    - stemma.prd
---

# US-031: Resolve a failure with the agent

**Feature**: FEAT-007 — Verification and reports
**Feature Requirements**: FBK-04, FBK-05, FBK-06
**PRD Requirements**: FR-74
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist,
**I want** to see why something failed, look at the evidence, and choose a fix
**So that** I can resolve problems in plain language without reading script output.

## Context

Cautious users abandon a tool that refuses without explanation. The agent explains and offers; it does not soften a script result or decide for the author.

## Walkthrough

1. Margit types a wrong page number and the check fails.
2. The agent explains the failure and shows the recorded range and source text.
3. The agent offers fixes and Margit chooses to repoint the citation.
4. The agent applies that choice and reports the new result from the rerun.

## Acceptance Criteria

- [ ] **US-031-AC1** — Given a failed check, when the agent raises it, then it explains the failure, shows the evidence, and offers fixes.
- [ ] **US-031-AC2** — Given a raised support finding, when the agent presents it, then it explains it, quotes the passage, offers fixes, and identifies it as a model judgment.
- [ ] **US-031-AC3** — Given offered fixes, when the author chooses one, then the agent applies that choice and no other change to the argument.
- [ ] **US-031-AC4** — Given a scripted result of fail or unverifiable, when the agent reports it, then it states that result even if the agent believes the citation is right.
- [ ] **US-031-AC5** — Given any finding, when the agent presents it, then it says what is wrong, shows the evidence, says why it matters, and suggests what to do in plain language, groups findings with one cause, and continues other work without requiring a choice.

## Edge Cases

- **Author chooses nothing**: The item stays unresolved.
- **No safe fix is available**: The agent says so and does not invent a replacement source or passage.
- **Source text contains instructions**: It is shown as evidence, never followed.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Explain | US-031-AC1 | p. 412 for pages 31-60 | Make the edit | Explanation, range, and options shown |
| Finding | US-031-AC2 | Partly supported record | View finding | All shown, labelled model judgment |
| Choice | US-031-AC3 | Author picks repoint to p. 41 | Apply | Only locator changes; checks rerun |
| As given | US-031-AC4 | Script: unverifiable; agent finds the quote plausible | Report | Reported unverifiable |
| Explained | US-031-AC5 | One missing source cited three times | Check in session | One explained group; work continues |

## Dependencies

- **Stories**: US-026, US-032.
- **Feature Spec**: FEAT-007 — Verification and reports
- **Feature Requirements**: FBK-04, FBK-05, FBK-06
- **PRD Requirements**: FR-74
- **External**: Agent host. Agent wording and fidelity are model-dependent and need recorded manual runs; Stemma cannot guarantee model behavior.

## Out of Scope

- Takeover resolution rounds (FEAT-015).
- Automatic fixes without a choice.

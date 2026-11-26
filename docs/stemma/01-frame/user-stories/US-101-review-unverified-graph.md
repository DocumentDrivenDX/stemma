---
ddx:
  id: US-101
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-015
---

# US-101: Review the unverified graph and uncertain footnotes

**Feature**: FEAT-015 — Takeover of existing projects
**Feature Requirements**: GRF-01, GRF-02, GRF-03, GRF-04, GRF-05, GRF-06, GRF-07, GRF-08, GRF-09
**PRD Requirements**: FR-72
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist
**I want** to review what takeover found in my manuscript and answer the footnotes it could not resolve
**So that** I know nothing was assumed to be correct or guessed for me.

## Context

Typed footnotes with short forms and ibid. can point to the wrong work. A prototype resolved most such forms on hand-built fixtures but did not notice some kinds. Recovered claims take effect at once, marked unreviewed; Margit reviews them when she likes, in batches shown with their original passages. Review does not check them.

## Walkthrough

1. Margit opens the takeover report.
2. She sees references, quotations, and claims, all unverified, each traced to its place in her manuscript.
3. She opens an ambiguous short-form footnote with its candidates and the reason.
4. She chooses the intended work or leaves it unresolved.

## Acceptance Criteria

- [ ] **US-101-AC1** — Given a manuscript with full references, partial references, quotations, and claims, when takeover completes, then each found item is in the graph.
- [ ] **US-101-AC2** — Given any item takeover created, when Margit inspects it before its checks run, then it is unverified, meaning not yet checked.
- [ ] **US-101-AC3** — Given any created item, when she asks where it came from, then its place in an original is shown.
- [ ] **US-101-AC4** — Given a typed footnote that cannot be resolved with certainty, when takeover runs, then it goes to her with candidates and the reason, and no source is assigned.
- [ ] **US-101-AC5** — Given the same originals and tool versions, when takeover resolves footnotes twice, then the automatic resolutions are identical and use no model judgment.
- [ ] **US-101-AC6** — Given a partial reference, when it is created, then missing data stays missing.
- [ ] **US-101-AC7** — Given a recovered reference with no stored copy, when a check evaluates its citation, then it is reported as unchecked.
- [ ] **US-101-AC8** — Given extracted claims that Margit has not reviewed, when the ledger and checks run, then the claims are in effect and shown as unreviewed.
- [ ] **US-101-AC9** — Given a batch of extracted claims, when she chooses to review it, then each is shown with its original passage and she can mark the batch reviewed.
- [ ] **US-101-AC10** — Given a claim in a batch, when she edits or retires it, then her edited version is in effect or the retired claim is not, and review changes no check result.

## Edge Cases

- **Footnote form not recognized**: It is reported as unresolved or unrecognized, never counted as passing.
- **Manuscript with no references**: The report says none were found; this is not a pass.
- **Takeover run again**: Margit's earlier choices are not overwritten (assumption).

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Items | US-101-AC1 | Synthetic chapter with 2 full, 1 partial reference, 1 quotation, 2 claims | Take over | All appear |
| Unverified | US-101-AC2 | Embedded-field reference | Inspect | Unverified |
| Trace | US-101-AC3 | Quotation from footnote 4 | Ask origin | Footnote 4 shown |
| Ambiguous | US-101-AC4 | Short form `Author, Short Title, 12` matching two works | Take over | Sent to author with both |
| Repeat | US-101-AC5 | Same fixtures | Run twice | Same resolutions, no model call for them |
| Partial | US-101-AC6 | Footnote with author and page only | Inspect | Title and year absent |
| No copy | US-101-AC7 | Recovered reference without a stored file | Run checks | Reported unchecked |
| Pending | US-101-AC8 | Extracted claim, no decision | Use ledger | In effect; shown unreviewed |
| Batch | US-101-AC9 | 3 extracted claims | Review | 3 passages shown; batch can be marked reviewed |
| Edit and retire | US-101-AC10 | Edit 1, retire 1, mark 1 reviewed | Apply | Edited and reviewed in effect; check results unchanged by review; retired not |

## Dependencies

- **Stories**: US-099; US-100.
- **Feature Spec**: FEAT-015
- **Feature Requirements**: GRF-01, GRF-02, GRF-03, GRF-04, GRF-05, GRF-06, GRF-07, GRF-08, GRF-09
- **PRD Requirements**: FR-72
- **External**: FEAT-005 (claims and notes), FEAT-002 (stored copies), FEAT-007 (checks).

## Out of Scope

- Suggesting constructs or methodology (US-106).
- Claim-support verdicts.

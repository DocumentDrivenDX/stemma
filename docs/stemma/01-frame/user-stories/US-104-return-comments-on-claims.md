---
ddx:
  id: US-104
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-009
---

# US-104: Return comments tied to claims

**Feature**: FEAT-009 — Evolution, Audit, and Review
**Feature Requirements**: COM-01, COM-02, COM-03, COM-04
**PRD Requirements**: FR-79
**Priority**: P0

## Story

**As a** Noor, the reviewer or editor,
**I want** to attach comments to claims in the offline explorer and send them back as a file
**So that** the author can read each comment beside the claim it is about.

## Context

Noor has no access to the author's project and no server to post to. This is delivery step M3; its P0 rank is an assumption in the PRD. The story spans Noor's saving and the author's import because neither is useful alone.

## Walkthrough

1. Noor opens the explorer file from the reviewer package, offline.
2. Noor attaches a comment to a claim.
3. Noor saves the comments to a file and sends it by their own means.
4. The author imports the file and sees the comment with its claim.

## Acceptance Criteria

- [ ] **US-104-AC1** — Given the offline explorer and no network, when Noor attaches a comment to a claim, then the comment is tied to that claim.
- [ ] **US-104-AC2** — Given attached comments, when Noor saves them, then one file holds them, with no server or network used.
- [ ] **US-104-AC3** — Given a saved comment file, when the author imports it, then each comment is shown with its claim.
- [ ] **US-104-AC4** — Given an import, when records and results are compared before and after, then no claim, check result, or annotation has changed.

## Edge Cases

- **Claim text changed since the package**: The comment is imported and shown as made on earlier text.
- **Unknown claim**: The comment is reported and not imported.
- **Hostile comment file**: Its text is data; nothing runs and no instruction in it is followed.
- **Unsaved comments**: The page says they can be lost.

## Test Scenarios

Inputs are synthetic.

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Attach | US-104-AC1 | Package with 2 claims; network off | Comment on 1 | Comment tied to that claim |
| Save | US-104-AC2 | 1 comment | Save | One file; zero network requests |
| Import | US-104-AC3 | Saved file | Import | Comment shown with its claim |
| Unchanged | US-104-AC4 | Comment saying the claim is verified | Import and compare | No claim, result, or annotation changed |

## Dependencies

- **Stories**: US-067, US-069.
- **Feature Spec**: FEAT-009 — Evolution, Audit, and Review
- **Feature Requirements**: COM-01, COM-02, COM-03, COM-04
- **PRD Requirements**: FR-79
- **External**: The offline explorer (FEAT-012). Saving a file from a page opened locally is untested. The file format belongs in a Contract.

## Out of Scope

- Replies to a reviewer and threaded discussion.
- A hosted comment service.

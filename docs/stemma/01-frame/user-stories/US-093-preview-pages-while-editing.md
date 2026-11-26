---
ddx:
  id: US-093
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-012
---

# US-093: Preview typeset pages while editing

**Feature**: FEAT-012 — Explorer and typeset preview
**Feature Requirements**: PRV-01, PRV-02, PRV-03, PRV-04, PRV-05, PRV-06
**PRD Requirements**: FR-65
**Priority**: P0

## Story

**As a** Idris, the AI-fluent humanist
**I want** to see my edits to a chapter on preview pages after a rebuild and reload
**So that** I can judge an edit on the page without running a full build.

## Context

The browser compiles Typst for preview. Browser compilation has not been spiked: size, version lag, citation formatting, and host security policies are risks, and the PRD asks that M3 design test it first. After an edit the agent rebuilds the offline preview and the author reloads it; an open page does not update by itself.

## Walkthrough

1. Idris opens a chapter's preview.
2. He edits a sentence that carries a citation.
3. The agent rebuilds the offline preview; Idris reloads it, and the browser compiles the pages with the citation formatted.
4. The page is identified as a preview and flagged if it differs from print.

## Acceptance Criteria

- [ ] **US-093-AC2** — Given an edit to a citation or its locator, when the preview updates, then the citation is formatted by citeproc-js.
- [ ] **US-093-AC3** — Given a preview page known to differ from print, when it is shown, then it is flagged.
- [ ] **US-093-AC4** — Given no basis to compare a preview page with print, when it is shown, then the explorer says it cannot tell whether they match.
- [ ] **US-093-AC5** — Given an up-to-date preview, when a build check or release looks for output, then the preview does not count as a camera-ready or reviewer output.
- [ ] **US-093-AC6** — Given compilation fails or is blocked, when he opens or reloads the preview, then the explorer says so and does not present older pages as current.
- [ ] **US-093-AC7** — Given an edited sentence, when the agent rebuilds the offline preview and Idris reloads it, then the preview page shows the new text, compiled in the browser.

## Edge Cases

- **Compiler version differs from the pinned print version**: Pages are flagged as possibly different from print.
- **Unsupported figure in preview**: The explorer reports it rather than dropping it silently.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Citation | US-093-AC2 | Note citation with a page locator | Change locator to 45 | Preview citation shows 45 |
| Differs | US-093-AC3 | Fixture with a seeded layout difference | Compare | Page flagged |
| Unknown | US-093-AC4 | No print output exists | Open preview | States match is unknown |
| Not a build | US-093-AC5 | Current preview, no camera-ready build | Check release state | No camera-ready output exists |
| Blocked | US-093-AC6 | Browser policy blocking the compiler | Open or reload preview | Failure stated; nothing shown as current |
| Rebuild and reload | US-093-AC7 | Open preview; edit 1 sentence | Rebuild, then reload | New text on the compiled page |

## Dependencies

- **Stories**: US-092.
- **Feature Spec**: FEAT-012
- **Feature Requirements**: PRV-01, PRV-02, PRV-03, PRV-04, PRV-05, PRV-06
- **PRD Requirements**: FR-65
- **External**: A browser Typst compiler and citeproc-js. Compatibility with the pinned Typst version is unverified.

## Out of Scope

- Camera-ready output and watermarks (FEAT-008).
- A fallback design if browser compilation proves unworkable.

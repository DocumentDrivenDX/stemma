---
ddx:
  id: FEAT-014
  type: feature-specification
  activity: frame
  authoring:
    home: repo
  depends_on:
    - stemma.prd
    - stemma.concerns
---

# Feature Specification: FEAT-014 — Voice and Style

**Feature ID**: FEAT-014
**Priority**: P0
**Owner**: product owner
**Covered PRD Subsystem(s)**: 14. Voice and style
**Covered PRD Requirements**: FR-69, FR-70
**Cross-Subsystem Rationale**: None — single subsystem.

## Overview

Voice and style profiles guide how assistant-drafted prose sounds. This feature
covers PRD FR-69 and FR-70, both in delivery step M2: shipped profiles that an
author extends, and amendment from the author's own writing.

## Ideal Future State

The author picks a shipped profile, adds their own preferences, and shows the
assistant passages they wrote. The assistant makes a specific change to the
profile, marked unreviewed; the author sees it and can revise or retire it, and later drafts follow it. Quotations
and claims say what they said before.

## Problem Statement

- **Current situation**: Authors restate style preferences in each assistant
  session or edit generic prose afterwards.
- **Pain points**: Drafts do not sound like the author, preferences are lost
  between sessions, and a style rewrite can quietly alter a quotation or
  strengthen a claim.
- **Desired outcome**: Preferences persist in the project, every change is
  visible until reviewed, and none licenses a change of evidence or assertion.

## Functional Areas

| Area | User question or job | Feature responsibility |
|------|----------------------|------------------------|
| Profiles | Where do I start, and how do I make it mine? | Ship built-ins and keep author extensions apart from them |
| Amendment | Can it learn from how I write? | Make visible changes from the author's examples and keep the examples |

## Domain Objects

| Object | Meaning |
|--------|---------|
| Voice and style profile | Guidance on prose voice and style |
| Citation style | How citations and bibliography are formatted (FEAT-008). It is not part of a profile |
| Built-in profile | A profile shipped with Stemma |
| Extension | The author's additions or changes layered on a profile |
| Example | A passage of the author's own writing that shows the target output |
| Amendment | A profile change made from examples, in effect and unreviewed until the author reviews it |

## Requirements

### Functional Requirements by Area

#### Profiles

- **PRO-01** (FR-69). Stemma must ship voice and style profiles, a neutral
  academic one plus a few humanities variants, that a project can use without
  writing one.
- **PRO-02** (FR-69). An author must be able to extend a profile. The extension
  must leave the built-in unchanged.
- **PRO-03** (FR-69). Voice and style profiles must be separate from the
  citation style: changing one must not change the other.

#### Amendment

- **AMD-01** (FR-70). The author must be able to amend a profile by providing
  examples of the target output taken from their own writing.
- **AMD-02** (FR-70). An amendment must take effect at once, be shown entry by
  entry and marked unreviewed, and be revisable or retirable by the author. The
  examples behind it must be saved with the project.
- **AMD-03** (FR-70). A profile must never change a quotation or what a claim
  asserts. An amendment or profile instruction that asks for either must not be
  followed for that text.

### Non-Functional Requirements

- **Reliability**: On a seeded passage with quotations, applying any shipped
  profile leaves 100% of quotation text identical.
- **Compatibility**: A project's extensions are unchanged by an update
  to the shipped profiles (0 differences in the author's files).
- **Rights**: Applying or amending a profile sends a hosted model only the
  excerpts the task needs (FR-61).
- **Performance** and **Scalability**: N/A. The PRD sets no target.

## User Stories

- [US-049 — Choose and extend a built-in voice profile](../user-stories/US-049-extend-a-built-in-profile.md)
- [US-050 — Amend a profile from the author's writing](../user-stories/US-050-amend-a-profile-from-own-writing.md)

## Edge Cases and Error Handling

- **Example contains quoted material**: Style is not learned from the quoted
  words as if they were the author's (assumption); the author is told.
- **Examples conflict with the profile or each other**: The assistant names the
  conflict and leaves the choice to the author.
- **No profile set**: Drafting proceeds without one.
- **Profile instruction would soften or strengthen a hedge**: The claim's
  assertion wins. A restyled manuscript sentence does not make its support
  record stale (FR-54), so the support check does not catch a strengthened
  sentence whose recorded claim is unchanged.
- **Retired amendment**: The profile returns to the earlier version.
- **Shipped profile changes in an update**: The author's extension stays; if it
  no longer applies cleanly, the author is told before drafting uses it.

## Constraints and Assumptions

- Concerns: `honest-assurance` (a script can compare quotation text with the
  source; no script proves a rewrite kept a claim's meaning, so AMD-03
  rests on instruction and the author for assertions in manuscript sentences),
  `ai-disclosure` (record the profile in use and the model and prompt version
  behind a change), `plain-file-graph` (project profiles diff and merge as
  text), `rights-and-permissions`, and `security-owasp` (an example is data, not
  instructions).
- Voice sources are built-in profiles and the author's own writing only.
- That an example is the author's own writing is the author's statement. Stemma
  does not verify it.
- Unverified: whether amendment makes drafts closer to the author was not
  tested.

## Dependencies

- **Other features**: FEAT-001 (profiles belong to a project). FEAT-011 holds project records. FEAT-006 applies
  a profile when set; FEAT-007 checks the resulting quotations and claims.
- **External services**: the hosted model of the author's assistant session.
- **PRD requirements**: FR-69, FR-70.

## Out of Scope

- Citation style selection and formatting (FEAT-008).
- Profiles learned from third-party writing.
- Training or fine-tuning a model.
- Rewriting quotations for house style.
- Measuring or certifying that prose matches an author.

## Open Questions

- [ ] Which humanities variants ship beside the neutral academic profile?
  Product owner.

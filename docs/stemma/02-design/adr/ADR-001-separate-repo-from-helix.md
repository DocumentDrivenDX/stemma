---
ddx:
  id: stemma.adr-001
  type: adr
  activity: design
  authoring:
    home: repo
  depends_on:
    - stemma.product-vision
---

# ADR-001: Stemma is a separate repository from HELIX

## Problem

HELIX specifies software delivery: its activities, artifact catalog, and
alignment skill target code. Stemma needs different artifacts (sources, notes,
claim ledger, chapters) and different verification (citation resolution,
quotation checks). The long-term goal is academic book production.

## Decision

Stemma lives in its own repository, `DocumentDrivenDX/stemma`, and ships its own
plugin and single skill. HELIX is the method used to specify and design Stemma
(see `.helix.yml`), not a runtime dependency. Stemma follows HELIX conventions:
one public skill, artifacts with `ddx` front matter, an authority hierarchy.

## Why We Chose This

### Over shipping Stemma as a flow that runs inside HELIX
Authors would have to install HELIX, and book artifacts and book verification
would sit inside a method built for software delivery.

### Over shipping Stemma separately and also as a HELIX flow
A second packaging would add work before any author has used the first.

## Consequences

**Good**: Stemma releases independently of HELIX, and authors use it without
HELIX installed.

**Trade-offs**: Shared conventions must be kept aligned by hand. They may later
move into a common catalog if a second non-software domain appears.

**Drift signals to watch**: An author-facing step that calls a HELIX skill or
script.

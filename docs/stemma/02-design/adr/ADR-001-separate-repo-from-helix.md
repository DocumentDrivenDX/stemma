---
ddx:
  id: stemma.adr-001
  depends_on:
    - stemma.product-vision
---

# ADR-001: Stemma is a separate repository from HELIX

## Status

Accepted

## Context

HELIX specifies software delivery: its activities, artifact catalog, and
alignment skill target code. Stemma needs different artifacts (sources, notes,
claim ledger, chapters) and different verification (citation resolution,
quotation checks). The long-term goal is academic book production.

## Decision

Stemma lives in its own repository, `DocumentDrivenDX/stemma`, and ships its own
plugin and single skill. HELIX is the method used to specify and design Stemma
(see `.helix.yml`), not a runtime dependency. Stemma follows HELIX conventions:
one public skill, artifacts with `ddx` front matter, an authority hierarchy.

## Consequences

- Stemma releases independently of HELIX.
- Stemma is usable without HELIX installed.
- Shared conventions may later move into a common catalog if a second non-software domain appears.

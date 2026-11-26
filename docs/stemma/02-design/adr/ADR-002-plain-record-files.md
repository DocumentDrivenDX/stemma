---
ddx:
  id: stemma.adr-002
  type: adr
  activity: design
  authoring:
    home: repo
  depends_on:
    - stemma.prd
---

# ADR-002: Stemma records are plain JSON files, defined in UMF

## Problem

References and all supporting data form a graph (FR-62). The format must hold
what legacy bibliography formats cannot, and must diff, merge, and outlive any
one tool. UMF is the DocumentDrivenDX schema format.

## Decision

We will make Stemma's own graph records the official format: one canonical JSON
file per record, with structure defined in UMF. Legacy bibliography formats are
imports and exports. Importing a legacy library and exporting the same format
keeps its information; layout may change. Indexes, graph databases, and arras
graph files are derived and rebuildable.

## Why We Chose This

### Over holding the records inside a UMF extension vocabulary
Research reading of UMF found that it chiefly describes structures, and that
holding a corpus would need upstream work on cross-file references and stable
rewriting.

### Over a web-standards graph without UMF
It would give up the family schema tool, and arras would still need a UMF
definition file.

### Over a legacy bibliography format as the official record
Legacy formats cannot hold passages, claims, constructs, places, or their
links.

## Consequences

**Good**: Records are readable and comparable, and legacy formats do not limit
the model.

**Trade-offs**: Stemma owns the converters and must keep unrecognized legacy
values. Exporting Stemma data to a legacy format may lose what that format cannot hold.

**Drift signals to watch**: A fact stored only in a database; a model field
dropped because a legacy format lacks it.

## Assumptions

- UMF can express the record types: an unsupported tagged variant or constraint
  would invalidate this. A feasibility test accepted two broken definitions that
  the arras loader rejected, so UMF validation alone is not enough.

## Validation

**Result**: not tested
**Evidence**: A feasibility test wrote hard humanities records as canonical JSON
on one system with synthetic data.

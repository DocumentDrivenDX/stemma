---
ddx:
  id: stemma.concern.plain-file-graph
  authoring:
    home: repo
---

# Concern: plain-file-graph

## Category

data

## Areas

data

## Slot

datastore

## Boundary

Owns how the evidence graph is stored. It does not own citation rules
(`citation-integrity`) or the explorer.

## Components

- Records: one canonical JSON file each, in git, with structure defined in UMF
  (the DocumentDrivenDX schema format).
- Source text: Markdown source files in git, one per page or section; originals stay outside, tied by content hash.
- Indexes and graph databases: SQLite, derived and rebuildable.
- Restricted values: a store outside the repository.

## Drift Signals

- A fact that exists only in a database.
- A write that reaches an index before, or without, its record file.
- A restricted coordinate, or a hash that allows guessing one, in the repository.

## When to use

Projects whose records must diff, merge, and outlive any one tool.

## Artifact Impact

Selecting this concern requires the architecture, data design, and graph engine
design to treat record files as the source of truth (ADR-002, ADR-006).

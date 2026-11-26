---
name: stemma
description: |
  Stemma skill, the single public entrypoint for researching and writing
  academic books with verified citations. Engage on prompts to find, verify,
  or record sources; take reading notes with locators; build or check a claim
  ledger; outline, draft, revise, or assemble a chapter or book; manage a
  bibliography or citation style; or audit a draft for unsupported claims or
  unresolved references.
argument-hint: "[mode] [intent or scope]"
---

# Stemma Router

Stub. The modes below are the planned contract; none is implemented yet.
Rule: do not add separate public `stemma-*` skills. Add or refine a mode here.

## Planned modes

| Mode | Purpose |
|---|---|
| `frame` | Capture the thesis, audience, scope, and style (citation style, voice). |
| `research` | Find candidate sources and record each as a verified source record. |
| `note` | Extract reading notes with page-level locators; propose claim-ledger entries. |
| `outline` | Derive the outline and chapter specs from the thesis and the claim ledger. |
| `draft` | Write a chapter using only claims the ledger supports. |
| `verify` | Check DOIs, titles, and quotations against the real sources; flag unsupported claims. |
| `assemble` | Build the manuscript and bibliography in the target format (Markdown, LaTeX, DOCX). |

## Invariants

- Never create a citation that has no verified source record.
- Every draft claim links to a claim-ledger entry with source and locator.
- The bibliography file is the single source of truth for references.

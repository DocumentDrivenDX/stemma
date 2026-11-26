---
ddx:
  id: stemma.product-vision
  authoring:
    home: repo
---

# Product Vision

## Mission Statement

Stemma is a document discipline and toolchain for researching, writing, and
typesetting scholarly books with AI assistance, in which every citation is
checked by scripts and no claim enters the manuscript without a trail to a
source the author admitted.

## Positioning

For academic researchers who want AI to speed up research and composition but
cannot accept fabricated or misattributed sources, Stemma is a plugin that
combines governed project documents, a source and citation store, deterministic
verification gates, and a typesetting pipeline. Unlike general chat assistants,
it does not ask the author to trust the model: the model proposes, scripts
verify, and a commit cannot land until the checks pass. Unlike reference
managers, it covers the whole path from sources to a camera-ready book. Unlike
one-off prompt libraries, it keeps the rules, registers, and audit trail with
the manuscript.

## Vision

An author hands a chapter to an AI assistant and gets back faster research and
fluent prose. Every in-text citation resolves to a record in the project's own
bibliography. Every record points to a stored copy of the source. Every
quotation appears in that copy, and every page locator falls inside it. A
reviewer, editor, or publisher can reproduce those checks and read an account
of how the AI was used. The same repository then produces a camera-ready PDF.

AI-written prose is welcome. Invented evidence is not.

**North Star**: A book can be written at AI speed without a single reference
the author or a reviewer cannot verify.

## User Experience

A scholar starts a project and states the thesis, the audience, and the
citation style. Stemma creates the standing rules and registers. The scholar
adds the sources they already hold and asks an assistant to search for more.
Found sources arrive as candidates and become citable only after the scholar
admits them and a stored copy passes the checks.

For each chapter the scholar and the assistant build notes that point to exact
passages, record claims against those notes, and draft from the claims. A
separate audit pass with fresh context argues the rival readings and repairs
the citations. A commit that adds a citation the checks cannot verify is
refused. When the chapters pass, one command typesets the book, with
bibliography, index, and front and back matter, as a camera-ready PDF.

## Target Market

| Attribute | Description |
|-----------|-------------|
| Who | Academic researchers writing books or long articles: first in the humanities, then technologists researching technology and scholars in other fields |
| Pain | AI produces plausible references that do not exist, wrong authors, wrong page numbers, and invented quotations. Checking by hand costs the time the AI saved |
| Current Solution | Chat assistants plus manual checking, a reference manager, a word processor, and a separate typesetting step |
| Why They Switch | Verification is automatic and enforced, so AI output can be used without a full manual audit, and the same source of truth feeds the typeset book |

## Key Value Propositions

| Value Proposition | Customer Benefit |
|-------------------|------------------|
| Verification gates that must pass before a commit | Fabricated or misattributed citations cannot enter the manuscript |
| Closed corpus with provenance | Every claim traces to a stored source the author chose to admit |
| Built-in citation store | No dependency on an external reference manager, and no export step to break |
| Governed documents and registers | Decisions, corrections, and changes persist across sessions and collaborators |
| Role-separated AI passes | Research, drafting, and audit run with fresh context, so the drafter does not grade its own work |
| Camera-ready typesetting from the same files | One source of truth from notes to finished PDF |
| Generated disclosure and audit trail | Reviewers and publishers can see what the AI did and re-run the checks |

## Success Definition

These strategic goals guide learning and priorities; they imply no delivery
gate.

| Metric | Target |
|--------|--------|
| Unverifiable citations in an assembled manuscript | Zero, enforced by the gate rather than by review |
| Author time spent on manual citation checking | A large reduction against the author's prior method (hypothesis; to be measured with pilot authors) |
| Reviewer reproduction | A reviewer re-runs the checks on a clean checkout and gets the same result |
| Book build | One command produces the camera-ready PDF from the repository |
| Adoption across personas | A pilot completes a book chapter in each of the personas in the PRD |

## Why Now

AI assistants now draft and search at a level that changes how scholars work,
and the failure mode is well documented: fabricated citations have reached
government reports and journals, and scholarly communities are responding with
bans and disclosure rules. Authors who use AI
openly need practices that catch these errors, packaged as a reusable tool.
Packaging them as scripts and gates lets scholars with less time and less AI
experience get the same protection.

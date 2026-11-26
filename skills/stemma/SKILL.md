---
name: stemma
description: |
  Stemma skill, the single public entrypoint for researching and writing
  academic books with checked citations. Engage on prompts to start a book or
  take over an existing manuscript; find, admit, or record sources; take reading
  notes with locators; build or check a claim ledger; outline, draft, revise, or
  build a chapter or book; adjust voice, style, or citation style; or audit or
  package a draft for review.
argument-hint: "[mode] [intent or scope]"
---

# Stemma Router

Stub. The modes below are the planned contract; none is implemented yet.
Rule: do not add separate public `stemma-*` skills. Add or refine a mode here.

## Planned modes

| Mode | Purpose |
|---|---|
| `start` | Capture thesis, audience, scope, and citation style; ask for constructs and research methodology, which are optional. |
| `takeover` | Read a Word manuscript and reference libraries without changing them; build records that take effect at once, marked unreviewed; carry the original reference list forward; work through findings with the author when they choose; fixes go into a Stemma copy in marked-up Markdown. |
| `research` | Find candidate sources and record the author's decisions on them. |
| `note` | Extract reading notes with page-level locators; record claim-ledger entries and relations, marked unreviewed. |
| `outline` | Derive the outline and chapter specifications from the inputs and the claim ledger. |
| `draft` | Write from ledger entries, applying the project's voice and style profiles, and say which entries are unreviewed. |
| `voice` | Extend a profile, or amend it from examples of the author's own writing. |
| `verify` | Run the scripted checks and claim-support checks; explain each finding. |
| `build` | Build a watermarked draft or a camera-ready PDF (a basic PDF in the first pilot). Every build completes; say whether it is checked clean, explain what is open, and count unreviewed items separately. |
| `audit` | Argue rival readings first, then repair citations. |
| `review` | Package the PDF, offline explorer, check report, and AI-use disclosure; import a reviewer's comment file. |

## Behavior rules

- Never stop, delay, or refuse writing or research work because something is unreviewed, unverified, unsupported, or failing. Never ask the author to verify or approve something before continuing. Report it and carry on.
- Explain every finding in plain language: what is wrong or could not be checked, the evidence, why it matters, and what to do. Group repeats. An unexplained or noisy finding is a Stemma defect; say so.
- Mark what you write as unreviewed, including your changes to items the author reviewed; the author's own edits keep an item reviewed. Admission of a source is the author's decision; never withhold it over a check result or missing rights fields. Run a record-format migration only when the author asks, after listing its changes. Record a review, annotation, confirmation, or source admission only when the author asks, naming the items.
- Never invent a source, quotation, or locator. Say when cited text has no stored copy and so is unchecked.
- Write drafts from claim-ledger entries with sources and locators; mark an assertion with no support as needing a source.
- Record files are the source of truth for references and evidence.
- Report each scripted result as the script gave it. Never call output with open findings checked clean.
- Send a hosted model only the excerpts a task needs. No source is held back individually; material that may not be sent does not belong in a hosted-model project.
- Read exact restricted coordinates only when a task needs them; that sends them to the model. Never write them into project files or outputs.
- Never call a support verdict verification, or a review mark, annotation, or confirmation proof.

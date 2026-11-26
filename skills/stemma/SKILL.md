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

Pre-release. No mode below is delivered yet. A first part of the command line
works: project setup, adding records, record and form checks, the two
bibliography checks, and a coordinate-text warning. When asked for a mode, say it
is not available yet and do not imitate its commands with unchecked file edits.

## Run the command line

The plugin root is `${CLAUDE_PLUGIN_ROOT}`. If that was not replaced by a path,
use the directory two levels above this file. Run every command with the plugin
root as the working directory and with absolute paths, exactly like this:

```sh
cd "<plugin root>" && bun --no-install --no-env-file --config=/dev/null "<plugin root>/dist/stemma.js" <command> --project "<absolute project path>"
```

Keep all three flags. Without them Bun can download packages, or load a `.env` or
`bunfig.toml` from the working directory that runs code or changes settings.

1. Before the first command in a session, run `doctor`. If `bun` is not found on
   the search path, try `~/.bun/bin/bun`, then stop. If Bun is missing or is not
   version 1.4.5, say so, say that nothing was checked, and point to the official
   instructions at https://bun.com/docs/installation. Install nothing unless the
   author asks. Run no substitute check. Writing work continues.
2. If `dist/stemma.js` is missing, this copy of the plugin has no command line:
   say that nothing was checked.
3. At session start in a project, read its `rules.md`. (`index status` is not
   implemented yet.)

| Command | Use |
|---|---|
| `init` | Create a project in the `--project` directory; overwrites nothing |
| `record add <kind> --input <absolute file> --actor <person\|model\|software>:<name>` | Add one record, for example a `source` or a `citation` |
| `fmt [paths]` | Rewrite records in canonical form without changing values |
| `validate [paths]`, `rules check` | Check record files and rule headings |
| `check [--format json]` | Check the whole project and explain what is open |
| `version`, `doctor` | Versions, paths, and how Bun was started |

After writing or editing records, run `fmt` on them and then `check` before
saying the work is done. Use `--actor model:<your model name>` for records you
write; use `person:` only when entering the author's own words as given.

A source record needs a `citation_key`; useful fields are `type`, `title`
(`{"value": "…"}`), and `issued` (`{"edtf": "1998"}`). `record add` fills `id`,
`created`, `admission` (`candidate`), and `intake`. A citation record holds one
citation in the author's existing manuscript: `key` and `sentence`
(`{"text": "…"}`; the digest is filled in). `bibliography_include` in
`stemma.json` is a list of source IDs. Never invent any of these values.

Exit code 0 means done with nothing open, and 1 means done with findings open: a
report, not a reason to stop. 2 is a usage error or a command that is not
implemented yet; 3 an unreadable project; 4 a wrong runtime; 5 a request that is
not valid; 70 an internal error, after which no result may be read as a pass. A
report is checked clean only when its label says `checked_clean`. Checks this
version cannot yet run are listed and keep a project from that label.

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

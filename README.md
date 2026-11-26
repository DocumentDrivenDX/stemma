# Stemma

A plugin that helps scholars research, write, and typeset books with AI,
checking citations with scripts, explaining what it finds, and tracing claims to
stored sources. Its own documents are specified with
[HELIX](https://github.com/DocumentDrivenDX/helix).

A *stemma codicum* is the family tree of a text's manuscripts: it shows which copy
derives from which. Stemma aims to give a book the same property: each cited
claim has a traceable line of descent to a stored source.

Nothing is implemented yet. The skill is a stub. The vision, requirements, and
design decisions live under [`docs/stemma/`](docs/stemma/).

## Idea

Two strands run together, as in HELIX:

- **Evidence strand**: source records, reading notes with page-level locators,
  constructs, places, and a claim ledger that ties claims to the sources that
  support them, held together as a graph of plain files.
- **Manuscript strand**: thesis, outline, chapter specifications, drafts, and
  the assembled book.

The thesis, with any stated theoretical constructs and research methodology,
governs the outline, which governs chapter specifications, which govern drafts.
Evidence runs beside this order: drafts are written from the claim ledger.

## Planned capabilities

- Take over an existing Word manuscript and its reference libraries, or start a
  new book. Fixes go into a Stemma copy in marked-up Markdown, converted to Typst with
  only defined layout features; originals stay unchanged. The first
  pilot also typesets a basic PDF, with a report of what is open.
- Check citations while you work. Stemma finds problems and explains them. It
  never stops you from writing and never blocks a build: every build completes
  and comes with a plain-language report, and is called checked clean only when
  no check finding is open; the report counts unreviewed items separately. What
  an AI proposes is used at once and marked unreviewed.
- Explore the evidence graph, argument and geographic maps, and typeset pages.
- Typeset with Typst, with Chicago notes and bibliography guaranteed first, in
  6 x 9 in, 5.5 x 8.5 in, or A5. Word, LaTeX, and HTML export are deferred.
- Extend voice and style profiles and amend them from your own writing.
- Install as a plugin from this repository's marketplace: Claude desktop's local
  Code tab on macOS and native Windows first, ChatGPT and Codex later. The
  scripted tools also run on Linux, with no desktop-app promise there. How the
  marketplace delivers the command line is not designed yet.

Stemma is for material that may be sent to a language model. It sends only the
excerpts a task needs and does not hold back individual sources. Local models are
an unsupported experiment.

## Principles

1. Tools and reports, not gates and approvals. Review and attestation happen
   when you choose.
2. No reference is invented. A citation rests on a source record and a stored
   copy, and one without them is shown as unchecked.
3. Scripts check, models propose. A model's support verdict is a record, not
   proof.
4. Stemma's own record files are the official bibliography and evidence graph.
   Other formats are imports and exports.
5. Stemma says what its checks cannot show. Review marks and verdicts are not
   forgery-proof.
6. Stemma works without HELIX installed. HELIX specifies and designs Stemma; it is
   not a runtime dependency.

## Layout

```text
.claude-plugin/   plugin and marketplace manifests
skills/stemma/    the single public skill
docs/stemma/      Stemma's own governed documents (specified with HELIX)
```

## License

MIT

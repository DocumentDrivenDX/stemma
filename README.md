# Stemma

A document discipline for researching and writing academic books with
verified citations. Stemma is to long-form scholarly writing what
[HELIX](https://github.com/DocumentDrivenDX/helix) is to software: a
methodology, an artifact catalog, and one routing skill that keeps the
governing documents in sync as the work moves.

A *stemma codicum* is the family tree of a text's manuscripts: it shows which copy
derives from which. Stemma gives a book the same property. Every sentence has a
traceable line of descent to a stored source, enforced by scripts and commit
gates, and the book is typeset from the same files.

The vision and PRD live under
[`docs/stemma/`](docs/stemma/). The skill is a stub.

## Idea

Two strands run together, as in HELIX:

- **Evidence strand**: source records, reading notes with page-level locators,
  and a claim ledger that ties every assertion to the sources that support it.
- **Manuscript strand**: thesis, outline, chapter specifications, drafts, and
  the assembled book.

The authority hierarchy runs thesis → outline → chapter spec → draft. Evidence
runs beside it: a draft sentence may state only what the claim ledger supports.

## Principles

1. No reference is invented. Every citation resolves to a verified source record.
2. Every claim in a draft traces to a claim-ledger entry with sources and locators.
3. The bibliography is plain text (CSL-JSON or BibTeX) and is the single source of truth.
4. Stemma works without HELIX installed. HELIX specifies and designs Stemma; it is not a runtime dependency.

## Layout

```text
.claude-plugin/   plugin and marketplace manifests
skills/stemma/     the single public skill
docs/stemma/       Stemma's own governed documents (specified with HELIX)
```

## License

MIT

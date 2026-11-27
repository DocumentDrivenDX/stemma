# Implementation plan: iteration 11, graph export and record browser

Governed by FEAT-012 (US-090, US-094), CONTRACT-005 A to G, ADR-006, ADR-008,
SD-011 (graph export), SD-012 (record browser).

## Goal

`stemma graph export --audience author --page` turns a project's record files
into one offline `build/graph/author/explorer.html`, built on arras, where the
author searches records and follows links in both directions. No server and no
network request.

## Left to later iterations

Connected-graph view (needs an arras contribution), typeset pages, sentence
links, live preview, maps, reviewer audience and comments, `--chapter`, the
SQLite graph engine and `GraphStore`, `stemma.preview/sentences/maps.json`.
`--audience reviewer` and `--chapter` are refused as not implemented (exit 2):
a partial reviewer filter could disclose withheld text. `graph status` is in.
See [build iterations](build-iterations.md).

## Facts checked

- `@documentdrivendx/arras-ui@0.8.1` is on npm (MIT OR Apache-2.0). It exports
  `./static` (`loadStore(moduleText, graphText)`, `createStaticClient(store)`,
  `staticSchemaApi()`), `./browser` (`GraphBrowser` with `client`, `schemaApi`,
  `brand`, `location`/navigation props) and `./styles.css`. Peers: react and
  react-dom ^19.3.0.
- `@stemma/records` loads and validates the corpus (`loadCorpus`,
  `corpusDigest`, schema in `schema.generated.ts`); `@stemma/workspace` reads a
  project (`readProject`). `graph` is in the CLI's `NOT_YET` set.
- The plugin ships one bundled `dist/stemma.js` (`scripts/build.ts`) and no
  `node_modules`.

## Review amendments (binding; they override the steps below)

1. **Restricted places.** The exporter never reads the restricted store, but a
   project record may wrongly hold restricted data. For a location with
   `sensitivity.class: restricted`, emit only an author-released area
   (`release: area`) or nothing, never exact geometry (CONTRACT-001 H,
   CONTRACT-005 E). Count it and warn `restricted_in_project`; still export.
   Name the local-path fields to omit from the schema (for example
   `LegacyField.native_path`, `original_name`). "`x`" is the top-level
   extension object only; `Region.x` is a coordinate and stays.
2. **Search limits.** arras gives a query 1,000 entities at 50 per type, so only
   about 20 types are searched; the rest report `over_budget`. Declare
   `arras.view` search on at most 20 author-facing types, declared first, with
   one single-string `searchText` property (at most 8 search properties per
   type). Test a match in the last searched type.
3. **Folding.** arras only lowercases the query. Put a versioned `search-fold`
   in `packages/records` (not core's quote fold), apply it to `searchText`, and
   have the host wrap the static client's `moduleQuery` to fold the `$text`
   variable. Seed Latin, Greek and Arabic diacritic cases on both sides.
4. **Identity.** The banner and manifest use the data identity of CONTRACT-005 J
   (corpus digest plus sorted manuscript file digests; 12 characters shown).
   Byte determinism and `graph status` key on data identity and exporter
   version. The load time arras shows must not look like the data identity.
5. **States.** Include `unreviewed` (core `unreviewedItems`), `retired_link` and
   `annotated`. Include `open_finding` only from checks whose inputs are all
   covered by the data identity (no originals, lookups or clock); if that cannot
   be guaranteed, leave it out and list it as not shown.
6. **Spike on the real module.** Run it on the full module generated from
   `examples/coral-reefs`, plus a synthetic record with more than 100 links,
   covering the 20-type search cap, the 50-field query limit, the 100-key
   relationship cap and view-size limits. Report any that make US-090 fail.
7. **Routing.** Leave `GraphBrowser`'s `location` uncontrolled; it does its own
   hash routing. The spike confirms `replaceState` works from `file://`.
8. **Graph file.** `format` is exactly `arras.graph`, version 1, `module` equals
   the module name, numbers are integers. Stock `static.html` cannot run from
   `file://`; `arras-static.json` serves hosted delivery only.
9. **Page.** Policy: `default-src 'none'; script-src 'sha256-<build hash>';
   style-src 'unsafe-inline'; img-src data:; connect-src 'none';
   form-action 'none'; base-uri 'none'`. Data goes in
   `<script type="application/json">` with every `<` escaped as `\u003c`. Fill
   the template with a function replacer (a string replacement expands `$&`).
   The inlined graph and module text must be the exact exported bytes, so the
   page's digest matches the manifest.
10. **Hostile text.** Pin view vocabulary 0.1.0; never declare the `markdown`
    format; do not set `brand.wordmark`. Fields named `url`, `uri` or `link`
    become outside links in arras: accept this and say so in the report.
11. **Build.** Add `jsx` and the new package paths to `tsconfig.json`.
    `bundle()` itself produces the template (tests call it); the CLI finds it
    next to `stemma.js`, as it does `pdfjs`. `plugin-check` runs
    `graph export --page` from the installed copy. Pin react, react-dom,
    `@types/react` and `@documentdrivendx/arras-ui` exactly. Import only its
    `./browser`, `./static` and `./styles.css`. Ship licenses for arras, React,
    scheduler, react-query and graphql.
12. **Small.** `init` already ignores `build/`. Define `--out` outside a git
    repository. Exit 3 means validation errors, not warnings. List the 100-key
    relationship cap and search limits as known gaps.

## Steps

1. **Spike (do first; stop and report if it fails).** Hand-write a tiny module
   and graph with two entity types and one link. Load it with `loadStore` in a
   test. Bundle a host that mounts `GraphBrowser` with the static client into one
   HTML file, open it from `file://` in Playwright Chromium, and confirm: renders,
   search works, following a link and going back works, zero non-file requests,
   no console errors. Learn from the shipped types how `location` must be driven
   so that navigation works under `file://` (hash routing owned by the host).
2. **`packages/graph`** (`@stemma/graph`; imports `records` and `core` only):
   a pure projection from a loaded corpus to `stemma.umf.json`,
   `stemma.graph.json`, `arras-static.json`, `stemma.export.json`, following
   CONTRACT-005 B, E (author) and F. Derive types and reference fields from the
   record schema; do not hand-list per kind. Omit restricted-store values, local
   paths, `legacy`, `x`, and retired records. Count every omission and dropped
   link by type and reason. Deterministic bytes. `search-fold` for `searchText`
   (reuse core folding if it matches the spec; otherwise implement a versioned
   one). Source-text manifests are included if the schema gives them an ID that
   records reference; otherwise count them as omitted.
3. **States.** `core` supplies the states it can already compute without
   guessing (`retired_link`, `annotated`, `open_finding`, plus any other it
   truly computes). Write `stemma.states.json`, and show them as a read-only
   `stemmaStates` list property on each entity so stock arras node pages display
   them. States not computed are listed in the manifest and the page says they
   are not shown; absence of a state is never presented as clear.
4. **`packages/explorer`**: React host mounting the arras `GraphBrowser`, a
   banner with project, audience, corpus digest (12 characters), omission counts
   and "states not shown", and the notice that support results are recorded
   model judgments, not verification. Record text is rendered as text. Page
   content security policy denies all connections. Inlined data is escaped so it
   cannot close its script element.
5. **Packaging.** `scripts/build.ts` builds the explorer into one HTML template
   (script and CSS inline) under `dist/`, with third-party licenses, and ships it
   in the release tree. The CLI fills the template at export; it never bundles on
   the author's machine and needs no `node_modules`. Running from source in
   tests must also work. Pin exact versions in `package.json` and `bun.lock`.
6. **CLI.** `graph export --audience author [--page] [--out <dir>]` and
   `graph status`, with the CONTRACT-005 error semantics (invalid records exit 3;
   `--out` inside the project that git does not ignore exits 5, nothing written),
   `--format json`, usage text. `init` must ignore `build/`. Add the `graph`
   command to the skill so an author can ask to browse.
7. **Tests** (local, advisory): projection determinism; arras `loadStore` accepts
   the export of `examples/coral-reefs` and of a fixture with every link shape;
   retired records, `x`, `legacy`, local paths absent; diacritic search; a
   hostile record (`</script><script>`, markup) stays text; CLI refusals;
   Playwright on the built `explorer.html` from `file://`: search, open, follow
   both directions, back, zero network requests; plugin build test covers the
   new shipped files.
8. **Docs.** Update CONTRACT-005 (`stemmaStates`, proof status), SD-012, and the
   README only where it describes what the plugin does. No testing history in
   README or website.

## Done when

`bun test` and `tsc` pass, `scripts/build.ts` and the plugin check pass, and the
built CLI exports `examples/coral-reefs` to a page that passes the Playwright
flow. Anything in US-090 or US-094 that is not met is named in the report.

## Known gaps to report, not hide

US-090-AC4/AC5 are only partly met (no support records or stale computation
yet). US-094-AC5 depends on FEAT-009 filtering. axe-core results on arras
widgets are reported as observed. arras search returns the first 50 matches per
type.

## Spike result

Run against `@documentdrivendx/arras-ui` 0.8.1 in headless Chromium, with a host
page bundled into one file, under the page policy of amendment 9, opened from a
local file. The design holds.

- A small module renders, searches, follows a link in both directions, goes back
  and reloads in place. `location` left uncontrolled: arras routes with the URL
  fragment and keeps view state in the history entry. No non-file request and no
  console error.
- The module generated from `examples/coral-reefs` (104 entities, 11
  relationships) loads and searches.
- A synthetic project made from the record schema (every kind, field and pair of
  linked types) with the 20 searched types present: a match in the last searched
  type is found. A record page with 116 relationship sections opens; arras splits
  its queries to stay within 50 fields.
- One record with 150 links, inward and, separately, outward: arras returns 100
  keys in the field and its "Show more" pages the rest by listing the other type.
  All 150 are reachable in both directions.
- One design change: arras caps the view terms of a document at 128 KiB. The full
  schema (44 types, 275 relationships) came to 131,525 bytes with a label on
  every field, and did not load. The exporter leaves out field labels and formats
  that arras gives anyway, which brought it to about 103 KB.
- arras also searches any type it can title unless the type declares an empty
  search list, and adds one query fragment for each type with a badge field. The
  exporter declares both explicitly.

Limits that remain and weaken US-090 without making it fail: a search lists at
most 50 results, and at most 50 of one type, in key order; a query is 2 to 200
characters and at most 6 words.

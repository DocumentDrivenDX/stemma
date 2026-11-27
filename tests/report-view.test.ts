// The manuscript view (CONTRACT-005 L; US-118): the assembled report as an export
// reads it, over invented reports and over the worked example. Every link in it
// must come from the report builder's own data, and every doubt must take the
// text, the link or the highlight away.
import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { formatCitations } from "@stemma/cite";
import type { ManuscriptView } from "@stemma/core";
import { dataIdentity, type Export, exportGraph, exportOwnFiles, exportStaleness, FILES } from "@stemma/graph";
import { assemble, buildReport, clustersOf, manuscriptView, noteClusters, ReportError, type ReportSpec } from "@stemma/publish";
import { type Corpus, loadCorpus, sha256 } from "@stemma/records";
import { readProject } from "@stemma/workspace";
import { ROOT, temporary } from "./helpers.ts";
import { anchorOf, citation, content, LETTER, OTHER, PAGES, passage, project, type Project, type Rec, sources, standard, VOLUME } from "./source-view-fixture.ts";

const VERSION = "9.9.9-test";
const bytes = (text: string) => new TextEncoder().encode(text);

/** The fixture's sources, with the letter as one printed in the volume. */
const printed = (change: Record<string, Rec> = {}): Rec[] => sources().map((s) => ({
  ...s, ...(s.id === LETTER ? { type: "personal_communication" } : {}), ...change[String(s.id)],
}));

const { one, two, note } = standard();
const letterPassage = passage("psg-letter000001", [anchorOf(PAGES, 2, "main", "The islets were few")], "The islets were few", { locator: { label: "page", value: "3" } });

const quotation = (id: string, cites: string, passages: string[], more: Rec = {}) => ({ id, cites, passages: passages.map((p) => ({ passage: p })), ...more });
const LIST = [
  quotation("one", "volume1850", [one.id]),
  quotation("two", "volume1850", [two.id]),
  quotation("note", "volume1850", [note.id], { note: true }),
  quotation("letter", "letter1850", [letterPassage.id]),
];
const TEMPLATE = `# A *Report*

## Its subtitle

The reef: {{q:one}}.[^one] A letter says {{q:letter}}.[^letter|With {{q:note}} in the comment.]

Both {{q:two}}.[^two,one] Once more.[^|Only a comment.]

{{bibliography}}
`;

interface Made { quotations?: Rec[]; template?: string; records?: Rec[]; sources?: Rec[]; pages?: Project["pages"]; manifest?: Rec; include?: string[] }

function corpusWith(made: Made = {}): Corpus {
  const base = content(project({
    sources: made.sources ?? printed(), records: made.records ?? [one, two, note, letterPassage],
    ...(made.pages ? { pages: made.pages } : {}), ...(made.manifest ? { manifest: made.manifest } : {}),
  }));
  const spec = { manuscript: "report.src", quotations: made.quotations ?? LIST };
  return loadCorpus({
    ...base, report: { spec: { path: "report/report.json", bytes: bytes(JSON.stringify(spec)) }, template: { path: "report/report.src", bytes: bytes(made.template ?? TEMPLATE) } },
  });
}

const exported = (corpus: Corpus, more: { sourceViewsCap?: number; manuscriptCap?: number } = {}): Export => exportGraph(corpus, {
  version: VERSION, ...more, manuscript: (has) => manuscriptView(corpus, [], has),
});
const text = (out: Export) => out.files.find((f) => f.name === FILES.manuscript)!.text;
const viewOf = (made: Made = {}): ManuscriptView => exported(corpusWith(made)).manuscript;
const warned = (out: Export, code: string) => out.manifest.warnings.find((w) => w.code === code);
const states = (view: ManuscriptView) => Object.fromEntries(Object.entries(view.quotations).map(([id, q]) => [id, q.view.state]));

describe("the view is made from what the report is built from", () => {
  const out = exported(corpusWith());
  const view = out.manuscript;

  test("US-118-AC1 blocks, notes and headings are the template's, and nothing is open", () => {
    expect(view.state).toBe("read");
    expect(view.inputs).toEqual({ directory: "report", template: "report/report.src" });
    expect(view.blocks.map((b) => (b.kind === "text" ? b.level ?? 0 : b.kind))).toEqual([1, 2, 0, 0, "bibliography"]);
    expect(view.blocks[2]).toEqual({ kind: "text", parts: [
      { kind: "text", text: "The reef: " }, { kind: "quotation", id: "one" }, { kind: "text", text: "." }, { kind: "note", number: 1 },
      { kind: "text", text: " A letter says " }, { kind: "quotation", id: "letter" }, { kind: "text", text: "." }, { kind: "note", number: 2 },
    ] });
    expect(view.notes.map((n) => n.number)).toEqual([1, 2, 3, 4]);
    expect(view.notes[1]!.comment).toEqual([{ kind: "text", text: "With " }, { kind: "quotation", id: "note" }, { kind: "text", text: " in the comment." }]);
    expect(view.notes[3]).toEqual({ number: 4, citations: [], comment: [{ kind: "text", text: "Only a comment." }] });
    expect(out.manifest.warnings).toEqual([]);
  });

  test("each quotation opens its own passages, and gives the words build report gives", () => {
    const built = buildReport(corpusWith(), { manuscript: "report.src", quotations: LIST } as ReportSpec, TEMPLATE);
    expect(states(view)).toEqual({ one: "highlighted", two: "highlighted", note: "highlighted", letter: "highlighted" });
    for (const [id, q] of Object.entries(view.quotations)) {
      expect(q.view.passages.map((p) => p.passage), id).toEqual(LIST.find((l) => l.id === id)!.passages.map((p) => p.passage));
      expect(built.files["report.md"], id).toContain(`“${q.text!}`);
      for (const p of q.view.passages) expect(out.sourceViews[p.passage]!.state).toBe("highlighted");
    }
    expect(view.quotations.two!.text).toStartWith("We saw the la");
    expect(view.quotations.two!.changes.join(" ")).toContain("joined as la𝒜");
  });

  test("US-118-AC2 each note citation names the quotations it supports, and a note's text is those and the citation", () => {
    const built = buildReport(corpusWith(), { manuscript: "report.src", quotations: LIST } as ReportSpec, TEMPLATE);
    expect(view.notes.map((n) => n.citations.map((c) => [c.quotations, c.source]))).toEqual([
      [[["one"], VOLUME]], [[["letter"], LETTER]], [[["two"], VOLUME], [["one"], VOLUME]], [],
    ]);
    for (const n of view.notes) {
      const whole = n.citations.map((c) => `${c.quotations.map((id) => `“${view.quotations[id]!.text}${/[.?!]$/.test(view.quotations[id]!.text!) ? "" : "."}” `).join("")}${c.text}`).join(" ");
      expect(built.notes[n.number - 1]!.text.split("\n\n    ")[0], `note ${n.number}`).toBe(n.citations.length > 0 ? whole : "Only a comment.");
    }
  });

  test("US-118-AC4 a printed letter is listed under its volume, and each place says which work it cites", () => {
    expect(view.bibliography.map((e) => e.source)).toEqual([VOLUME]);
    expect(view.bibliography[0]!.places).toEqual([{ note: 1, citation: 0 }, { note: 2, citation: 0 }, { note: 3, citation: 0 }, { note: 3, citation: 1 }]);
    expect(view.notes[1]!.citations[0]).toMatchObject({ source: LETTER, entry: VOLUME });
    // The comment's quotation has no citation of its own, so it is listed apart.
    expect(view.bibliography[0]!.quoted).toEqual([{ quotation: "note", note: 2 }]);
    expect(view.works[LETTER]).toMatchObject({ key: "letter1850", part_of: { id: VOLUME } });
  });

  test("the formatter's entry IDs follow its entries, and each citation is its quotations and then the citation", () => {
    const corpus = corpusWith();
    const assembly = assemble(TEMPLATE, (id) => ({ cites: LIST.find((l) => l.id === id)!.cites, locator: "3", text: "words *here* $& [x]" }));
    const clusters = clustersOf(assembly.notes);
    const made = formatCitations(corpus, clusters, ["other1850"]);
    expect(made.bibliographyIds.map((ids) => ids.length)).toEqual(made.bibliography.map(() => 1));
    expect(made.bibliographyIds.flat().sort()).toEqual([OTHER, VOLUME].sort());
    for (const [i, id] of made.bibliographyIds.flat().entries()) expect(made.bibliography[i]).toContain(id === OTHER ? "Other1850" : "Volume1850");
    clusters.forEach((c, i) => expect(made.citations[i]).toBe(`${c.items[0]!.before}${made.bare[i]}`));
    expect(noteClusters(1, [{ cites: "volume1850", members: [{ locator: "2", text: "a" }, { locator: "2", text: "b" }] }])).toHaveLength(1);
  });

  test("the same records give the same bytes, and the file is an export's own and digested", () => {
    expect(text(exported(corpusWith()))).toBe(text(out));
    expect(out.manifest.files[FILES.manuscript]).toBe(sha256(text(out)));
    const manifest = out.files.find((f) => f.name === "stemma.export.json")!.text;
    expect(exportOwnFiles(manifest)).toContain(FILES.manuscript);
    expect(text(out)).not.toContain("<");
  });

  test("US-118-AC8 a change to report.json or its template makes the export stale", () => {
    const manifest = out.files.find((f) => f.name === "stemma.export.json")!.text;
    const read = (name: string) => bytes(out.files.find((f) => f.name === name)!.text);
    expect(exportStaleness(manifest, dataIdentity(corpusWith()), VERSION, read).fresh).toBe(true);
    for (const changed of [corpusWith({ template: `${TEMPLATE}\nMore.` }), corpusWith({ quotations: [...LIST, quotation("unused", "volume1850", [one.id])] })]) {
      expect(exportStaleness(manifest, dataIdentity(changed), VERSION, read)).toMatchObject({ fresh: false, reasons: ["data_changed"] });
    }
    // So is a template renamed with its text the same, and why a report is not read.
    for (const change of [(c: Corpus) => (c.report!.template!.path += ".old"), (c: Corpus) => (c.report!.problem = "report is not a plain directory.")]) {
      const other = corpusWith();
      change(other);
      expect(dataIdentity(other).data_identity).not.toBe(dataIdentity(corpusWith()).data_identity);
    }
    // A template that has gone is a change too.
    const gone = corpusWith();
    delete gone.report!.template!.bytes;
    expect(dataIdentity(gone).data_identity).not.toBe(dataIdentity(corpusWith()).data_identity);
  });

  test("a project with no report says so, with no warning, and keeps its data identity", () => {
    const bare = loadCorpus(content(project()));
    const made = exported(bare);
    expect(made.manuscript.state).toBe("none");
    expect(made.manifest.warnings.filter((w) => w.code.includes("manuscript"))).toEqual([]);
    expect(made.manifest.data_identity).toBe(sha256(`${made.manifest.corpus_digest}\n`));
  });
});

describe("one broken quotation is shown as broken, and the rest is readable", () => {
  const changed = { ...one, anchor: [{ ...one.anchor[0], page_sha256: "0".repeat(64) }] };

  test("US-118-AC5 a changed passage: no text, no page, no highlight, a warning; build report still fails", () => {
    const corpus = corpusWith({ records: [changed, two, note, letterPassage] });
    expect(() => buildReport(corpus, { manuscript: "report.src", quotations: LIST } as ReportSpec, TEMPLATE)).toThrow(ReportError);
    const out = exported(corpus);
    const view = out.manuscript;
    expect(states(view)).toEqual({ one: "changed", two: "highlighted", note: "highlighted", letter: "highlighted" });
    expect(view.quotations.one!.text).toBeUndefined();
    expect(text(out)).not.toContain("nothing more is known");
    const [cited] = view.notes[0]!.citations;
    expect(cited!.source).toBe(VOLUME);
    expect(cited!.text).not.toMatch(/, 2$/);
    expect(warned(out, "manuscript_incomplete")!.records).toEqual(["quotation one"]);
  });

  test.each([
    ["a correction that does not match", { corrections: [{ was: "absent words", now: "x", by: "person:A", basis: "page image" }] }, "does not match exactly once"],
    ["an italic that is not there", { italic: ["absent"] }, "is not in the quotation"],
  ])("a quotation build report refuses for %s is not highlighted", (_name, more, why) => {
    const view = viewOf({ quotations: [quotation("one", "volume1850", [one.id], more), ...LIST.slice(1)] });
    expect(view.quotations.one!.view).toMatchObject({ state: "citation_differs" });
    expect(view.quotations.one!.view.why).toContain(why);
    expect(view.quotations.one!.text).toBeUndefined();
    expect(view.quotations.two!.view.state).toBe("highlighted");
  });

  test("US-118-AC3 a quotation that lists no passage: its citation names the source, and nothing is highlighted", () => {
    const view = viewOf({ quotations: [quotation("one", "volume1850", []), ...LIST.slice(1)] });
    expect(view.quotations.one!.view).toMatchObject({ state: "no_passage", passages: [], work: { id: VOLUME } });
    expect(view.quotations.one!.text).toBeUndefined();
    expect(view.notes[0]!.citations).toMatchObject([{ quotations: ["one"], source: VOLUME, entry: VOLUME }]);
  });

  test.each([
    ["an unlisted quotation", LIST.slice(1), "no_passage"],
    ["a quotation listed twice", [...LIST, LIST[0]!], "citation_differs"],
    ["a passage of another work", [quotation("one", "other1850", [one.id]), ...LIST.slice(1)], "citation_differs"],
    ["a missing passage", [quotation("one", "volume1850", ["psg-absent000001"]), ...LIST.slice(1)], "no_passage"],
    ["an entry that is not well formed", [{ id: "one", cites: "volume1850", passages: [null] }, ...LIST.slice(1)], "citation_differs"],
  ])("%s is broken, with why, and the others open", (_name, quotations, state) => {
    const view = viewOf({ quotations });
    expect(view.quotations.one!.view.state).toBe(state as never);
    expect(view.quotations.one!.view.why).not.toBe("");
    expect(view.quotations.one!.text).toBeUndefined();
    expect(view.quotations.two!.view.state).toBe("highlighted");
  });

  test("a key that names two sources links to neither's words", () => {
    const view = viewOf({ sources: printed({ [OTHER]: { key_aliases: ["volume1850"] } }) });
    expect(view.quotations.one!.view.state).not.toBe("highlighted");
    expect(view.quotations.one!.text).toBeUndefined();
  });

  test("a key that names no source is marked as build report marks it, with no link", () => {
    const view = viewOf({ quotations: [quotation("one", "nobody1900", [one.id]), ...LIST.slice(1)] });
    expect(view.notes[0]!.citations[0]!.text).toBe("[no source for the key nobody1900]");
    expect(view.notes[0]!.citations[0]!.source).toBeUndefined();
    expect(view.problems.join(" ")).toContain("no source has the key nobody1900");
  });

  test("a report that cannot be read is said to be, and the export is still written", () => {
    const corpus = corpusWith();
    corpus.report!.spec.bytes = bytes("{");
    const out = exported(corpus);
    expect(out.manuscript).toMatchObject({ state: "unavailable", blocks: [] });
    expect(warned(out, "manuscript_unavailable")!.message).toContain("cannot be read as JSON");
  });
});

describe("US-118-AC7 the author export's disclosure rules hold for the manuscript", () => {
  test("no local path: in the template, a comment, a join, a change, or a record the formatter reads", () => {
    const out = exported(corpusWith({
      template: "/Users/someone/notes.md was here.\n\nThe {{q:one}}.[^one|/home/someone/x] And {{q:two}}.[^two] {{q:letter}}.[^letter]\n\n{{bibliography}}\n",
      quotations: [LIST[0]!, { id: "two", cites: "volume1850", passages: [{ passage: two.id, join_note: "/Users/someone/join" }] }, LIST[2]!, LIST[3]!],
    }));
    expect(text(out)).not.toMatch(/\/Users|\/home|someone\//);
    expect(out.manuscript.blocks[0]).toEqual({ kind: "text", parts: [{ kind: "withheld" }] });
    expect(out.manuscript.notes[0]!.comment).toEqual([{ kind: "withheld" }]);
    expect(warned(out, "manuscript_incomplete")!.records).toEqual(expect.arrayContaining(["paragraph 1", "note 1"]));

    const bib = exported(corpusWith({ sources: printed({ [VOLUME]: { bib: [{ lid: "a", name: "URL", value: { value: "file:///Users/someone/book.pdf" } }] } }) }));
    expect(text(bib)).not.toMatch(/file:|\/Users|someone\//);
    expect(bib.manuscript.bibliography[0]!.withheld).toContain("path");
    expect(bib.manuscript.notes[0]!.citations[0]).toEqual({ quotations: ["one"], withheld: expect.stringContaining("path") as never });
  });

  test("a field naming a file, which the formatter never prints, withholds nothing", () => {
    const view = viewOf({ sources: printed({ [VOLUME]: { bib: [{ lid: "a", name: "file", value: { value: "/Users/someone/book.pdf" } }] } }) });
    expect(view.bibliography[0]!.text).toContain("Volume1850");
    expect(JSON.stringify(view)).not.toContain("/Users");
  });

  test("nothing rests on a retired passage: no words, pointer, or reason from its record", () => {
    const retired = { ...one, retired: { at: "2026-01-06T09:00:00Z", by: { kind: "person", name: "Author" }, reason: "SECRET REASON" } };
    const out = exported(corpusWith({ records: [retired, two, note, letterPassage] }));
    expect(out.manuscript.quotations.one!.view).toMatchObject({ state: "not_exported", passages: [] });
    expect(out.manuscript.quotations.one!.text).toBeUndefined();
    for (const value of [one.id, "nothing more is known", "SECRET REASON"]) expect(text(out)).not.toContain(value);
  });

  test("nothing rests on a retired or broken source: no citation text, entry, title, or link", () => {
    for (const change of [{ retired: { at: "2026-01-06T09:00:00Z", by: { kind: "person", name: "Author" }, reason: "gone" } }, { type: 7 }]) {
      const out = exported(corpusWith({ sources: printed({ [VOLUME]: change }) }));
      const view = out.manuscript;
      expect(Object.values(view.quotations).filter((q) => q.text !== undefined || q.view.state === "highlighted")).toEqual([]);
      expect(view.notes.flatMap((n) => n.citations).filter((c) => c.source === VOLUME || c.entry === VOLUME)).toEqual([]);
      expect(view.bibliography.filter((e) => e.source === VOLUME)).toEqual([]);
      expect(view.works[VOLUME]).toBeUndefined();
      expect(text(out)).not.toMatch(/[Tt]he [Vv]olume1850 [Bb]ook/);
    }
  });

  test("coordinate-shaped text in the report is written, with a warning that names the place", () => {
    const out = exported(corpusWith({ template: `${TEMPLATE}\nThe cave is at 41.40338, 2.17403 exactly.\n` }));
    expect(warned(out, "coordinates_in_manuscript")!.records).toEqual(["paragraph 6"]);
    expect(text(out)).toContain("41.40338");
  });

  test("a passage the source views' cap leaves out is not highlighted; over its own cap the view is left out", () => {
    const capped = exported(corpusWith(), { sourceViewsCap: 0 });
    expect(Object.values(capped.manuscript.quotations).map((q) => q.view.state)).toEqual(["not_exported", "not_exported", "not_exported", "not_exported"]);
    expect(capped.manuscript.quotations.one!.text).toBe("nothing more is known");
    const left = exported(corpusWith(), { manuscriptCap: 100 });
    expect(left.manuscript).toMatchObject({ state: "unavailable", blocks: [] });
    expect(warned(left, "manuscript_unavailable")).toBeDefined();
  });

  test("the cap keeps the passages the report quotes before those only a record cites", () => {
    const spare = passage("psg-aaaaaaaaaaaa", [anchorOf(PAGES, 2, "main", "islets")], "islets");
    const corpus = corpusWith({ records: [spare, one, two, note, letterPassage, citation("cit-onepage00001", one)], quotations: [LIST[0]!], template: "{{q:one}}.[^one]" });
    const size = Buffer.byteLength(exported(corpus).files.find((f) => f.name === FILES.sourceviews)!.text);
    const out = exported(corpus, { sourceViewsCap: Math.floor(size / 5) });
    expect(out.sourceViews[one.id]!.state).toBe("highlighted");
  });
});

describe("only report/ is read, and never through a link", () => {
  const dir = (spec: Rec, files: Record<string, string> = {}) => {
    const root = temporary();
    writeFileSync(join(root, "stemma.json"), "{}");
    mkdirSync(join(root, "report/parts"), { recursive: true });
    writeFileSync(join(root, "report/report.json"), JSON.stringify(spec));
    for (const [name, value] of Object.entries(files)) writeFileSync(join(root, name), value);
    return root;
  };

  test("the template report.json names, which may lie in a directory under report/", () => {
    const report = readProject(dir({ manuscript: "parts/report.src" }, { "report/parts/report.src": "words" })).report!;
    expect([report.template!.path, new TextDecoder().decode(report.template!.bytes)]).toEqual(["report/parts/report.src", "words"]);
  });

  test.each(["../outside.src", "/etc/hosts", "parts/../../outside.src", "C:\\outside.src", "./report.src"])("not %s", (name) => {
    const report = readProject(dir({ manuscript: name }, { "outside.src": "OUTSIDE" })).report!;
    expect(report.template).toBeUndefined();
    expect(report.problem).toContain("not a file path inside report/");
  });

  test.skipIf(process.platform === "win32")("not a linked template, nor one through a linked directory", () => {
    const root = dir({ manuscript: "report.src" }, { "outside.src": "OUTSIDE" });
    symlinkSync(join(root, "outside.src"), join(root, "report/report.src"));
    expect(readProject(root).report!.template!.bytes).toBeUndefined();
    const through = dir({ manuscript: "away/outside.src" }, { "outside.src": "OUTSIDE" });
    symlinkSync(through, join(through, "report/away"));
    expect(readProject(through).report!.template!.bytes).toBeUndefined();
  });

  test("a project with no report.json has no report", () => {
    expect(readProject(temporary()).report).toBeUndefined();
  });
});

describe("the worked example's report", () => {
  const corpus = loadCorpus(readProject(join(ROOT, "examples/coral-reefs")));
  const out = exported(corpus);
  const view = out.manuscript;
  const spec = JSON.parse(new TextDecoder().decode(corpus.report!.spec.bytes)) as ReportSpec;
  const citations = view.notes.flatMap((n) => n.citations);

  test("every quotation, note citation and bibliography entry links, from the builder's own data", () => {
    expect(view.state).toBe("read");
    expect(Object.entries(view.quotations).filter(([, q]) => q.view.state !== "highlighted" || q.text === undefined)).toEqual([]);
    expect(citations.filter((c) => c.source === undefined || c.text === undefined)).toEqual([]);
    expect(view.bibliography.filter((e) => e.source === undefined || e.text === undefined || e.places.length === 0)).toEqual([]);
    expect(out.manifest.warnings.filter((w) => w.code.includes("manuscript"))).toEqual([]);
    console.log(`worked example manuscript: ${Object.keys(view.quotations).length} quotations, ${citations.length} note citations, ${view.bibliography.length} bibliography entries; ${Buffer.byteLength(text(out))} bytes`);
  });

  test("each link agrees with the report list and the passage records, and each quotation with report.md", () => {
    const report = readFileSync(join(ROOT, "examples/coral-reefs/report/report.md"), "utf8");
    const quotations = new Map(spec.quotations.map((q) => [q.id, q]));
    for (const c of citations) {
      for (const id of c.quotations) {
        const listed = quotations.get(id)!;
        expect(view.works[c.source!]!.key, id).toBe(listed.cites);
        expect(view.quotations[id]!.view.passages.map((p) => p.passage), id).toEqual(listed.passages.map((p) => p.passage));
        expect(report, id).toContain(`“${view.quotations[id]!.text!}`);
        for (const { passage: cited } of listed.passages) {
          const part = String(corpus.byId.get(cited)!.data!.source);
          expect([c.source!, view.works[c.source!]!.part_of?.id], id).toContain(part);
        }
      }
      expect(report).toContain(c.text!);
    }
    for (const e of view.bibliography) expect(report).toContain(`\n\n${e.text!}\n\n`.slice(0, -2));
    for (const [i, entry] of view.bibliography.entries()) {
      for (const place of entry.places) expect(view.notes[place.note - 1]!.citations[place.citation]!.entry, `entry ${i}`).toBe(entry.source!);
    }
    expect(view.bibliography.flatMap((e) => e.places)).toHaveLength(citations.length);
  });
});

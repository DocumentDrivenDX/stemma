// `stemma.sourceviews.json` in the author export (CONTRACT-005 E and K), over an
// invented project.
import { describe, expect, test } from "bun:test";
import { sourceView } from "@stemma/core";
import { type Export, exportGraph, exportOwnFiles, exportStaleness, FILES, MANIFEST } from "@stemma/graph";
import { loadCorpus, sha256 } from "@stemma/records";
import { anchorOf, AT, citation, content, corpusOf, PAGES, passage, project, type Project, type Rec, standard, TEXT, VOLUME } from "./source-view-fixture.ts";

const VERSION = "9.9.9-test";
const { one, two, note } = standard();
const make = (change: Partial<Project> = {}, cap?: number): Export => exportGraph(corpusOf(change), { version: VERSION, ...(cap === undefined ? {} : { sourceViewsCap: cap }) });
const text = (out: Export) => out.files.find((f) => f.name === "stemma.sourceviews.json")!.text;
const views = (out: Export) => JSON.parse(text(out)).views as Record<string, any>;
const counted = (out: Export, type: string, reason: string) => out.manifest.omissions.find((o) => o.type === type && o.reason === reason)?.count ?? 0;
const retired = { stamp: { at: AT, by: { kind: "person", name: "A" } }, reason: "withdrawn" };

describe("stemma.sourceviews.json", () => {
  test("holds for each passage and citation exactly the view the core operation gives", () => {
    const out = make();
    const file = JSON.parse(text(out));
    expect(file.schema).toBe("stemma.sourceviews/0");
    expect(Object.keys(file.views).sort()).toEqual(["cit-onepage00001", note.id, one.id, two.id].sort());
    const corpus = corpusOf();
    for (const id of Object.keys(file.views)) {
      expect(file.views[id]).toEqual(JSON.parse(JSON.stringify(sourceView(corpus, { kind: id.startsWith("cit-") ? "citation" : "passage", id }))));
    }
    expect(out.manifest.files["stemma.sourceviews.json"]).toBe(sha256(text(out)));
    expect(text(out)).not.toContain("<");
  });

  test("is one of the export's own files, and a change to it makes the export stale", () => {
    const out = make();
    const manifest = out.files.find((f) => f.name === MANIFEST)!.text;
    expect(exportOwnFiles(manifest)).toContain(FILES.sourceviews);
    const read = (changed: boolean) => (name: string) => new TextEncoder().encode(out.files.find((f) => f.name === name)!.text + (changed && name === FILES.sourceviews ? " " : ""));
    const now = { corpus_digest: out.manifest.corpus_digest, data_identity: out.manifest.data_identity };
    expect(exportStaleness(manifest, now, VERSION, read(false)).fresh).toBe(true);
    expect(exportStaleness(manifest, now, VERSION, read(true))).toMatchObject({ fresh: false, reasons: ["file_changed"], files: [FILES.sourceviews] });
  });

  test("is the same bytes for the same files, in whatever order they are read", () => {
    const files = content(project());
    const shuffled = { ...files, records: [...files.records].reverse(), sources: [...files.sources].reverse() };
    expect(text(exportGraph(loadCorpus(shuffled), { version: VERSION }))).toBe(text(exportGraph(loadCorpus(files), { version: VERSION })));
  });

  test("holds only cited pages, and counts the parts it holds none of", () => {
    const only = make({ records: [one] });
    expect(counted(only, "SourceText", "page_text")).toBe(PAGES.length - 1);
    expect(text(only)).not.toContain("The islets were few");
    expect(text(only)).not.toContain("The reef was old");
    expect(counted(make(), "SourceText", "page_text")).toBe(1);
    expect(counted(make({ records: [] }), "SourceText", "page_text")).toBe(PAGES.length);
    // A running head is no part of the page's text, in any view.
    expect(text(make())).not.toContain("THE REEF 1");
  });

  test("leaves out retired records, and views that would be retired, and counts the latter", () => {
    const out = make({ records: [{ ...one, retired }, citation("cit-onepage00001", one), note] });
    expect(Object.keys(views(out))).toEqual([note.id]);
    expect(counted(out, "SourceView", "retired")).toBe(1);
    const whole = make({ manifest: { retired } });
    expect(Object.keys(views(whole))).toEqual([]);
    expect(counted(whole, "SourceView", "retired")).toBe(4);
    expect(text(whole)).not.toContain("goon");
  });

  test("holds no text for a view that is not highlighted", () => {
    const out = make({ records: [{ ...one, quote: { exact: "other words" } }, citation("cit-onepage00001", one)] });
    expect(views(out)[one.id]).toMatchObject({ state: "changed", segments: [] });
    expect(text(out)).not.toContain("goon");
  });

  test("rights fields filter nothing", () => {
    const sources = project().sources.map((s) => (s.id === VOLUME ? { ...s, rights: { status: "in_copyright", community_permission: true } } : s));
    expect(views(make({ sources }))[one.id]).toMatchObject({ state: "highlighted" });
  });

  test("leaves out local paths among the original's addresses", () => {
    const out = make({ manifest: { original: { form: "file", files: [{ sha256: "a".repeat(64), size: 1, media_type: "application/pdf" }], obtained_from: "/data/scans/book.pdf", held_at: "/Users/author/books", acquired_at: AT } } });
    expect(views(out)[one.id].state).toBe("highlighted");
    for (const path of ["/data/scans", "/Users/author"]) expect(out.files.map((f) => f.text).join("")).not.toContain(path);
  });

  test("keeps the cited passages first under the size cap, and says what it cut", () => {
    const whole = make();
    expect([counted(whole, "SourceView", "size_cap"), whole.manifest.warnings]).toEqual([0, []]);
    const size = Buffer.byteLength(JSON.stringify(views(whole)[one.id]));
    // Room for about one view: the one a citation points to, though others sort before it.
    const out = make({}, Math.ceil(size * 1.6));
    expect(views(out)[one.id].state).toBe("highlighted");
    for (const id of [two.id, note.id]) {
      expect(views(out)[id]).toMatchObject({ state: "not_exported", segments: [], passages: [] });
      expect(views(out)[id].original).toBeUndefined();
    }
    expect(counted(out, "SourceView", "size_cap")).toBe(2);
    expect(out.manifest.warnings.find((w) => w.code === "source_views_cut")!.records).toEqual([note.id, two.id].sort());
    const none = make({}, 0);
    expect(counted(none, "SourceView", "size_cap")).toBe(3);
    expect(counted(none, "SourceText", "page_text")).toBe(PAGES.length);
    expect(text(none)).not.toContain("goon");
  });

  test("counts trimmed parts of a source with no pages", () => {
    const pages = structuredClone(PAGES);
    pages[2]!.blocks[0]!.content = `${"a ".repeat(2000)}THE WORDS`;
    const made = passage("psg-unpaged00001", [anchorOf(pages, 2, "main", "THE WORDS")], "THE WORDS");
    const out = exportGraph(corpusOf({ pages, records: [made] }, false), { version: VERSION });
    expect([views(out)[made.id].segments[0].trimmed_before, counted(out, "SourceText", "page_text_trimmed")]).toEqual([true, 1]);
  });

  test("warns when exported source text holds a coordinate, also one the highlight cuts, and still writes it", () => {
    const pages = structuredClone(PAGES);
    pages[2]!.blocks[0]!.content = "The cave lies at 45.678912, 12.345678 on the shore.";
    const made = passage("psg-cavepage0001", [anchorOf(pages, 2, "main", "lies at 45.678912,")], "lies at 45.678912,");
    const out = make({ pages, records: [made] });
    expect(out.manifest.warnings).toMatchObject([{ code: "coordinates_in_views", records: [made.id] }]);
    expect(out.manifest.warnings[0]!.message).not.toContain("45.678912");
    expect(text(out)).toContain("12.345678");
  });

  test("keeps a review's actor name and a comparison's local path out", () => {
    const by = { kind: "person", name: "A Reader" };
    const review: Rec = { schema: "stemma.record/0", id: "rvw-person000001", kind: "text_review", created: { at: AT, by }, source: VOLUME, text: TEXT, scope: "whole_page",
      pages: [{ index: 1, sha256: one.anchor[0].page_sha256 }], against: "/Users/reader/photo.jpg", reviewed: { at: AT, by }, outcome: "agrees" };
    const out = make({ records: [one, review] });
    expect(views(out)[one.id].segments[0].reviews).toEqual([{ by: "person", review: review.id, scope: "whole_page", outcome: "agrees", flags: [] }]);
    expect(text(out)).not.toContain("/Users/reader");
  });
});

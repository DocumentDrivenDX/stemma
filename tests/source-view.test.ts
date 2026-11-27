// `sourceView` (CONTRACT-005 K; US-116): what is highlighted, and above all
// what is not.
import { describe, expect, test } from "bun:test";
import { comparedDigest, sourceView, SourceViews, type SourceView, type SourceViewState } from "@stemma/core";
import { isLocalPath, showControls, splitControls, textDigest } from "@stemma/records";
import {
  anchorOf, AT, citation, corpusOf, LETTER, ORIGINAL, OTHER, PAGES, passage, project, type Rec, standard, TEXT, VOLUME,
} from "./source-view-fixture.ts";

const { one, two, note } = standard();
const get = (change: Parameters<typeof corpusOf>[0], kind: "passage" | "citation", id: string, paged = true): SourceView =>
  sourceView(corpusOf(change, paged), { kind, id });
/** The standard project with one passage record replaced. */
const withPassage = (changed: Rec, more: Rec[] = []) => ({ records: [changed, citation("cit-onepage00001", one), ...more] });
const noText = (view: SourceView, state: SourceViewState) => {
  expect([view.state, view.segments]).toEqual([state, []]);
  expect(view.why.length).toBeGreaterThan(20);
  expect(view.source_text).toBeUndefined();
  expect(view.original).toBeUndefined();
};

describe("a highlighted passage", () => {
  test("US-116-AC1 gives the page's text cut at the quotation, with the printed page", () => {
    const view = get({}, "passage", one.id);
    expect(view.state).toBe("highlighted");
    expect(view.segments).toHaveLength(1);
    const [s] = view.segments;
    // Characters outside the basic plane stand before the quotation: offsets count code points.
    expect([s!.before, s!.quoted, s!.after]).toEqual(["\u{1D49C}\u{1F600}goon was deep, and ", "nothing more is known", " of it."]);
    expect([s!.printed_label, s!.label_status, s!.label_basis, s!.stream, s!.index]).toEqual(["2", "labelled", "printed_sequence", "main", 1]);
    expect([s!.trimmed_before, s!.trimmed_after]).toEqual([undefined, undefined]);
    expect(view.work).toEqual({ id: VOLUME, key: "volume1850", title: "The volume1850 book" });
    expect(view.source_text).toMatchObject({ id: TEXT, method: "ocr", level: "unassessed", paged: true });
    expect(s!.quality).toEqual({ method: "ocr", level: "unassessed", note: "invented page note" });
  });

  test("a quotation across two pages has one piece for each page, which join to the passage's words", () => {
    const view = get({}, "passage", two.id);
    expect(view.state).toBe("highlighted");
    expect(view.segments.map((s) => [s.printed_label, s.quoted])).toEqual([["1", "We saw the la-"], ["2", "\u{1D49C}\u{1F600}goon was deep"]]);
    expect(view.segments.map((s) => s.quoted).join("\n")).toBe(two.quote.exact);
    // The running head is no part of the page's text.
    expect(view.segments[0]!.before).toBe("The reef was old. ");
    expect(view.segments[1]!.after).toBe(", and nothing more is known of it.");
  });

  test("a quotation in a note shows the notes text of the page", () => {
    const view = get({}, "passage", note.id);
    expect(view.segments.map((s) => [s.stream, s.before, s.quoted, s.after, s.place]))
      .toEqual([["notes", "1 An invented note about ", "\u{1D49C} soundings", ".", "notes on printed page 2 (index 1)"]]);
  });

  test("a source with no pages gets a bounded stretch, and says it was cut", () => {
    const pages = structuredClone(PAGES);
    pages[2]!.blocks[0]!.content = `${"\u{1D49C}".repeat(2000)}THE WORDS${"z".repeat(1600)}`;
    const made = passage("psg-unpaged00001", [anchorOf(pages, 2, "main", "THE WORDS")], "THE WORDS", { locator: { label: "chapter", value: "I" } });
    const view = get({ pages, records: [made] }, "passage", made.id, false);
    const [s] = view.segments;
    expect([view.state, [...s!.before].length, [...s!.after].length, s!.trimmed_before, s!.trimmed_after]).toEqual(["highlighted", 1500, 1500, true, true]);
    expect([s!.before, s!.quoted]).toEqual(["\u{1D49C}".repeat(1500), "THE WORDS"]);
    expect([s!.label_status, s!.printed_label]).toEqual(["unpaged", undefined]);
  });
});

describe("US-116-AC2 nothing is highlighted when anything is in doubt", () => {
  test("a page changed and sealed after capture", () => {
    const pages = structuredClone(PAGES);
    pages[1]!.blocks[0]!.content = pages[1]!.blocks[0]!.content.replace("of it.", "of them.");
    // The passages keep the anchors they were captured with.
    const view = get({ pages, records: [one, two] }, "passage", one.id);
    noText(view, "changed");
    noText(get({ pages, records: [one, two] }, "passage", two.id), "changed");
  });

  test("a record whose words are not what the address gives, even by one character", () => {
    noText(get(withPassage({ ...one, quote: { exact: "nothing more is knowm" } }), "passage", one.id), "changed");
    // The same words stand elsewhere: an address that names other words is never moved to them.
    noText(get(withPassage({ ...one, anchor: [{ ...one.anchor[0], start: one.anchor[0].start - 1, end: one.anchor[0].end - 1 }] }), "passage", one.id), "changed");
  });

  test("an unsealed edit damages the file", () => {
    noText(get({ tamper: (path, text) => (path.endsWith("p0002.md") ? text.replace("few", "many") : text) }, "passage", one.id), "damaged_file");
  });

  test("a manifest that breaks a record rule", () => {
    noText(get({ manifest: { coverage: "sometimes" } }, "passage", one.id), "damaged_file");
  });

  test("a source file that is not there", () => {
    noText(get(withPassage({ ...one, text: "txt-nowhere00001" }), "passage", one.id), "no_source_file");
  });

  test("a source file of another source", () => {
    noText(get(withPassage({ ...one, source: OTHER }), "passage", one.id), "invalid_anchor");
  });

  test("a source record that is not there", () => {
    noText(get({ sources: [] }, "passage", one.id), "invalid_anchor");
  });

  test.each([
    ["past the end of the page", [{ ...one.anchor[0], end: 4000 }]],
    ["negative", [{ ...one.anchor[0], start: -5 }]],
    ["backwards", [{ ...one.anchor[0], start: 9, end: 3 }]],
    ["empty", []],
    ["a stream that is never source text", [{ ...one.anchor[0], stream: "furniture" }]],
    ["pieces out of order", [two.anchor[1], two.anchor[0]]],
    ["two streams", [two.anchor[0], note.anchor[0]]],
  ])("an address that is %s", (_name, anchor) => {
    noText(get(withPassage({ ...one, anchor }), "passage", one.id), "invalid_anchor");
  });

  test("pieces that leave words out between two pages, though each gives its recorded words", () => {
    const spliced = passage("psg-spliced00001", [anchorOf(PAGES, 0, "main", "We saw"), two.anchor[1]], "We saw\n\u{1D49C}\u{1F600}goon was deep");
    noText(get(withPassage(spliced), "passage", spliced.id), "invalid_anchor");
    const skipping = passage("psg-skipping0001", [anchorOf(PAGES, 0, "main", "We saw the la-"), anchorOf(PAGES, 2, "main", "The islets")], "We saw the la-\nThe islets");
    noText(get(withPassage(skipping), "passage", skipping.id), "invalid_anchor");
  });

  test("a retired passage, source file or source", () => {
    const retired = { stamp: { at: AT, by: { kind: "person", name: "Author" } }, reason: "withdrawn" };
    noText(get(withPassage({ ...one, retired }), "passage", one.id), "retired");
    noText(get({ manifest: { retired } }, "passage", one.id), "retired");
    const sources = project().sources.map((s) => (s.id === VOLUME ? { ...s, retired } : s));
    noText(get({ sources }, "passage", one.id), "retired");
    expect(get({ records: [one, { ...citation("cit-onepage00001", one), retired }] }, "citation", "cit-onepage00001").state).toBe("retired");
    expect(get({ records: [{ ...one, retired }, citation("cit-onepage00001", one)] }, "citation", "cit-onepage00001").state).toBe("retired");
  });

  test("an ID that is no such record is an error, not a view", () => {
    expect(() => get({}, "passage", "psg-nowhere00001")).toThrow("No readable passage record");
    expect(() => get({}, "citation", one.id)).toThrow("No readable citation record");
  });
});

describe("a citation", () => {
  const cite = (more: Rec) => get({ records: [one, citation("cit-onepage00001", one, more)] }, "citation", "cit-onepage00001");

  test("US-116-AC1 that agrees with its passage is highlighted, and points to the passage without copying it", () => {
    const view = cite({});
    expect([view.state, view.segments, view.passages]).toEqual(["highlighted", [], [{ passage: one.id }]]);
    expect(view.citation).toMatchObject({ key: "volume1850", quotation: "nothing more is known", sentence: "It says “nothing more is known”." });
    expect(view.work).toMatchObject({ id: VOLUME });
    expect(JSON.stringify(view)).not.toContain("goon");
  });

  test("of a letter that is part of the volume its passage is in names both works", () => {
    const view = cite({ key: "letter1850" });
    expect([view.state, view.work]).toEqual(["highlighted", {
      id: LETTER, key: "letter1850", title: "The letter1850 book", part_of: { id: VOLUME, key: "volume1850", title: "The volume1850 book" },
    }]);
  });

  test.each([
    ["another quotation", { quotation: "nothing more was known" }, "quotation is not the passage's words"],
    ["no quotation", { quotation: undefined }, "records no quotation"],
    ["another page", { locator: { label: "page", value: "3" } }, "cited place"],
    ["no cited place", { locator: undefined }, "cited place"],
    ["a longer locator", { locator: { label: "page", value: "2", end: "3" } }, "cited place"],
    ["the key of another work", { key: "other1850" }, "neither the passage's source nor a part of it"],
    ["a key no source has", { key: "nobody1850" }, "names no source"],
    ["no key and no source", { key: undefined }, "names no source"],
    ["a source that is another work than its key", { source: LETTER }, "different works"],
  ])("US-116-AC2 with %s is citation_differs", (_name, more, why) => {
    const view = cite(more);
    expect([view.state, view.segments]).toEqual(["citation_differs", []]);
    expect(view.why).toContain(why);
  });

  test("a key that two sources hold names neither", () => {
    const sources = [...project().sources, { ...project().sources[2]!, id: "src-second000001", citation_key: "volume1850" }];
    const view = get({ sources }, "citation", "cit-onepage00001");
    expect([view.state, view.why.includes("more than one source")]).toEqual(["citation_differs", true]);
  });

  test("a citation of the volume with a passage of the letter's own text is not turned around", () => {
    // The passage's source is a part; citing the whole work it is part of is not "that source or the work it is part of".
    const inLetter = { ...one, source: LETTER };
    const view = get({ records: [inLetter, citation("cit-onepage00001", inLetter)], manifest: { source: LETTER } }, "citation", "cit-onepage00001");
    expect(view.state).toBe("citation_differs");
  });

  test("US-116-AC3 with no passage names the source and the place, and highlights nothing", () => {
    const view = cite({ passage: undefined });
    expect([view.state, view.passages, view.segments, view.work?.id, view.locator?.value]).toEqual(["no_passage", [], [], VOLUME, "2"]);
  });

  test("that names a missing passage has no passage", () => {
    expect(cite({ passage: "psg-nowhere00001" }).state).toBe("no_passage");
  });

  test("takes the state of a passage that cannot be highlighted", () => {
    const view = get({ tamper: (path, text) => (path.endsWith("p0001.md") ? `${text}x\n` : text) }, "citation", "cit-onepage00001");
    expect(view.state).toBe("damaged_file");
  });
});

describe("a report quotation", () => {
  const listed = { id: "Q-two", cites: "letter1850", passages: [{ passage: two.id }, { passage: note.id, join: " ", join_note: "a note joined" }], corrections: [{ was: "deep", now: "shallow", by: "person:Author", basis: "page image" }], keep_hyphens: ["la-goon"], checked: "invented" };
  const ask = (more: Rec = {}, change = {}) => sourceView(corpusOf(change), { kind: "quotation", id: "Q-two" }, { quotations: [{ ...listed, ...more }] });

  test("lists its passages in order, and its corrections and notes without applying them", () => {
    const view = ask();
    expect(view.state).toBe("highlighted");
    expect(view.passages).toEqual(listed.passages);
    expect(view.quotation).toEqual({ cites: "letter1850", corrections: listed.corrections, keep_hyphens: ["la-goon"], checked: "invented" });
    expect(view.work?.part_of?.id).toBe(VOLUME);
    const views = new SourceViews(corpusOf());
    expect(views.passage(two.id).segments.map((s) => s.quoted).join(" ")).toContain("deep");
  });

  test("US-116-AC2 one passage in doubt leaves the whole quotation unhighlighted", () => {
    const view = ask({}, { records: [two, { ...note, quote: { exact: "other words" } }] });
    expect([view.state, view.why.startsWith(`Passage ${note.id}`)]).toEqual(["changed", true]);
    expect(ask({ passages: [{ passage: "psg-nowhere00001" }] }).state).toBe("no_passage");
    expect(ask({ cites: "other1850" }).state).toBe("citation_differs");
    expect(ask({ cites: "nobody" }).state).toBe("citation_differs");
  });

  test("an unknown or malformed quotation is an error", () => {
    expect(() => sourceView(corpusOf(), { kind: "quotation", id: "Q-none" }, { quotations: [listed] })).toThrow("lists no quotation");
    expect(() => ask({ passages: [] })).toThrow("needs");
    expect(() => sourceView(corpusOf(), { kind: "quotation", id: "Q-two" }, { quotations: [listed, listed] })).toThrow("more than once");
  });
});

describe("US-116-AC4 quality, as recorded and never as proof", () => {
  const stamp = (kind: string) => ({ at: AT, by: { kind, name: `a ${kind}` } });
  const digest = textDigest(PAGES[1]!.blocks);
  const review = (id: string, by: string, more: Rec = {}) => ({
    schema: "stemma.record/0", id, kind: "text_review", created: stamp(by), source: VOLUME, text: TEXT, scope: "whole_page",
    pages: [{ index: 1, sha256: digest }], against: "page image", reviewed: stamp(by), outcome: "agrees", ...more,
  });
  const run = (id: string, sha: string) => ({
    schema: "stemma.record/0", id, kind: "comparison_run", created: stamp("software"), source: VOLUME, text: TEXT, method: "supplied_text",
    independent: true, against: "a second text", run: stamp("software"),
    pages: [{ index: 1, sha256: sha, agreement_permille: 990, words: 100, differing_words: 1 }],
  });
  const flag = { index: 1, reading: "goon", suggested: "good", note: "looks odd" };
  const segment = (records: Rec[]) => get({ records: [one, ...records] }, "passage", one.id).segments[0]!;

  test("a person's review is shown only while every page it covers is unchanged", () => {
    expect(segment([review("rvw-person000001", "person")]).reviews)
      .toEqual([{ by: "person", review: "rvw-person000001", scope: "whole_page", outcome: "agrees", against: "page image", flags: [] }]);
    const stale = review("rvw-person000001", "person", { pages: [{ index: 1, sha256: digest }, { index: 2, sha256: "0".repeat(64) }] });
    expect(segment([stale]).reviews).toEqual([]);
  });

  test("a model's review is only its flags, and one that agrees is not shown at all", () => {
    expect(segment([review("rvw-model0000001", "model")]).reviews).toEqual([]);
    const flagged = review("rvw-model0000001", "model", { outcome: "flagged", flags: [flag, { ...flag, index: 2 }] });
    expect(segment([flagged]).reviews).toEqual([{ by: "model", review: "rvw-model0000001", flags: [{ reading: "goon", suggested: "good", note: "looks odd" }] }]);
  });

  test("a review of another passage, or of the source's details, is not this page's", () => {
    expect(segment([review("rvw-person000001", "person", { scope: "passage", passage: note.id })]).reviews).toEqual([]);
    expect(segment([review("rvw-person000001", "person", { scope: "source_details", fields: ["title"] })]).reviews).toEqual([]);
  });

  test("a comparison run is shown for a page whose digest it still matches", () => {
    const now = comparedDigest("supplied_text", PAGES[1]!.blocks);
    expect(segment([run("run-current00001", now), run("run-stale0000001", "0".repeat(64))]).comparisons)
      .toEqual([{ run: "run-current00001", method: "supplied_text", against: "a second text", independent: true, agreement_permille: 990, words: 100, differing_words: 1 }]);
  });
});

describe("US-116-AC5 the original", () => {
  const upstream = (id: string, more: Rec) => ({
    schema: "stemma.record/0", id, kind: "upstream", created: { at: AT, by: { kind: "person", name: "A" } }, source: VOLUME,
    retrieved_at: AT, retrieved_by: { kind: "person", name: "A" }, sha256: ORIGINAL, size: 10, media_type: "application/pdf", ...more,
  });

  test("names upstreams of the same bytes, and no auxiliary address", () => {
    const view = get({ records: [one,
      upstream("ups-samebytes001", { url: "https://example.invalid/served.pdf", auxiliary: [{ role: "alternative_text", url: "https://example.invalid/text.txt", sha256: "b".repeat(64), size: 1 }] }),
      upstream("ups-otherbytes01", { url: "https://example.invalid/other.pdf", sha256: "c".repeat(64) }),
    ] }, "passage", one.id);
    expect(view.original).toEqual({
      form: "file", obtained_from: "https://example.invalid/book.pdf", acquired_at: AT,
      files: [{ sha256: ORIGINAL, size: 10, media_type: "application/pdf", upstreams: [{ record: "ups-samebytes001", url: "https://example.invalid/served.pdf", retrieved_at: AT }] }],
    });
    expect(JSON.stringify(view)).not.toContain("text.txt");
  });

  test("withholds every local path among addresses and holdings", () => {
    const view = get({
      records: [one, upstream("ups-localpath001", { url: "/data/scans/book.pdf", version: "~erik/scans/v2" })],
      manifest: { original: { form: "physical", files: [], description: "/Users/author/notes/copy", held_at: "/srv/shelf/7", obtained_from: "file:///Users/author/book.pdf", version: "C:\\books\\1", acquired_at: AT } },
    }, "passage", one.id);
    expect(view.state).toBe("highlighted");
    expect(view.original).toEqual({ form: "physical", acquired_at: AT, files: [] });
    for (const path of ["/Users/", "/data/", "/srv/", "~erik", "C:\\\\"]) expect(JSON.stringify(view)).not.toContain(path);
  });

  test("a paper original keeps where it is held", () => {
    const view = get({ manifest: { original: { form: "physical", files: [], description: "an invented paper copy", held_at: "An invented library, shelf 7", obtained_from: "unknown", acquired_at: AT } } }, "passage", one.id);
    expect(view.original).toMatchObject({ form: "physical", description: "an invented paper copy", held_at: "An invented library, shelf 7" });
  });

  test("page images are given for the pages the passage lies on", () => {
    const files = [0, 1, 2].map((index) => ({ index, sha256: String(index).repeat(64), size: 1, media_type: "image/png" }));
    const view = get({ manifest: { original: { form: "page_images", files, obtained_from: "unknown", acquired_at: AT } } }, "passage", two.id);
    expect([view.original!.files.map((f) => f.index), view.original!.other_page_files]).toEqual([[0, 1], 1]);
  });
});

describe("hidden characters", () => {
  test("bidirectional, format and control characters become code points; lines and tabs stay", () => {
    const hostile = "a\u202Eb\u2066c\u200Fd\u0007e\u2028f\n\tg\u{E0041}";
    expect(showControls(hostile)).toBe("a[U+202E]b[U+2066]c[U+200F]d[U+0007]e[U+2028]f\n\tg[U+E0041]");
    expect(splitControls("a\u202Eb")).toEqual([{ text: "a" }, { control: "U+202E" }, { text: "b" }]);
    expect(splitControls("plain \u{1D49C}\n")).toEqual([{ text: "plain \u{1D49C}\n" }]);
  });

  test("a location field holding any whole path is local; a web address is not", () => {
    expect([isLocalPath("/data/a/b", true), isLocalPath("/data/a/b"), isLocalPath("https://example.invalid/a/b", true), isLocalPath("Obtained from: /data/a/b", true)])
      .toEqual([true, false, false, true]);
  });
});

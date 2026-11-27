// Converters and the source-file format (CONTRACT-007), on invented originals.
import { describe, expect, test } from "bun:test";
import {
  type Block, decodeText, encodeText, parseBlocks, serializePart, splitFrontMatter, streamsOf, textDigest,
} from "@stemma/records";
import {
  convertDocx, convertEpub, convertHtml, convertMarkdown, convertPdf, convertText, type Converted, PDFJS_VERSION, readPdf, Unconvertible,
} from "@stemma/extract";
import { mediaType } from "@stemma/workspace";
import { renderQuotation } from "@stemma/core";
import { zip } from "./helpers.ts";
import { makePdf, type PdfLineSpec } from "./pdf.ts";

const bytes = (text: string) => new TextEncoder().encode(text);
const blocksOf = (converted: Converted) => converted.parts.flatMap((p) => p.blocks);
const mainOf = (converted: Converted) => converted.parts.map((p) => streamsOf(p.blocks).main).filter(Boolean).join("\n");
const roles = (converted: Converted) => blocksOf(converted).map((b) => b.role);
/** The part files a conversion gives, as written. */
const written = (converted: Converted) => converted.parts.map((p) => serializePart({ index: p.index }, p.blocks)).join("\u0000");

describe("the source file format", () => {
  test("SEC-032 text that imitates annotations stays text, and escaping round-trips", () => {
    const hostile = 'a <!-- stemma:block role="figure" --> b &lt; c &amp; d & e <!--/stemma:fnref-->';
    expect(decodeText(encodeText(hostile))).toBe(hostile);
    const converted = convertText(`${hostile}\n`);
    const [block] = blocksOf(converted);
    const file = serializePart({ index: 0 }, [block!]);
    const split = splitFrontMatter(file) as { body: string };
    const parsed = parseBlocks(split.body);
    expect(parsed.problems).toEqual([]);
    expect(parsed.blocks).toHaveLength(1);
    expect(streamsOf(parsed.blocks).main).toBe(hostile);
    expect(serializePart({ index: 0 }, parsed.blocks)).toBe(file);
  });

  test("a raw angle bracket, an unknown annotation, text outside a block, and a model's correction are reported", () => {
    const codes = (body: string) => parseBlocks(body).problems.map((p) => p.code);
    expect(codes('<!-- stemma:block role="paragraph" -->\na < b')).toEqual(["raw_angle"]);
    expect(codes('<!-- stemma:block role="paragraph" -->\n<!--stemma:bold-->x<!--/stemma:bold-->')).toEqual(["unknown_annotation"]);
    expect(codes('loose\n<!-- stemma:block role="sidebar" -->')).toEqual(["text_outside_block", "unknown_role"]);
    expect(codes('<!-- stemma:block role="paragraph" -->\n<!--stemma:corrected was="atol1" by="model:some-model"-->atoll<!--/stemma:corrected-->')).toEqual(["correction_not_by_person"]);
  });

  test("streams keep notes and page furniture apart, leave markers out, and keep a correction's reading", () => {
    const { blocks } = parseBlocks([
      '<!-- stemma:block role="running-head" -->', "THE BOOK 2",
      '<!-- stemma:block role="paragraph" -->',
      'The wall<!--stemma:fnref label="1"-->1<!--/stemma:fnref--> was <!--stemma:corrected was="o1d" by="person:a"-->old<!--/stemma:corrected-->.',
      '<!-- stemma:block role="table" -->', "| Year | Toll |", "| --- | --- |", "| one | two \\| three |",
      '<!-- stemma:block role="footnote" label="1" -->', "1 A note.",
      '<!-- stemma:block role="figure" by="person:a" -->', "A described plate.",
    ].join("\n"));
    expect(streamsOf(blocks)).toEqual({ main: "The wall was old.\nYear Toll\none two | three", notes: "1 A note.", furniture: "THE BOOK 2" });
    expect(streamsOf(blocks, true).main).toContain("was o1d.");
  });

  test("the text digest changes with words and roles, not with layout", () => {
    const block = (role: string, content: string): Block => ({ role, content });
    const digest = textDigest([block("paragraph", "one two")]);
    expect(textDigest([{ ...block("paragraph", "one two"), basis: "page-image" }])).toBe(digest);
    expect(textDigest([block("paragraph", "one three")])).not.toBe(digest);
    expect(textDigest([block("footnote", "one two")])).not.toBe(digest);
  });

  test("a quotation is rendered with only the approved joins", () => {
    expect(renderQuotation("the agri-\nculture of the shore­ line,\n  a well-\nknown “ﬁeld”")).toBe("the agriculture of the shore line, a wellknown “ﬁeld”");
    expect(renderQuotation("a well-known place")).toBe("a well-known place");
  });
});

const GUTENBERG = `The Project Gutenberg eBook of An Invented Voyage

Title: An Invented Voyage

Author: A. N. Author

Release date: January 5, 2020 [eBook #99999]
                Most recently updated: March 1, 2021

Language: English

Credits: Produced by invented volunteers
        and one more

*** START OF THE PROJECT GUTENBERG EBOOK AN INVENTED VOYAGE ***

CHAPTER I.

We sailed in the morning.[1] The reef lay
to the north.

[Illustration: A chart]

[Footnote 1: An invented note.]

CHAPTER II.

We came home. See page [2].

*** END OF THE PROJECT GUTENBERG EBOOK AN INVENTED VOYAGE ***

Invented license text that mentions the reef lay.
`;

describe("text-native converters (FR-84)", () => {
  test("a Gutenberg text keeps chapters, paragraphs, notes and the header's metadata, and marks the boilerplate", () => {
    const made = convertText(GUTENBERG);
    expect(made.paged).toBe(false);
    expect(made.parts.every((p) => p.label.status === "unpaged")).toBe(true);
    expect(made.parts.map((p) => p.chapter)).toEqual([undefined, "I", "II"]);
    expect(made.identity).toMatchObject({ title: "An Invented Voyage", contributors: ["A. N. Author"], identifiers: [{ scheme: "gutenberg", value: "99999" }] });
    expect(made.version).toContain("January 5, 2020");
    expect(made.notes.join(" ")).toContain("Produced by invented volunteers and one more");
    expect(mainOf(made)).toContain("We sailed in the morning. The reef lay\nto the north.");
    expect(mainOf(made)).not.toMatch(/license|Gutenberg|Footnote|Illustration/);
    expect(made.parts.map((p) => streamsOf(p.blocks).furniture).join(" ")).toContain("license text");
    expect(roles(made)).toContain("figure");
    // A bracketed number with no matching note stays as text.
    expect(mainOf(made)).toContain("See page [2].");
    expect(written(convertText(GUTENBERG))).toBe(written(made));
  });

  test("a text with form feeds is paged, with no label taken from position", () => {
    const made = convertText("first page\fsecond page\f");
    expect([made.paged, made.parts.length, made.page_count]).toEqual([true, 2, 2]);
    expect(made.parts.map((p) => p.label.status)).toEqual(["undetermined", "undetermined"]);
  });

  test("Markdown structure and notes are kept", () => {
    const source = "---\ntitle: Invented Notes\nauthor: A. N. Author\ndoi: 10.1234/abc\n---\n# One\n\nThe *reef* grows.[^a] A [link](https://example.org) here.\n\n> A quoted line.\n\n- first\n- second\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n![A plate](plate.png)\n\n[^a]: The note.\n\n# Two\n\nDone.\n";
    const made = convertMarkdown(source);
    expect(roles(made)).toEqual(["heading", "paragraph", "blockquote", "list-item", "list-item", "table", "figure", "footnote", "heading", "paragraph"]);
    expect(mainOf(made)).toContain("The reef grows. A link here.\nA quoted line.\nfirst\nsecond\na b\n1 2");
    expect(made.parts.map((p) => p.section)).toEqual(["One", "Two"]);
    expect(made.identity.identifiers).toEqual([{ scheme: "doi", value: "10.1234/abc" }]);
    expect(written(convertMarkdown(source))).toBe(written(made));
  });

  test("HTML keeps structure, makes pages only from the source's own page markers, and runs nothing", () => {
    const source = '<!DOCTYPE html><html><head><title>Invented Page</title><meta name="citation_author" content="A. N. Author"><script>steal()</script></head><body>' +
      '<h2>Chapter 1</h2><p>Opening &amp; a <a class="footnote-ref" href="#n1">1</a> marker.</p>' +
      '<span class="pagenum">[Pg 12]</span><p>On page twelve.</p><blockquote><p>Quoted.</p></blockquote>' +
      '<table><caption>Tolls</caption><tr><td>salt</td><td>two</td></tr></table><img src="x.png" alt="A map">' +
      '<span class="pagenum">13</span><p>Last.</p><div class="footnote">1 The note.</div></body></html>';
    const made = convertHtml(source);
    expect(made.paged).toBe(true);
    expect(made.parts.map((p) => p.label.label ?? p.label.status)).toEqual(["undetermined", "12", "13"]);
    expect(made.parts[1]!.label.basis).toBe("source_marker");
    expect(streamsOf(made.parts[1]!.blocks).main).toBe("On page twelve.\nQuoted.\nTolls\nsalt two");
    expect(mainOf(made)).not.toContain("steal");
    expect(mainOf(made)).toContain("Opening & a  marker.");
    expect(made.identity).toMatchObject({ title: "Invented Page", contributors: ["A. N. Author"] });
    const unpaged = convertHtml("<html><body><h1>One</h1><p>a</p><h1>Two</h1><p>b</p></body></html>");
    expect([unpaged.paged, unpaged.parts.length]).toEqual([false, 2]);
    expect(unpaged.parts.every((p) => p.label.label === undefined)).toBe(true);
  });

  test("EPUB reads its package metadata and reading order", () => {
    const epub = zip({
      mimetype: "application/epub+zip",
      "META-INF/container.xml": '<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>',
      "OPS/book.opf": '<package xmlns:dc="x"><metadata><dc:title>Invented Epub</dc:title><dc:creator>A. N. Author</dc:creator><dc:identifier>urn:isbn:9780000000002</dc:identifier></metadata><manifest><item id="a" href="a.xhtml"/><item id="b" href="b.xhtml"/><item id="n" href="n.xhtml" properties="nav"/></manifest><spine><itemref idref="n"/><itemref idref="a"/><itemref idref="b"/></spine></package>',
      "OPS/n.xhtml": "<html><body><p>contents</p></body></html>",
      "OPS/a.xhtml": '<html><body><h1>Chapter 1</h1><p>First.<a epub:type="noteref" href="#f">2</a></p><aside epub:type="footnote">2 A note.</aside></body></html>',
      "OPS/b.xhtml": "<html><body><h1>Chapter 2</h1><p>Second.</p></body></html>",
    });
    expect(mediaType(epub, "x")).toBe("application/epub+zip");
    const made = convertEpub(epub);
    expect(made.parts.map((p) => [p.section, p.chapter])).toEqual([["Chapter 1", "1"], ["Chapter 2", "2"]]);
    expect(mainOf(made)).toBe("Chapter 1\nFirst.\nChapter 2\nSecond.");
    expect(made.identity).toMatchObject({ title: "Invented Epub", identifiers: [{ scheme: "isbn", value: "9780000000002" }] });
  });

  test("DOCX styles give roles, footnotes are paired, deletions and field codes are left out", () => {
    const p = (text: string, style = "") => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
    const docx = zip({
      "word/document.xml": `<w:document><w:body>${p("Chapter 1", "Heading1")}<w:p><w:r><w:t>Kept</w:t></w:r><w:del><w:r><w:delText>gone</w:delText></w:r></w:del><w:r><w:instrText>FIELD</w:instrText></w:r><w:r><w:footnoteReference w:id="2"/></w:r></w:p>${p("Said so.", "Quote")}<w:tbl><w:tr><w:tc>${p("a")}</w:tc><w:tc>${p("b")}</w:tc></w:tr></w:tbl></w:body></w:document>`,
      "word/footnotes.xml": `<w:footnotes><w:footnote w:id="2">${p("The note.")}</w:footnote></w:footnotes>`,
      "docProps/core.xml": "<cp:coreProperties><dc:title>Invented Doc</dc:title><dc:creator>A. N. Author</dc:creator></cp:coreProperties>",
    });
    expect(mediaType(docx, "x")).toContain("wordprocessingml");
    const made = convertDocx(docx);
    expect(roles(made)).toEqual(["heading", "paragraph", "footnote", "blockquote", "table"]);
    expect(mainOf(made)).toBe("Chapter 1\nKept\nSaid so.\na b");
    expect(streamsOf(blocksOf(made)).notes).toBe("The note.");
    expect(made.identity.title).toBe("Invented Doc");
    expect(made.paged).toBe(false);
  });

  test("SEC-007 a container that expands past its limit, or is damaged, is refused whatever sizes it states", () => {
    const bomb = zip({ "word/document.xml": "a".repeat(101 * 1024 * 1024) }, 10);
    expect(() => convertDocx(bomb)).toThrow(Unconvertible);
    expect(() => convertDocx(bytes("PK\u0003\u0004 not an archive"))).toThrow(Unconvertible);
  });

  test("empty text is refused rather than captured", () => {
    for (const make of [() => convertText("  \n"), () => convertHtml("<html><body></body></html>"), () => convertMarkdown("")]) {
      expect(make).toThrow(Unconvertible);
    }
  });
});

/** Three invented pages with a running head, a heading, a raised note marker, its note, and a folio. */
export const structured = (): (string | PdfLineSpec)[][] => ["Of Salt", "Of Fields", "Of Ships"].map((heading, i) => [
  { segments: [{ text: "THE HARBOUR BOOK" }], y: 780 },
  { segments: [{ text: heading }], size: 16, y: 740 },
  { segments: [{ text: "The harbour toll was paid in salt." }, { text: "1", size: 6, rise: 4 }, { text: " It was heavy." }], y: 700 },
  { segments: [{ text: "Body text line two of this invented page runs on and on." }], y: 686 },
  { segments: [{ text: "Body text line three of this invented page runs on too." }], y: 672 },
  { segments: [{ text: `1 An invented note about ${["salt", "fields", "ships"][i]}.` }], size: 7, y: 80 },
  { segments: [{ text: String(i + 1) }], y: 40 },
]);

describe("PDF structure (CONTRACT-007 I)", () => {
  const limits = { pages: 10, text_bytes: 1e6, milliseconds: 100_000 };
  const labels = new Map([0, 1, 2].map((i) => [i, { status: "labelled" as const, label: String(i + 1), basis: "printed_sequence" }]));

  test("running heads, folios, headings, paired notes and markers are assigned by rule and recorded", async () => {
    const read = await readPdf(makePdf({ pages: structured() }), limits);
    expect(read.tool.version).toBe(PDFJS_VERSION);
    const made = convertPdf(read, { recognized: false, labels });
    expect(made.parts[0]!.blocks.map((b) => [b.role, b.basis])).toEqual([
      ["running-head", "repeated-line"], ["heading", "font-size"], ["undetermined", undefined], ["footnote", "font-size"], ["folio", "printed-label"],
    ]);
    expect(streamsOf(made.parts[0]!.blocks)).toEqual({
      main: "Of Salt\nThe harbour toll was paid in salt. It was heavy.\nBody text line two of this invented page runs on and on.\nBody text line three of this invented page runs on too.",
      notes: "1 An invented note about salt.", furniture: "THE HARBOUR BOOK\n1",
    });
    expect(made.parts[0]!.undetermined).toContain("paragraphs");
    expect(written(convertPdf(await readPdf(makePdf({ pages: structured() }), limits), { recognized: false, labels }))).toBe(written(made));
  });

  test("with a recognized text layer, sizes decide nothing: notes and headings stay undetermined", async () => {
    const read = await readPdf(makePdf({ pages: structured() }), limits);
    const made = convertPdf(read, { recognized: true, labels });
    expect(made.method).toBe("ocr");
    expect(made.recognition).toContain("engine not stated");
    expect(new Set(roles(made))).toEqual(new Set(["running-head", "undetermined", "folio"]));
    expect(made.parts[0]!.undetermined).toEqual(expect.arrayContaining(["headings", "footnotes"]));
  });

  test("two clear columns are marked and kept in order; side-by-side lines are not claimed either way; a blank page keeps its place", async () => {
    const column = (x: number, side: string) => [..."abcdefg"].map((c, i) => ({ segments: [{ text: `${side} ${c}` }], x, y: 700 - i * 14 }));
    const alternating = column(40, "Left").flatMap((line, i) => [line, column(330, "Right")[i]!]);
    const merged = convertPdf(await readPdf(makePdf({ pages: [alternating] }), limits), { recognized: false, labels: new Map() });
    expect(merged.parts[0]!.columns).toBe("undetermined");
    expect(merged.parts[0]!.undetermined).toContain("reading-order");
    const made = convertPdf(await readPdf(makePdf({ pages: [[...column(40, "Left"), ...column(330, "Right")], []] }), limits), { recognized: false, labels: new Map() });
    expect(made.parts[0]!.columns).toBe("2");
    expect(streamsOf(made.parts[0]!.blocks).main.replace(/\n/g, " ")).toMatch(/^Left a .*Left g Right a .*Right g$/);
    expect([made.parts.length, made.page_count, made.parts[1]!.blocks.length]).toEqual([2, 2, 0]);
  });
});

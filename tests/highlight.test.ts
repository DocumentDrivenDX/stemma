// Marking a passage on an original (CONTRACT-005 M, "Highlighting on originals";
// US-123; SEC-043): boxes only where a page read again shows the quoted words,
// and a reason for every doubt. All pages and words are invented. Boxes against
// drawn pixels are in highlight-browser.test.ts.
import { describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { highlightTargets, partPageText, SourceViews, targetRanges, viewOf } from "@stemma/core";
import { sha256, streamsOf } from "@stemma/records";
import { answersOf, createHighlighter, createSession, listen, type LoadedOriginal, type Verdict } from "@stemma/server";
import { post, redeem } from "./browse-run.ts";
import { HIGHLIGHT_BOUNDS, locateOnPage } from "../packages/extract/src/pdf-highlight.ts";
import { NO_HIGHLIGHT, noHighlight, type Highlight, type HighlightTarget } from "../packages/core/src/highlight.ts";
import { line, pageText, placed, type Raw, rawPdf, stream, targetFor } from "./highlight-pdf.ts";
import { temporary } from "./helpers.ts";
import { corpusOf, standard } from "./source-view-fixture.ts";
import { servedData } from "../packages/graph/src/export.ts";
import { emptyManuscript } from "../packages/core/src/manuscript-view.ts";

const WORDS = "The tide table was kept by the harbour clerk.";
const QUOTE = "table was kept";
const plain: Raw = { content: line(WORDS) };
const IMAGE = {
  resources: "/XObject << /Im 6 0 R >>",
  objects: [stream("/Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /ASCIIHexDecode", "80>")],
};
const draw = (box: string) => `q ${box} cm /Im Do Q`;
const STATES = { resources: "/ExtGState << /Clear << /ca 0 >> /Half << /ca 0.5 >> /Blend << /BM /Multiply >> /Full << /ca 1 /BM /Normal >> >>" };
/** The words in the quoted place, drawn after `before` and before `after`. */
const around = (before: string, after = "", more: Partial<Raw> = {}): Raw => ({ ...more, content: `${before}\n${line(WORDS)}\n${after}` });

const reason = async (raw: Raw, quote = QUOTE, more: Partial<HighlightTarget> = {}): Promise<string> => {
  const made = await placed(raw, quote, more);
  if (made.state === "none") expect(made.why).toBe(NO_HIGHLIGHT[made.reason]);
  return made.state === "boxes" ? "boxes" : made.reason;
};

describe("US-123-AC1 boxes on plainly drawn words", () => {
  test("one box on one line, within the line, between the words before and after", async () => {
    const made = await placed(plain, QUOTE);
    if (made.state !== "boxes") throw new Error(made.why);
    expect([made.page, made.page_count, made.boxes.length]).toEqual([1, 1, 1]);
    const [box] = made.boxes;
    // Helvetica's widths at 24 units: "The tide " is 3,891 thousandths, and "table was kept" 6,392.
    expect(box!.left * 600).toBeCloseTo(40 + 93.384, 1);
    expect((box!.left + box!.width) * 600).toBeCloseTo(40 + 93.384 + 153.408, 1);
    expect((1 - box!.top - box!.height) * 800).toBeLessThan(700);
    expect((1 - box!.top) * 800).toBeGreaterThan(716);
  });

  test("two lines give two boxes; paint that is white and under the words, dark paint elsewhere, and a graphics state that changes nothing are allowed", async () => {
    const raw: Raw = { ...STATES, content: `1 g 0 0 600 800 re f 0 g\n40 100 200 40 re f\n/Full gs\n${line("The tide table was", 700)}\n${line("kept by the clerk.", 660)}` };
    const made = await placed(raw, "table was\nkept by");
    expect(made.state === "boxes" ? made.boxes.length : made.reason).toBe(2);
  });

  test("a rectangle that clips around the words, and a form that holds them, keep them seen", async () => {
    expect(await reason(around("q 0 600 600 150 re W n", "Q"))).toBe("boxes");
    expect(await reason({ content: "/Fm Do", resources: "/XObject << /Fm 6 0 R >>", objects: [stream("/Type /XObject /Subtype /Form /BBox [0 0 600 800] /Resources << /Font << /F1 5 0 R >> >>", line(WORDS))] })).toBe("boxes");
  });
});

describe("US-123-AC1 text off the page", () => {
  test("a printer's line wholly off the page, which the library's text leaves out, does not stand in the way", async () => {
    expect(await reason({ content: `${line("an invented printer's line", 880)}\n${line(WORDS)}\n${line("another, to the left", 400, 12, -400)}` })).toBe("boxes");
  });
});

describe("US-123-AC2 the page read again must be the source text's page", () => {
  test("another word, another order, more or fewer lines, and other bytes' page count", async () => {
    const bytes = rawPdf({ content: `${line("first line here", 700)}\n${line("second line here", 660)}` });
    const text = await pageText(bytes);
    for (const other of [text.replace("first", "First"), "second line here\nfirst line here", `${text}\nmore`, "first line here", text.replace(" ", "  "), `${text} `]) {
      const made = await locateOnPage(bytes, { ...targetFor(bytes, text, "line"), text_sha256: sha256(other) });
      expect(made.state === "none" && made.reason).toBe("text_differs");
    }
    expect(await reason(plain, QUOTE, { page_count: 2 })).toBe("page_count");
    expect(await reason(plain, QUOTE, { page: 2 })).toBe("page_count");
    const broken = new TextEncoder().encode("%PDF-1.6\nnot a pdf");
    expect((await locateOnPage(broken, targetFor(broken, "a b", "a")) as { reason: string }).reason).toBe("unreadable");
  });
});

describe("US-123-AC3 geometry that is not plain gives no box", () => {
  test("a rotated page; rotated, mirrored, and skewed text", async () => {
    expect(await reason({ ...plain, page: "/Rotate 90" })).toBe("rotated_page");
    for (const matrix of ["0 1 -1 0 300 100", "-1 0 0 1 560 700", "1 0 0.3 1 40 700", "1 0.05 0 1 40 700", "1 0 0 -1 40 700"]) {
      expect(await reason({ content: `BT /F1 24 Tf ${matrix} Tm (${WORDS}) Tj ET` })).toBe("rotated_text");
    }
    expect(await reason({ content: `q 0 1 -1 0 600 0 cm\n${line(WORDS, 300)}\nQ` })).toBe("rotated_text");
  });

  test("vertical text", async () => {
    const raw: Raw = {
      content: "BT /V 24 Tf 300 700 Td <6e2f306e901a884c7a0e> Tj ET",
      fonts: "/V 6 0 R",
      objects: [
        "<< /Type /Font /Subtype /Type0 /BaseFont /HeiseiMin-W3 /Encoding /UniJIS-UCS2-V /DescendantFonts [7 0 R] >>",
        "<< /Type /Font /Subtype /CIDFontType0 /BaseFont /HeiseiMin-W3 /CIDSystemInfo << /Registry (Adobe) /Ordering (Japan1) /Supplement 2 >> /FontDescriptor 8 0 R >>",
        "<< /Type /FontDescriptor /FontName /HeiseiMin-W3 /Flags 6 /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 700 /StemV 80 >>",
      ],
    };
    const text = await pageText(rawPdf(raw));
    expect(await reason(raw, text.trim().slice(0, 2))).toBe("vertical_text");
  });

  test("right-to-left text on a quoted line, and a quoted ligature", async () => {
    // Helvetica told to give Hebrew letters for A and B.
    const cmap = "/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CMapName /T def 1 begincodespacerange <00> <FF> endcodespacerange 2 beginbfchar <41> <05D0> <42> <05D1> endbfchar endcmap end end";
    const hebrew: Raw = {
      content: `${line("The word follows", 700)}\nBT /H 24 Tf 40 660 Td (AB) Tj ET`, fonts: "/H 6 0 R",
      objects: ["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding /ToUnicode 7 0 R >>", stream("", cmap)],
    };
    const text = await pageText(rawPdf(hebrew));
    expect(await reason(hebrew, text.split("\n")[1]!)).toBe("right_to_left");
    // The library reorders it, so no quotation anywhere on such a page agrees letter for letter.
    expect(await reason(hebrew, "word")).toBe("unclear_positions");
    const ligature: Raw = {
      content: `BT /L 24 Tf 40 700 Td (A \\001eld of reeds) Tj ET`, fonts: "/L 6 0 R",
      objects: ["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding << /Type /Encoding /BaseEncoding /WinAnsiEncoding /Differences [1 /fi] >> >>"],
    };
    const read = await pageText(rawPdf(ligature));
    expect(read).toContain("ﬁeld");
    expect(await reason(ligature, "ﬁeld of")).toBe("ligature");
    expect(await reason(ligature, "of reeds")).toBe("boxes");
  });

  test("a quotation that joins, begins, or ends at a word split by a hyphen, across a page too", () => {
    const pages = [
      { blocks: [{ role: "paragraph", content: "The first ha-\nlf of the word, and a la-" }] },
      { blocks: [{ role: "paragraph", content: "goon beyond it, well-\nkept." }] },
    ];
    const view = viewOf([...corpusOf({ pages: pages as never, records: [] }).texts.values()][0]!);
    const at = (index: number, quote: string) => {
      const words = view.part(index)!.streams.main;
      const start = words.indexOf(quote);
      expect(start).toBeGreaterThanOrEqual(0);
      const made = targetRanges(view, index, "main", start, start + quote.length);
      return "refused" in made ? made.refused : "ranges";
    };
    // Joins; ends with a first half in a line; begins with a second half; ends a page with one; begins a page with a second half.
    for (const [index, quote] of [[0, "first ha-\nlf of"], [0, "first ha-"], [0, "lf of the"], [0, "and a la-"], [1, "goon beyond"], [1, "kept"]] as const) {
      expect([quote, at(index, quote)]).toEqual([quote, "hyphen_split"]);
    }
    for (const [index, quote] of [[0, "The first"], [0, "of the word"], [1, "beyond it"], [1, "it, well"]] as const) {
      expect([quote, at(index, quote)]).toEqual([quote, "ranges"]);
    }
  });
});

describe("US-123-AC4 words that may not be seen where the text layer places them", () => {
  test("invisible text, a scan's recognition layer, and text only stroked", async () => {
    expect(await reason(around("3 Tr"))).toBe("invisible_text");
    expect(await reason(around(`${draw("600 0 0 800 0 0")} BT 3 Tr ET`, "", IMAGE))).toBe("recognition_layer");
    // The layer under the picture of the page, as well as over it.
    expect(await reason(around("3 Tr", draw("600 0 0 800 0 0"), IMAGE))).toBe("recognition_layer");
    expect(await reason(around("1 Tr"))).toBe("hidden_text");
    expect(await reason(around("2 Tr"))).toBe("hidden_text");
    // Text used to clip what follows is not read further.
    expect(await reason(around("7 Tr"))).toBe("unknown_drawing");
    expect(await reason(around("4 Tr"))).toBe("unknown_drawing");
  });

  test("white, pale, transparent, blended, tiny, clipped, and off the page", async () => {
    for (const before of ["1 g", "0.8 g", "1 1 0 rg", "0 0 0 0 k", "/Clear gs", "/Half gs", "/Blend gs"]) {
      expect([before, await reason(around(before, "", STATES))]).toEqual([before, "hidden_text"]);
    }
    expect(await reason({ content: line(WORDS, 700, 3) })).toBe("hidden_text");
    // Clipped away, cut through, and clipped by a shape that is not a rectangle.
    for (const clip of ["0 0 100 100 re W n", "0 710 600 80 re W n", "0 600 m 600 600 l 300 800 l h W n", "0 0 600 800 re 150 690 100 40 re W* n"]) {
      expect([clip, await reason(around(clip))]).toEqual([clip, "hidden_text"]);
    }
    // The last letter the text content keeps begins on the page and ends past it.
    const over: Raw = { content: line("MMMMMMMM", 700, 24, 475) };
    expect(await reason(over, (await pageText(rawPdf(over))).trim())).toBe("hidden_text");
    expect(await reason({ content: line(WORDS, 798) })).toBe("hidden_text");
  });

  test("anything painted over or under the words", async () => {
    const cases: [string, Raw][] = [
      ["a black block after", around("", "130 690 100 30 re f")],
      ["a white block after", around("", "1 g 130 690 100 30 re f")],
      ["a dark ground before", around("0.1 g 30 690 500 30 re f 0 g")],
      ["a pale ground before", around("0.9 g 30 690 500 30 re f 0 g")],
      ["a line through them", around("", "30 708 m 500 708 l S")],
      ["a thick line beside them", around("", "40 w 30 735 m 500 735 l S")],
      ["a white block stroked in black before", around("1 g 30 690 500 18 re B 0 g")],
      ["an image under", around(draw("300 0 0 60 100 680"), "", IMAGE)],
      ["an image over", around("", draw("30 0 0 30 160 695"), IMAGE)],
      ["a shading", around("/Sh sh", "", { resources: "/Shading << /Sh 6 0 R >>", objects: ["<< /ShadingType 2 /ColorSpace /DeviceGray /Coords [0 0 600 0] /Function << /FunctionType 2 /Domain [0 1] /N 1 /C0 [0] /C1 [1] >> >>"] })],
    ];
    for (const [name, raw] of cases) expect([name, await reason(raw)]).toEqual([name, "covered"]);
    // The same paint away from the words changes nothing.
    expect(await reason(around(draw("30 0 0 30 160 100"), "30 500 m 500 500 l S", IMAGE))).toBe("boxes");
  });

  test("other text over the words, an invisible second layer included", async () => {
    expect(await reason({ content: `${line(WORDS)}\n${line("another set of words laid over", 702)}` })).toBe("overlapping_text");
    expect(await reason({ content: `${line(WORDS)}\n3 Tr ${line("a second layer of other words", 700)}` })).toBe("overlapping_text");
    // A copy laid over itself, as for a bold effect.
    expect(await reason({ content: `${line(WORDS)}\n${line(WORDS, 700, 24, 40.4)}` })).toBe("overlapping_text");
    // A large letter whose font says it has no width reaches over the words from beside them.
    const unmeasured: Raw = {
      content: `${line(WORDS)}\nBT /Z 90 Tf 160 680 Td (W) Tj ET`, fonts: "/Z 6 0 R",
      objects: ["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding /FirstChar 87 /LastChar 87 /Widths [0] >>"],
    };
    expect(await reason(unmeasured)).toBe("overlapping_text");
    // And a quoted letter whose shape is far outside its stated width is not marked.
    const narrow: Raw = {
      content: "BT /Z 24 Tf 40 700 Td (aWa) Tj ET", fonts: "/Z 6 0 R",
      objects: ["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding /FirstChar 87 /LastChar 97 /Widths [100 0 0 0 0 0 0 0 0 0 556] >>"],
    };
    expect(await reason(narrow, "W")).toBe("hidden_text");
    // Drawn back over itself within the quotation.
    expect(await reason({ content: "BT /F1 24 Tf 40 700 Td [(The tide ta) 2000 (ble was kept)] TJ ET" }, "table was kept".slice(0, 2))).not.toBe("boxes");
  });

  test("drawing that is not checked: optional content, a transparency group, a soft mask, a Type 3 font", async () => {
    expect(await reason({
      content: `/OC /L BDC\n${line(WORDS)}\nEMC`, resources: "/Properties << /L 6 0 R >>", objects: ["<< /Type /OCG /Name (layer) >>"],
    })).toBe("unknown_drawing");
    const form = (entries: string): Raw => ({
      content: `${line(WORDS)}\n/Fm Do`, resources: "/XObject << /Fm 6 0 R >>",
      objects: [stream(`/Type /XObject /Subtype /Form /BBox [0 0 10 10] /Resources << >> ${entries}`, "0 0 5 5 re f")],
    });
    expect(await reason(form("/Group << /S /Transparency >>"))).toBe("unknown_drawing");
    expect(await reason(around("/Soft gs", "", {
      resources: "/ExtGState << /Soft << /SMask << /S /Alpha /G 6 0 R >> >> >>",
      objects: [stream("/Type /XObject /Subtype /Form /BBox [0 0 600 800] /Group << /S /Transparency >> /Resources << >>", "0 0 600 800 re f")],
    }))).toBe("unknown_drawing");
    const type3: Raw = {
      content: `${line(WORDS)}\nBT /T 24 Tf 40 300 Td (a) Tj ET`, fonts: "/T 6 0 R",
      objects: [
        "<< /Type /Font /Subtype /Type3 /FontBBox [0 0 1000 1000] /FontMatrix [0.001 0 0 0.001 0 0] /CharProcs << /a 7 0 R >> /Encoding << /Differences [97 /a] >> /FirstChar 97 /LastChar 97 /Widths [1000] /Resources << >> >>",
        stream("", "1000 0 d0 0 0 1000 1000 re f"),
      ],
    };
    expect(await reason(type3)).toBe("unknown_drawing");
  });

  test("a page or quotation past the bounds", async () => {
    const before = { ...HIGHLIGHT_BOUNDS };
    try {
      for (const bound of ["operators", "glyphs", "boxes"] as const) {
        Object.assign(HIGHLIGHT_BOUNDS, before, { [bound]: bound === "boxes" ? 0 : 3 });
        expect([bound, await reason(plain)]).toEqual([bound, "too_much"]);
      }
    } finally {
      Object.assign(HIGHLIGHT_BOUNDS, before);
    }
  });
});

describe("US-123 what the record says to look for", () => {
  test("a part's text holds every line of every block, and each unit of a stream is placed in it; a note marker stays in the text and out of the quotation", () => {
    const blocks = [
      { role: "running-head", content: "HEAD 4" },
      { role: "paragraph", content: 'A claim<!--stemma:fnref label="1"-->1<!--/stemma:fnref--> and &lt;more> &amp;lt; <!--stemma:uncertain by="x"-->here<!--/stemma:uncertain-->.' },
      { role: "footnote", label: "1", content: "1 A note." },
      { role: "paragraph", content: "The end." },
    ];
    const made = partPageText(blocks, "main")!;
    expect(made.text).toBe("HEAD 4\nA claim1 and <more> &lt; here.\n1 A note.\nThe end.");
    expect(made.stream).toBe(streamsOf(blocks).main);
    expect([...made.stream].every((c, i) => made.at[i] === -1 ? c === "\n" : made.text[made.at[i]!] === c)).toBe(true);
    expect(partPageText(blocks, "notes")!.stream).toBe(streamsOf(blocks).notes);
    expect(partPageText([{ role: "table", content: "| a | b |" }], "main")).toBeUndefined();
  });

  test("US-123-AC5 the server's snapshot says what to look for only for a highlighted passage on a page of a PDF", async () => {
    const { one, two, note } = standard();
    const corpus = corpusOf();
    const base = servedData(corpus, { version: "0", manuscript: () => emptyManuscript("none") });
    const views = new SourceViews(corpus);
    const made = Object.fromEntries([one, two, note].map((p) => [p.id, views.passage(p.id)]));
    const targets = highlightTargets(corpus, made);
    expect(Object.keys(targets[two.id]!)).toEqual(["0", "1"]);
    expect("refused" in targets[two.id]![0]!).toBe(true);
    const tie = { form: "file", paged: true, page_count: 3, parts: [0, 1, 2], files: [{ sha256: "b".repeat(64), size: 10, media_type: "application/pdf" }] };
    const textId = made[one.id]!.source_text!.id;
    const answer = async (originals: unknown, body: unknown) => {
      const served = { ...base, views: made, originals: originals as never, highlights: targets };
      const got = await (await answersOf(served))("highlight-target", body);
      const { result } = JSON.parse(got.body) as { result?: { highlight?: { reason: string }; target?: HighlightTarget } };
      return got.status !== 200 ? got.status : result!.highlight?.reason ?? result!.target;
    };
    const real = { [textId]: tie };
    expect(await answer(real, { passage: one.id, index: 1 })).toMatchObject({ sha256: "b".repeat(64), page: 2, page_count: 3 });
    expect(await answer(real, { passage: one.id, index: 0 })).toBe("no_segment");
    expect(await answer(real, { passage: "psg-nothing00000", index: 1 })).toBe("no_segment");
    expect(await answer(real, { passage: "__proto__", index: 1 })).toBe("no_segment");
    expect(await answer(real, { passage: two.id, index: 0 })).toBe("hyphen_split");
    expect(await answer({ [textId]: { ...tie, form: "page_images", files: [0, 1, 2].map((index) => ({ sha256: "c".repeat(64), size: 1, media_type: "image/png", index })) } }, { passage: one.id, index: 1 })).toBe("page_image");
    expect(await answer({ [textId]: { ...tie, page_count: undefined } }, { passage: one.id, index: 1 })).toBe("no_pdf_page");
    for (const body of [{ passage: one.id }, { passage: one.id, index: -1 }, { passage: 3, index: 1 }, { passage: one.id, index: 1, sha256: "a" }]) {
      expect(await answer(real, body)).toBe(400);
    }
  });
});

describe("US-123-AC6 the server's call", () => {
  test("it is a signed call like every other; the reader is given only a recorded original of an allowed size, and nothing while the files have changed", async () => {
    const target: HighlightTarget = { sha256: "e".repeat(64), size: 5, page: 1, page_count: 1, text_sha256: "0".repeat(64), ranges: [[0, 1]] };
    let verdict: Verdict = { state: "current", data_identity: "d", process: { ask: async (route: string) => ({ status: 200, body: JSON.stringify({ data_identity: "d", result: route === "highlight-target" ? { target } : null }) }) } as never };
    let placedCalls = 0;
    let closed = 0;
    const session = createSession(() => {});
    const server = await listen({
      assets: { html: "", js: "", css: "" }, session, check: async () => verdict, originals: { read: async () => ({ refused: "original_not_held" }) }, originalLimits: { bytes: 4 },
      highlighter: { place: async () => (placedCalls++, noHighlight("covered")), close: () => void closed++ },
    });
    try {
      const secret = (await redeem(server, session.code)).json.secret as string;
      const body = { passage: "psg-one", index: 0 };
      expect((await post(server, "/api/original-highlight", body)).status).toBe(401);
      expect((await fetch(`${server.address}api/original-highlight`)).status).toBe(404);
      // Larger than the server reads: the reader is not started.
      expect((await post(server, "/api/original-highlight", body, secret)).json.result).toEqual(noHighlight("too_large"));
      expect(placedCalls).toBe(0);
      target.size = 3;
      expect((await post(server, "/api/original-highlight", body, secret)).json).toEqual({ data_identity: "d", result: noHighlight("covered") });
      verdict = { state: "rebuilding" };
      expect((await post(server, "/api/original-highlight", body, secret)).json.error.code).toBe("index_stale");
      expect(placedCalls).toBe(1);
    } finally {
      await server.close();
    }
    expect(closed).toBe(1);
  });
});

describe("US-123-AC6 the reading is bounded", () => {
  const target: HighlightTarget = { sha256: sha256("bytes"), size: 5, page: 1, page_count: 1, text_sha256: "0".repeat(64), ranges: [[0, 1]] };
  const worker = (code: string): string[] => {
    const path = join(temporary(), "worker.js");
    writeFileSync(path, code);
    return [process.execPath, "--no-install", "--no-env-file", "--config=/dev/null", path];
  };
  const SLOW = "process.on('message', () => {}); setInterval(() => {}, 1000);";
  let released = 0;
  const load = async (): Promise<LoadedOriginal> => ({ bytes: Buffer.from("bytes"), release: () => void released++ });
  const reasonIn = (made: Highlight) => (made.state === "none" ? made.reason : "boxes");

  test("a reader that takes too long is ended, and one that fails or ends gives no box", async () => {
    released = 0;
    expect(reasonIn(await createHighlighter(worker(SLOW), { ms: 300 }).place(target, load))).toBe("too_slow");
    expect(reasonIn(await createHighlighter(worker("process.exit(1)")).place(target, load))).toBe("failed");
    expect(released).toBe(2);
  });

  test("one at a time, a bounded line, other bytes never read, and closing ends it", async () => {
    released = 0;
    let loaded = 0;
    const highlighter = createHighlighter(worker(SLOW), { ms: 60_000, waiting: 2 });
    const all = Array.from({ length: 5 }, () => highlighter.place(target, () => (loaded++, load())));
    expect(await Promise.all(all.slice(3).map(async (m) => reasonIn(await m)))).toEqual(["busy", "busy"]);
    await Bun.sleep(300);
    expect(loaded).toBe(1);
    const began = Date.now();
    highlighter.close();
    expect((await Promise.all(all.slice(0, 3))).map(reasonIn)).toEqual(["failed", "failed", "failed"]);
    expect(Date.now() - began).toBeLessThan(5000);
    expect(reasonIn(await createHighlighter(worker(SLOW)).place(target, async () => ({ bytes: Buffer.from("other"), release: () => {} })))).toBe("changed");
    expect(reasonIn(await createHighlighter(worker(SLOW)).place(target, async () => ({ refused: "original_not_held" })))).toBe("not_held");
    expect(reasonIn(await createHighlighter(worker(SLOW)).place(target, load, () => true))).toBe("failed");
  });
});

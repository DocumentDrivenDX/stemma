// Estimated places on scans (CONTRACT-005 M, "Estimates on scans"; US-123): an
// estimate only where invisible recognition text lies over a picture of the page
// and one place in it matches, and a reason for every other case. All pages and
// words are invented.
import { describe, expect, test } from "bun:test";
import { sha256 } from "@stemma/records";
import { NO_HIGHLIGHT, type Highlight, type HighlightTarget, type HighlightWords } from "../packages/core/src/highlight.ts";
import { estimatePlace, findWords, foldLetters, type LayerGlyph } from "../packages/extract/src/pdf-estimate.ts";
import { locateOnPage } from "../packages/extract/src/pdf-highlight.ts";
import { line, pageText, rawPdf, type Raw, stream, targetFor } from "./highlight-pdf.ts";

const words = (quoted: string, before = "", after = ""): HighlightWords => ({ quoted, before, after });
const letters = (text: string): string[] => foldLetters(text);
/** What was found, as the page's letters between the two places. */
const found = (asked: HighlightWords, page: string): string => {
  const made = findWords(asked, letters(page));
  return "refused" in made ? made.refused : letters(page).slice(made.from, made.to).join("");
};

const QUOTE = "the harbour clerk kept a table of every tide";
const PAGE = `Of the old port little is known. In those years the harbour clerk kept a table of every tide, and the pilots copied it. None of the copies survives.`;

describe("US-123-AC9 the words looked for in a scan's text", () => {
  test("line breaks, a hyphen at a line end, ligatures, capitals, accents, spacing and punctuation count for nothing", () => {
    expect(foldLetters("Ef-\nﬁcient, DÉJÀ ſo!").join("")).toBe("efficientdejaso");
    const layer = "In those years the har-\nbour clerk kept a ta-\nble of  every tide , and more.";
    expect(found(words(QUOTE), layer)).toBe(letters(QUOTE).join(""));
  });

  test("a few wrong, lost and added letters are allowed", () => {
    const noisy = PAGE.replace("harbour clerk", "harbonr cierk").replace("every", "evrry");
    expect(found(words(QUOTE), noisy)).toBe(letters("the harbonr cierk kept a table of evrry tide").join(""));
  });

  test("a weak match is refused: other words, too many wrong letters, or a part of the quotation alone", () => {
    expect(found(words("a sentence that was never printed anywhere on it"), PAGE)).toBe("scan_weak_match");
    expect(found(words(QUOTE), "tbc harhonr cleik kepl u tahle ot evcry tidc")).toBe("scan_weak_match");
    expect(found(words(QUOTE), "In those years the harbour clerk")).toBe("scan_weak_match");
    expect(found(words(QUOTE), "")).toBe("scan_weak_match");
  });

  test("short words are refused, however well they match, and very long ones are not looked for", () => {
    expect(found(words("harbour clerk"), PAGE)).toBe("scan_short");
    expect(found(words("tide ".repeat(2000)), PAGE)).toBe("too_much");
  });

  test("words that occur twice are refused unless the words around them settle which", () => {
    const north = ["In the first years, at the stone quay in the north,", "until the long war with the islands began."] as const;
    const south = ["Afterwards, beside the timber wharf to the south,", "until sand and weed had silted up its mouth."] as const;
    const twice = `${north[0]} ${QUOTE} ${north[1]} ${south[0]} ${QUOTE} ${south[1]}`;
    expect(found(words(QUOTE), twice)).toBe("scan_ambiguous");
    for (const [at, [before, after]] of [[twice.indexOf(QUOTE), north], [twice.lastIndexOf(QUOTE), south]] as const) {
      const made = findWords(words(QUOTE, before, after), letters(twice));
      expect(made).toMatchObject({ from: letters(twice.slice(0, at)).length });
    }
    // The same words around both, or too few of them to tell by.
    const alike = `We read that ${QUOTE} in spring. We read that ${QUOTE} in spring.`;
    expect(found(words(QUOTE, "We read that", "in spring."), alike)).toBe("scan_ambiguous");
    expect(found(words(QUOTE, "quay", "until"), twice)).toBe("scan_ambiguous");
    // A second place that differs by one letter casts the same doubt.
    expect(found(words(QUOTE), `${QUOTE}. And ${QUOTE.replace("tide", "ride")}.`)).toBe("scan_ambiguous");
  });
});

const glyph = (text: string, left: number, top: number, more: Partial<LayerGlyph> = {}): LayerGlyph => (
  { text, left, top, right: left + 5, bottom: top + 10, level: true, ...more }
);

describe("US-123-AC8 the estimate’s result names how it was derived", () => {
  test("one box for each line, from the recorded offsets or from a match", () => {
    const layer = [..."the harbour clerk kept"].map((c, i) => glyph(c, i * 5, 0))
      .concat([..."a table of every tide"].map((c, i) => glyph(c, i * 5, 14)));
    const matched = estimatePlace(layer, { words: words(QUOTE) });
    expect(matched).toEqual({ method: "ocr_layer_match", rects: [{ left: 0, top: 0, right: 110, bottom: 10 }, { left: 0, top: 14, right: 105, bottom: 24 }] });
    expect(estimatePlace(layer, { exact: layer.slice(4, 11), words: words(QUOTE) })).toEqual({ method: "ocr_layer_offsets", rects: [{ left: 20, top: 0, right: 55, bottom: 10 }] });
  });

  test("text that does not run across the page, and nothing to look for, give no box", () => {
    expect(estimatePlace([glyph("a", 0, 0, { level: false })], { exact: [glyph("a", 0, 0, { level: false })] })).toEqual({ refused: "rotated_text" });
    expect(estimatePlace([], {})).toEqual({ refused: "scan_weak_match" });
  });
});

const PICTURE = {
  resources: "/XObject << /Im 6 0 R >>",
  objects: [stream("/Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /ASCIIHexDecode", "f0>")],
};
const WHOLE = "q 600 0 0 800 0 0 cm /Im Do Q";
const LINES = ["In those years the harbour clerk kept a ta-", "ble of every tide, and the pilots copied it."];
const typed = `${line(LINES[0]!, 700, 14)}\n${line(LINES[1]!, 680, 14)}`;
/** A scanned page: its picture, with invisible text over it. */
const scan = (text = typed, more: Partial<Raw> = {}): Raw => ({ ...PICTURE, content: `${WHOLE}\nBT 3 Tr ET\n${text}`, ...more });
const SPLIT = "the harbour clerk kept a ta-\nble of every tide";

/** The page read for the first place `quote` is in its text, with `more` in place of what that gives. */
async function located(raw: Raw, quote: string, more: Partial<HighlightTarget> = {}): Promise<Highlight> {
  const bytes = rawPdf(raw);
  const text = await pageText(bytes);
  const made = await locateOnPage(bytes, { ...targetFor(bytes, text, quote), words: words(quote), ...more });
  if (made.state === "none") expect(made.why).toBe(NO_HIGHLIGHT[made.reason]);
  return made;
}
const shown = (made: Highlight): string => (made.state === "none" ? made.reason : made.state === "estimate" ? `estimate ${made.method} ${made.boxes.length}` : "boxes");
/** A page whose text was corrected after it was converted: only matching can find the words. */
const CORRECTED = { text_sha256: sha256("another text"), ranges: [[0, 1]] as [number, number][] };

describe("US-123-AC8 and AC9 estimates on pages of a PDF", () => {
  test("a scan gets an estimate, never a highlight: from the offsets where its text is the source text's, with its boxes on the words' lines", async () => {
    const made = await located(scan(), "harbour clerk kept");
    expect(shown(made)).toBe("estimate ocr_layer_offsets 1");
    if (made.state !== "estimate") return;
    expect([made.page, made.page_count]).toEqual([1, 1]);
    const [box] = made.boxes;
    // The first line's baseline is at 700 of 800.
    expect((1 - box!.top - box!.height) * 800).toBeLessThan(700);
    expect((1 - box!.top) * 800).toBeGreaterThan(705);
    expect(box!.left * 600).toBeGreaterThan(80);
    expect((box!.left + box!.width) * 600).toBeLessThan(300);
  });

  test("a quotation over a hyphen at a line end, which gets no highlight, gets two estimated boxes on a scan and nothing elsewhere", async () => {
    expect(shown(await located(scan(), SPLIT, { refused: "hyphen_split" }))).toBe("estimate ocr_layer_offsets 2");
    expect(shown(await located({ content: typed }, SPLIT, { refused: "hyphen_split" }))).toBe("hyphen_split");
  });

  test("text drawn under the picture of the page, and a scan stored rotated or with a visible stamp, are estimated", async () => {
    expect(shown(await located({ ...PICTURE, content: `${typed}\n${WHOLE}` }, "harbour clerk kept"))).toBe("estimate ocr_layer_offsets 1");
    // The page is shown turned, and so is its text, which therefore reads across it.
    const turned = scan(`BT /F1 14 Tf 0 1 -1 0 100 60 Tm (${LINES[0]}) Tj ET`, { page: "/Rotate 90" });
    expect(shown(await located(turned, "harbour clerk kept"))).toBe("estimate ocr_layer_offsets 1");
    expect(shown(await located(scan(`${typed}\n0 Tr ${line("Lent by an invented library", 20, 8)}`), "harbour clerk kept"))).toBe("estimate ocr_layer_offsets 1");
    // Sideways on the page as shown, there are no lines to put boxes along.
    expect(shown(await located(scan(`BT /F1 14 Tf 0 1 -1 0 100 60 Tm (${LINES[0]}) Tj ET`), "harbour clerk kept"))).toBe("rotated_text");
  });

  test("where the page's text is not the source text's, the words are looked for in the layer, or refused", async () => {
    const quoted = "the harbour clerk kept a table of every tide";
    const corrected = (asked: string, raw = scan()) => located(raw, "harbour", { ...CORRECTED, words: words(asked) });
    expect(shown(await corrected(quoted))).toBe("estimate ocr_layer_match 2");
    expect(shown(await corrected("a sentence that was never printed anywhere on it"))).toBe("scan_weak_match");
    expect(shown(await corrected("harbour clerk"))).toBe("scan_short");
    const twice = scan(`${typed}\n${line(LINES[0]!, 400, 14)}\n${line(LINES[1]!, 380, 14)}`);
    expect(shown(await corrected(quoted, twice))).toBe("scan_ambiguous");
    // Without the words nothing is looked for.
    const bytes = rawPdf(scan());
    expect(shown(await locateOnPage(bytes, { sha256: sha256(bytes), size: bytes.length, page: 1, page_count: 1, ...CORRECTED }))).toBe("scan_weak_match");
  });

  test("a scan with no text layer is not recognized: nothing is estimated, and the reason says so", async () => {
    const bare: Raw = { ...PICTURE, content: WHOLE };
    const bytes = rawPdf(bare);
    const target: HighlightTarget = { sha256: sha256(bytes), size: bytes.length, page: 1, page_count: 1, ...CORRECTED, words: words(SPLIT) };
    expect(shown(await locateOnPage(bytes, target))).toBe("no_text_layer");
  });

  test("a page that is not a scan keeps its reason, whatever pictures or invisible text it has", async () => {
    const small = "q 500 0 0 60 40 665 cm /Im Do Q";
    // Visible words over a background picture of the whole page.
    expect(shown(await located({ ...PICTURE, content: `${WHOLE}\n${typed}` }, "harbour clerk kept"))).toBe("covered");
    expect(shown(await located({ ...PICTURE, content: `${WHOLE}\n${typed}` }, "harbour", CORRECTED))).toBe("text_differs");
    // Invisible text over a picture of only a part of the page, and with no picture.
    expect(shown(await located({ ...PICTURE, content: `${small}\nBT 3 Tr ET\n${typed}` }, "harbour clerk kept"))).toBe("recognition_layer");
    expect(shown(await located({ content: `BT 3 Tr ET\n${typed}` }, "harbour clerk kept"))).toBe("invisible_text");
    // A little invisible text on a page whose words are mostly seen.
    expect(shown(await located({ ...PICTURE, content: `${typed}\n${small.replace("665", "100")}\nBT 3 Tr ET\n${line("unseen", 120, 14)}` }, "harbour", CORRECTED))).toBe("text_differs");
    // Quoted words that are seen, on a page that is otherwise a scan.
    const mixed = scan(`${typed}\n0 Tr ${line("A visible note added to the scan", 40, 14)}`);
    expect(shown(await located(mixed, "visible note added"))).not.toStartWith("estimate");
  });
});

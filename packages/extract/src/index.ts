// Reads the text layer of a PDF, page by page, with the pinned pdf.js
// (SD-002, "Extraction and page mapping"). It recognizes nothing in page images
// and draws nothing. It runs no document script, follows no link, opens no
// attachment and makes no network request.
//
// The library is loaded only when a PDF is read. Whatever it prints is left as
// it is: the plugin ships no native drawing module, and pdf.js says so.
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { type Removal, removals, removeFromPieces } from "./stamps.ts";

/** One piece of text with its place: x and y of its baseline start, its width, and its size. */
export interface PdfItem { text: string; x: number; y: number; width: number; size: number }

export interface PdfLine { items: PdfItem[]; text: string }

export interface PdfText {
  /** One string per file page, in file order. A page with no text layer is empty. */
  pages: string[];
  /** The same text divided into lines, with the place of each piece. */
  lines: PdfLine[][];
  widths: number[];
  /** For each page, what was removed from its text as it was read: download stamps. */
  removed: Removal[][];
  /** What the file states about itself. */
  info: { title?: string; author?: string; producer?: string; creator?: string };
  /** The labels the file itself states for its pages, if it states any. Not proof of printed numbers. */
  embeddedLabels?: string[];
  tool: { name: "pdfjs-dist"; version: string };
}

export type PdfProblem = "encrypted" | "damaged" | "too_many_pages" | "too_much_text" | "too_slow";

export class PdfUnreadable extends Error {
  constructor(readonly problem: PdfProblem, detail = "") {
    super(detail || problem);
  }
}

export interface PdfLimits { pages: number; text_bytes: number; milliseconds: number }

/**
 * The font and character-map data pdf.js needs, as shipped beside the built
 * command line, or in the installed library when run from source. Without the
 * character maps, text in some fonts is lost.
 */
export function assetDirectory(): string {
  const shipped = join(import.meta.dir, "pdfjs");
  if (existsSync(join(shipped, "cmaps"))) return shipped;
  return dirname(Bun.resolveSync("pdfjs-dist/package.json", import.meta.dir));
}

/** The pinned PDF library; a test checks it against what the library reports. */
export const PDFJS_VERSION = "6.5.438";

export async function readPdf(bytes: Uint8Array, limits: PdfLimits, assets = assetDirectory()): Promise<PdfText> {
  for (const name of ["cmaps", "standard_fonts"]) {
    if (!existsSync(join(assets, name))) throw new Error(`the PDF library's ${name} data is missing from ${assets}`);
  }
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // The worker runs in this process. Naming it here puts it inside the one built
  // file; left to itself the library would look for a second file at run time.
  const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
  const started = Date.now();
  const task = pdfjs.getDocument({
    // The library takes ownership of the buffer it is given.
    data: new Uint8Array(bytes),
    cMapUrl: `${join(assets, "cmaps")}/`,
    cMapPacked: true,
    standardFontDataUrl: `${join(assets, "standard_fonts")}/`,
    useSystemFonts: false,
    disableFontFace: true,
    enableXfa: false,
    // A page that cannot be read fails the whole reading instead of coming out short.
    stopAtErrors: true,
  });
  try {
    const document = await task.promise;
    if (document.numPages > limits.pages) throw new PdfUnreadable("too_many_pages");
    const pages: string[] = [];
    const lines: PdfLine[][] = [];
    const widths: number[] = [];
    const removed: Removal[][] = [];
    let size = 0;
    for (let number = 1; number <= document.numPages; number++) {
      if (Date.now() - started > limits.milliseconds) throw new PdfUnreadable("too_slow");
      const page = await document.getPage(number);
      // Characters are kept as the file maps them: no compatibility folding.
      const content = await page.getTextContent({ disableNormalization: true });
      // A download stamp goes before anything is worked out from the text.
      const items = content.items.flatMap((item) => ("str" in item ? [item] : []));
      const cleaned = removeFromPieces(items.map((item) => ({ text: item.str, after: item.hasEOL ? "\n" : "" })));
      removed.push(removals(cleaned.rules));
      const text = items
        .map((item, i) => cleaned.texts[i]! + (item.hasEOL ? "\n" : ""))
        .join("")
        // A form feed marks a page end in the saved text, so none may come from inside a page.
        .replace(/\f/g, " ")
        .replace(/\0/g, "�");
      size += Buffer.byteLength(text) + 1;
      if (size > limits.text_bytes) throw new PdfUnreadable("too_much_text");
      pages.push(text);
      const pageLines: PdfLine[] = [{ items: [], text: "" }];
      for (const [i, item] of items.entries()) {
        const line = pageLines.at(-1)!;
        const piece = cleaned.texts[i]!.replace(/[\f\0]/g, " ");
        line.text += piece;
        if (piece !== "") {
          const [a, b, , d, x, y] = item.transform as number[];
          line.items.push({ text: piece, x: x!, y: y!, width: item.width, size: Math.hypot(a!, b!) || Math.abs(d!) });
        }
        if (item.hasEOL) pageLines.push({ items: [], text: "" });
      }
      lines.push(pageLines.filter((l) => l.text.trim() !== ""));
      widths.push(page.view[2]! - page.view[0]!);
      page.cleanup();
    }
    const labels = await document.getPageLabels();
    const stated = ((await document.getMetadata()).info ?? {}) as Record<string, unknown>;
    const info = Object.fromEntries((["Title", "Author", "Producer", "Creator"] as const)
      .flatMap((k) => (typeof stated[k] === "string" && (stated[k] as string).trim() ? [[k.toLowerCase(), (stated[k] as string).trim()]] : [])));
    return {
      pages, lines, widths, removed, info,
      ...(labels ? { embeddedLabels: labels } : {}),
      tool: { name: "pdfjs-dist", version: pdfjs.version },
    };
  } catch (error) {
    if (error instanceof PdfUnreadable) throw error;
    const name = (error as { name?: string }).name;
    if (name === "PasswordException") throw new PdfUnreadable("encrypted");
    throw new PdfUnreadable("damaged", error instanceof Error ? error.message : "");
  } finally {
    await task.destroy();
  }
}

export * from "./convert.ts";
export * from "./stamps.ts";
export * from "./model.ts";
export { parseTranscription } from "./transcription.ts";

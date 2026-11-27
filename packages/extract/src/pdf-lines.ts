// How one PDF page's text items become its text and lines. The converter and the
// reading that places a highlight (CONTRACT-005 M) both use this, so that a page
// read again gives the same text as when it was converted.
import { type Removal, removals, removeFromPieces } from "./stamps.ts";
import type { PdfLine } from "./index.ts";

/** What is read of an item of pdf.js's text content. */
export interface RawItem { str?: string; hasEOL?: boolean; transform?: number[]; width?: number; dir?: string }

export interface PageItems {
  /** The page's text as it is saved: items in order, a line feed where a line ends. */
  text: string;
  /** The lines that hold ink, with the place of each piece. */
  lines: PdfLine[];
  removed: Removal[];
  /** The text items, and what is left of each after download stamps are removed. */
  items: (RawItem & { str: string })[];
  kept: string[];
}

export function readPageItems(content: RawItem[]): PageItems {
  const items = content.flatMap((item) => (typeof item.str === "string" ? [item as RawItem & { str: string }] : []));
  // A download stamp goes before anything is worked out from the text.
  const cleaned = removeFromPieces(items.map((item) => ({ text: item.str, after: item.hasEOL ? "\n" : "" })));
  const text = items
    .map((item, i) => cleaned.texts[i]! + (item.hasEOL ? "\n" : ""))
    .join("")
    // A form feed marks a page end in the saved text, so none may come from inside a page.
    .replace(/\f/g, " ")
    .replace(/\0/g, "�");
  const lines: PdfLine[] = [{ items: [], text: "" }];
  for (const [i, item] of items.entries()) {
    const line = lines.at(-1)!;
    const piece = cleaned.texts[i]!.replace(/[\f\0]/g, " ");
    line.text += piece;
    if (piece !== "") {
      const [a, b, , d, x, y] = item.transform as number[];
      line.items.push({ text: piece, x: x!, y: y!, width: item.width!, size: Math.hypot(a!, b!) || Math.abs(d!) });
    }
    if (item.hasEOL) lines.push({ items: [], text: "" });
  }
  return { text, lines: lines.filter((l) => l.text.trim() !== ""), removed: removals(cleaned.rules), items, kept: cleaned.texts };
}

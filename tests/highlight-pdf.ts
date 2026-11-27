// One-page PDFs given as drawing operators, for the tests of highlights on
// originals. Every word in them is invented.
import { readPdf } from "../packages/extract/src/index.ts";
import { locateOnPage } from "../packages/extract/src/pdf-highlight.ts";
import { cleanText } from "../packages/extract/src/model.ts";
import type { Highlight, HighlightTarget } from "../packages/core/src/highlight.ts";
import { sha256 } from "@stemma/records";

export interface Raw {
  /** The page's content stream. /F1 is Helvetica, not embedded. */
  content: string;
  /** More entries of the page, such as /Rotate. */
  page?: string;
  /** More entries of the page's resources. `FONT` in it is replaced by more fonts. */
  resources?: string;
  fonts?: string;
  /** More objects, numbered from 6. */
  objects?: string[];
}

export const stream = (entries: string, data: string): string => `<< ${entries} /Length ${data.length} >>\nstream\n${data}\nendstream`;

export function rawPdf(raw: Raw): Uint8Array {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 5 0 R ${raw.fonts ?? ""} >> ${raw.resources ?? ""} >> /Contents 4 0 R ${raw.page ?? ""} >>`,
    stream("", raw.content),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    ...(raw.objects ?? []),
  ];
  let out = "%PDF-1.6\n";
  const offsets = objects.map((body, i) => {
    const at = out.length;
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return at;
  });
  const start = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, "latin1"));
}

/** One line of text at a place, in black unless the operators before it say otherwise. */
export const line = (text: string, y = 700, size = 24, x = 40): string => `BT /F1 ${size} Tf ${x} ${y} Td (${text}) Tj ET`;

/** The page's text as a converted source file holds it. */
export async function pageText(bytes: Uint8Array): Promise<string> {
  const read = await readPdf(bytes, { pages: 5, text_bytes: 1e6, milliseconds: 20_000 });
  return read.lines[0]!.map((l) => cleanText(l.text).replace(/\n/g, " ")).join("\n");
}

/** The target for the first place `quote` is in `text`; white space at its ends or inside it is as it is there. */
export function targetFor(bytes: Uint8Array, text: string, quote: string, more: Partial<HighlightTarget> = {}): HighlightTarget {
  const at = text.indexOf(quote);
  if (at < 0) throw new Error(`no ${quote} in ${JSON.stringify(text)}`);
  return { sha256: sha256(bytes), size: bytes.length, page: 1, page_count: 1, text_sha256: sha256(text), ranges: [[at, at + quote.length]], ...more };
}

export async function placed(raw: Raw, quote: string, more: Partial<HighlightTarget> = {}): Promise<Highlight> {
  const bytes = rawPdf(raw);
  return locateOnPage(bytes, targetFor(bytes, await pageText(bytes), quote, more));
}

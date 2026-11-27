// The shape of the manuscript view (`stemma.manuscript/0`; CONTRACT-005 L): the
// assembled report as an export read it, with what each quotation, citation and
// bibliography entry rests on. `publish` makes it from the data the report is
// built from, `graph` writes it, and the explorer reads it. None of them finds a
// link by matching text.
import type { SourceView, ViewWork } from "./source-view.ts";

export const MANUSCRIPT_SCHEMA = "stemma.manuscript/0";

export type ManuscriptPart =
  /** The Markdown subset the Typst output reads: `*italic*` and bare web addresses. */
  | { kind: "text"; text: string }
  | { kind: "quotation"; id: string }
  | { kind: "note"; number: number }
  /** Text left out because it begins as a path on someone's machine. */
  | { kind: "withheld" };

export type ManuscriptBlock = { kind: "text"; level?: 1 | 2 | 3; parts: ManuscriptPart[] } | { kind: "bibliography" };

export interface ManuscriptCitation {
  /** The quotations the citation supports, in order. */
  quotations: string[];
  /** The formatted citation, without the quotations the note gives before it. */
  text?: string;
  withheld?: string;
  /** The cited source. */
  source?: string;
  /** The source whose bibliography entry lists it: a printed letter is listed under its collection. */
  entry?: string;
}

export interface ManuscriptNote {
  number: number;
  citations: ManuscriptCitation[];
  comment?: ManuscriptPart[];
}

export interface ManuscriptQuotation {
  /** Only what `build report` would give, of a quotation that is not broken. */
  text?: string;
  /** The words the report's list sets in italics, each marked `*word*` in the text. */
  italic?: string[];
  /** How the report's text differs from the source text. */
  changes: string[];
  view: SourceView;
}

export interface ManuscriptEntry {
  source?: string;
  text?: string;
  withheld?: string;
  /** Every note citation listed under this entry, by its index in the note. */
  places: { note: number; citation: number }[];
  /** Quotations of a work listed here, given in the text or a comment, that no citation lists. */
  quoted: { quotation: string; note?: number; block?: number }[];
}

export interface ManuscriptView {
  schema: typeof MANUSCRIPT_SCHEMA;
  state: "none" | "unavailable" | "read";
  why?: string;
  inputs?: { directory: string; template: string };
  blocks: ManuscriptBlock[];
  notes: ManuscriptNote[];
  quotations: Record<string, ManuscriptQuotation>;
  bibliography: ManuscriptEntry[];
  works: Record<string, ViewWork>;
  problems: string[];
}

export const emptyManuscript = (state: "none" | "unavailable", why?: string): ManuscriptView => ({
  schema: MANUSCRIPT_SCHEMA, state, ...(why === undefined ? {} : { why }),
  blocks: [], notes: [], quotations: {}, bibliography: [], works: {}, problems: [],
});

export interface Run { kind: "text" | "italic" | "link"; text: string }

/** The Markdown subset of manuscript text and formatted citations, as the Typst output reads it: `*italic*` and bare web addresses. */
export function inlineRuns(text: string): Run[] {
  const runs: Run[] = [];
  let at = 0;
  for (const m of text.matchAll(/\*([^*]+)\*|https?:\/\/\S+?(?=[.,;)]?(?:\s|$))/g)) {
    if (m.index > at) runs.push({ kind: "text", text: text.slice(at, m.index) });
    runs.push(m[1] === undefined ? { kind: "link", text: m[0] } : { kind: "italic", text: m[1] });
    at = m.index + m[0].length;
  }
  if (at < text.length) runs.push({ kind: "text", text: text.slice(at) });
  return runs;
}

/**
 * A quotation's words. Only the italics the report's list names are applied:
 * any other asterisk is one of the source's own characters.
 */
export function quotationRuns(text: string, italic: string[] = []): Run[] {
  let runs: Run[] = [{ kind: "text", text }];
  for (const word of italic) {
    const marked = `*${word}*`;
    runs = runs.flatMap((run): Run[] => (run.kind !== "text" ? [run] : run.text.split(marked)
      .flatMap((piece, i): Run[] => [...(i > 0 ? [{ kind: "italic" as const, text: word }] : []), ...(piece ? [{ kind: "text" as const, text: piece }] : [])])));
  }
  return runs;
}

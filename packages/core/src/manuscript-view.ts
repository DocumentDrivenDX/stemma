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

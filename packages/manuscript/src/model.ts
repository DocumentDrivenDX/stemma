// The parsed manuscript that checks, build and preview share (CONTRACT-006 D).

export interface Position { line: number; column: number }

export type ProblemCode = "manuscript_unsupported" | "manuscript_syntax" | "manuscript_duplicate_id";

/** Says what is wrong and where. `detail` never holds manuscript text. */
export interface ManuscriptProblem extends Position { path: string; code: ProblemCode; detail: string }

export interface Locator { label: string; value: string }

export interface Citation extends Position {
  /** A citation key, or `?` for an unbound occurrence. */
  key: string;
  /** The `citation` record an occurrence from takeover links to. */
  id?: string;
  locator?: Locator;
  prefix?: string;
  suffix?: string;
  mode?: "suppress-author" | "author-only";
  /** The sentence it belongs to, as an index into the chapter's sentences. */
  sentence: number;
  /** Its place among equal occurrences (key and locator) in that sentence, from 0. */
  ordinal: number;
}

export interface Sentence extends Position {
  /** Plain text without citations or marker syntax, normalized (CONTRACT-001 E). */
  text: string;
  sha256: string;
  block: number;
  /** The footnote label, for a sentence inside a footnote. */
  note?: string;
  /**
   * Citations in reading order. A footnote that holds only citations adds them
   * here, at its marker.
   */
  citations: Citation[];
}

export type BlockKind = "heading" | "paragraph" | "unconverted";

export interface Block extends Position {
  kind: BlockKind;
  /** Heading level 1 to 4. */
  level?: number;
  /** A heading's `#sec-id`, or an unconverted block's intake item. */
  id?: string;
  quoted: boolean;
  list: boolean;
  note?: string;
  /** Plain text. For an unconverted block, its lines as written. */
  text: string;
}

export interface Quotation extends Position {
  form: "marked" | "block" | "double";
  /** The quoted words, without surrounding quotation marks. */
  text: string;
  sentence?: number;
  /** The citation it quotes. Absent when it cannot be told. */
  citation?: Citation;
}

export interface ClaimSpan extends Position { ids: string[]; text: string; citations: Citation[] }

export interface NeedsSource extends Position {
  text: string;
  /** A citation with a bound key and a locator is in the passage or in its sentence (`draft.marked`). */
  sourced: boolean;
}

export interface Passage extends Position { text: string }

export interface Chapter {
  path: string;
  id: string;
  blocks: Block[];
  sentences: Sentence[];
  citations: Citation[];
  quotations: Quotation[];
  claims: ClaimSpan[];
  needsSource: NeedsSource[];
  /** Words marked `.not-quote`; a report lists them. */
  notQuotes: Passage[];
  /** Double quotation marks with no partner, so what they quote was not read. */
  unpairedQuoteMarks: Position[];
}

export interface Manuscript {
  chapters: Chapter[];
  /** A file with a problem gives no chapter: no check over it can run. */
  problems: ManuscriptProblem[];
  /** Files under manuscript/ that are not chapter files, so nothing in them was read. */
  unread: string[];
}

export class Refusal extends Error {
  constructor(readonly code: ProblemCode, readonly detail: string, readonly at: Position) {
    super(`${code}: ${detail}`);
  }
}

export const unsupported = (detail: string, at: Position) => new Refusal("manuscript_unsupported", detail, at);
export const malformed = (detail: string, at: Position) => new Refusal("manuscript_syntax", detail, at);

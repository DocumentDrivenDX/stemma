// The neutral document that the reference-list reader and the author-date
// matcher read. A format reader builds it; no format's own shapes appear here.

export type Location = "body" | "footnote" | "endnote" | "table" | "caption";

export interface Paragraph {
  text: string;
  location: Location;
  /** 1 is the highest level. Only a body paragraph's level counts. A heading is a body paragraph. */
  headingLevel?: number;
  /** For a note, the label that marks it in the text. */
  note?: string;
  /** Where this paragraph's text refers to notes. A reference adds no text. The matcher does not use it. */
  noteRefs?: { at: number; location: "footnote" | "endnote"; note: string }[];
  /** For a paragraph in a table, its table, row, and cell, each counted from 1. The matcher does not use it. */
  table?: { table: number; row: number; cell: number };
}

/** One manuscript file. Paragraphs are in document order, each note after the paragraph that refers to it. */
export interface Document {
  file: string;
  paragraphs: Paragraph[];
}

/** A place in a document: the paragraph's index, and offsets into its text in UTF-16 units. */
export interface Position {
  file: string;
  paragraph: number;
  start: number;
  end: number;
}

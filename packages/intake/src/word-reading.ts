// What the Word reader returns: the neutral document and everything the reader
// reports beside it (CONTRACT-003 F, "The Word reader").
import type { Document } from "./document.ts";

export const WORD_REVISION_VIEW =
  "Insertions and move destinations are applied; deletions, move sources, and deleted table rows and cells are removed; a paragraph whose mark is removed joins the next.";

export const WORD_COVERAGE = [
  "No Word file saved by a named tool and version has been tested with this reader; its Word support is untested.",
  "Reference-manager fields are found and returned as typed, but their embedded reference data is not decoded.",
  "Text boxes, equations, symbols, headers, footers, document properties, charts, diagrams, imported chunks, and elements the reader does not know are reported, not converted.",
  "Images and embedded objects are not read; their names are listed.",
  "Hidden text is read as ordinary text. It is reported where it is set on the text itself, not where only a style hides it.",
  "Headings come from paragraph styles and outline levels, and captions from the Caption style. Other headings and captions are read as body text.",
  "Footnote and endnote labels are counted in order of reference and may differ from the marks Word prints.",
  "Style, numbering, setting, font, theme, and package parts are not examined for text.",
];

/** A place in the file. */
export interface Place {
  part: string;
  /** The element's raw location in its part. */
  path: string;
  /** For a place in a document paragraph: its index, and offsets into its text in UTF-16 units. */
  paragraph?: number;
  start?: number;
  end?: number;
  /** Otherwise, for a place in the document's own flow: the number of paragraphs before it. */
  after?: number;
  /** For a place inside a comment's own text: the comment's ID. */
  comment?: string;
}

export type WordItemKind =
  | "text_box" | "shape_text" | "drawing" | "attribute_text" | "embedded_object" | "imported_chunk" | "equation"
  | "symbol" | "generated_text" | "list_number" | "hidden_text" | "ruby_text" | "placeholder_text" | "alternate_content"
  | "unknown_element" | "unexpected_text"
  | "unreferenced_note" | "missing_note" | "repeated_note_reference" | "unread_note_reference" | "missing_comment"
  | "header" | "footer" | "metadata" | "custom_data" | "chart" | "diagram" | "glossary" | "other_part";

/** Content that is not plain converted text: what it is, what text it holds, and where it is. */
export interface WordItem {
  kind: WordItemKind;
  /** The text it holds, which may be none. Only `hidden_text` is also in a paragraph. */
  text: string;
  place: Place;
  /** An element name, a symbol's font and code, or a relationship target. */
  detail?: string;
}

export type WordFieldKind = "zotero" | "mendeley" | "endnote" | "citavi" | "word_citation" | "word_bibliography" | "other";

export interface WordField {
  kind: WordFieldKind;
  form: "field" | "simple_field" | "content_control" | "bookmark";
  /** The field's instruction, the content control's tag, or the bookmark's name, as stored. */
  instruction: string;
  /** Data the field stores beside its instruction, as stored. */
  data?: string;
  /** Embedded reference data is not decoded by this version of the reader. */
  decoded: false;
  /** Where the visible result starts, or where the field stands when it has none. */
  from: Place;
  to: Place;
}

export interface WordComment {
  id: string;
  author?: string;
  initials?: string;
  date?: string;
  /** The comment's paragraphs, joined by line breaks. */
  text: string;
  /** `range` has a start and an end, `point` only one of them or a mark, `none` no place. */
  anchor: "range" | "point" | "none";
  from?: Place;
  to?: Place;
  /** The text in the range, when the range lies in one document paragraph. */
  anchoredText?: string;
  /** Set when the comment's place is in text the revision view removes. */
  onRemovedText?: true;
}

export type RevisionKind =
  | "insertion" | "deletion" | "move_to" | "move_from" | "paragraph_mark_inserted" | "paragraph_mark_removed"
  | "row_inserted" | "row_deleted" | "cell_inserted" | "cell_deleted" | "cell_merged" | "formatting";

/** One tracked change. Removed text is not carried. */
export interface Revision {
  kind: RevisionKind;
  author?: string;
  date?: string;
  place: Place;
}

export interface PartReport {
  name: string;
  disposition: "read" | "reported" | "not_read" | "support";
}

/** Non-white-space text values in the parts examined, by what became of them. They add up to `values`. */
export interface WordAccount {
  values: number;
  converted: number;
  removed: number;
  reported: number;
  layout: number;
  duplicate: number;
}

export interface WordReading {
  file: string;
  sha256: string;
  size: number;
  support: "untested";
  revisionView: typeof WORD_REVISION_VIEW;
  coverage: string[];
  document: Document;
  comments: WordComment[];
  fields: WordField[];
  revisions: Revision[];
  items: WordItem[];
  parts: PartReport[];
  account: WordAccount;
}

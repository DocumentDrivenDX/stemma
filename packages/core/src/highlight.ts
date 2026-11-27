// A highlight on an original (CONTRACT-005 M, "Highlighting on originals"): what
// the server answers, and the words for each reason it draws nothing. The words
// are fixed: none holds a path or text from a file. This module is in the served
// page too.

/** A box as fractions of the page as drawn, from its top left corner. */
export interface HighlightBox { left: number; top: number; width: number; height: number }

export const NO_HIGHLIGHT = {
  page_image: "A page image holds no word positions, and nothing is recognized in it.",
  no_pdf_page: "The record does not establish that this part is a page of a PDF.",
  no_segment: "There is no highlighted passage on this part of the source text.",
  not_held: "The recorded original is not held, so no position can be read from it.",
  changed: "The file found does not have the recorded SHA-256, so no position is read from it.",
  too_large: "The original is larger than this server reads.",
  unsupported_text: "The quoted words lie in text that was laid out again, such as a table, so their places in the page’s text are not known.",
  hyphen_split: "The quotation joins, begins, or ends at a word split by a hyphen at a line end, so which printed letters it covers is not marked.",
  page_count: "The PDF does not have the recorded number of pages.",
  unreadable: "The page of the PDF could not be read.",
  text_differs: "The text read again from this page is not exactly the source text’s page, as when the text was corrected, typed, or put in another order. So the positions in the PDF cannot be tied to it.",
  rotated_page: "The page is stored rotated.",
  rotated_text: "Quoted words are rotated, skewed, or mirrored.",
  vertical_text: "Quoted words are set vertically.",
  right_to_left: "A quoted line holds right-to-left text, whose order cannot be tied to places with certainty.",
  ligature: "A quoted word holds a ligature, one shape for several letters.",
  unclear_positions: "The places of the quoted letters cannot be told with certainty: what is drawn does not agree, letter for letter, with the page’s text.",
  recognition_layer: "The only positions are those of an invisible text layer over an image, as a scan put through character recognition has. Nothing can check that they lie on the printed words.",
  invisible_text: "The quoted words are in text that is drawn invisibly.",
  hidden_text: "Quoted words may not be seen where the text layer places them: they are drawn in a light or transparent color, too small, without a shape, clipped, or off the page.",
  covered: "Something else is painted over or under quoted words, such as an image, a line, or a colored area, so they may not be seen there.",
  overlapping_text: "Other text is drawn over quoted words, as with a second text layer.",
  symbol_font: "Quoted words are set in a symbol or picture font, such as Symbol or Wingdings, whose shapes need not be the letters the file’s text names.",
  annotation: "An annotation, such as a shape, a note, a stamp, a form field, a link with a drawn border, or a reader’s own highlight, lies where quoted words are. It is not drawn in this page, but another PDF viewer may show it there, over the words.",
  unknown_drawing: "The page is drawn in a way this version does not check, such as with transparency groups, masks, optional content, or fonts drawn as pictures.",
  too_much: "The page or the quotation is larger than this version places.",
  too_slow: "Reading the page took too long.",
  too_much_memory: "Reading the page was stopped: it took more memory than this server allows, as images that unpack far larger than the file can, or the system ended it.",
  busy: "Too many pages are being read at once. Open this again in a moment.",
  failed: "The positions could not be worked out, which may be a Stemma defect.",
  pixels_disagree: "The page as drawn here shows no dark and light marks where the server placed the words.",
  not_asked: "The server could not be asked for the positions.",
} as const;

export type NoHighlightReason = keyof typeof NO_HIGHLIGHT;

export type Highlight =
  | { state: "boxes"; sha256: string; page: number; page_count: number; boxes: HighlightBox[] }
  | { state: "none"; reason: NoHighlightReason; why: string };

export const noHighlight = (reason: NoHighlightReason): Highlight & { state: "none" } => ({ state: "none", reason, why: NO_HIGHLIGHT[reason] });

/** What a page read again must show for boxes to be placed: all of it from the record and its source file. */
export interface HighlightTarget {
  sha256: string;
  size: number;
  /** The page of the PDF, counted from 1, and the recorded number of pages. */
  page: number;
  page_count: number;
  /** SHA-256 of the part's text, every line of every block in file order. */
  text_sha256: string;
  /** Where the quoted words lie in that text, as string offsets. */
  ranges: [number, number][];
}

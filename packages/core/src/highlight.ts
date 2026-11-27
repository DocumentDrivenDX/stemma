// A highlight on an original (CONTRACT-005 M, "Highlighting on originals"): what
// the server answers, how an estimate on a scan was derived, and the words for
// each reason it draws nothing. The words are fixed: none holds a path or text
// from a file. This module is in the served page too.

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
  recognition_layer: "The quoted words are invisible text over a picture, on a page that is not read as a scan, since solid pictures cover too little of it or too much of its text is seen. So no place is estimated.",
  no_text_layer: "The page of the PDF has no text layer, as a scan that has not been put through character recognition has none. Nothing is recognized in it, so no place can be estimated.",
  scan_weak_match: "This page reads as a scan. The quoted words were not found closely enough in its text that is not seen to estimate their place.",
  scan_ambiguous: "This page reads as a scan. More than one place in its text that is not seen could be the quoted words, and the words around them do not settle which.",
  scan_context: "This page reads as a scan. Its text that is not seen has one place like the quoted words, but the words around that place are not those around them in the source text.",
  scan_differs: "This page reads as a scan. The closest place in its text that is not seen differs from the quoted words in a number or in a word of denial, such as “not”, so it may say something else.",
  scan_short: "This page reads as a scan. The quoted words are too short to be looked for in its text that is not seen with confidence.",
  scan_off_page: "This page reads as a scan. Its text that is not seen puts quoted words off the page.",
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

/** How each estimate was derived, said to the reader. */
export const ESTIMATE_METHODS = {
  ocr_layer_offsets: "The boxes are where text that is not seen on the page, as a scan’s recognition text is not, puts the passage’s letters. The page’s text, read again, is exactly the source text’s page.",
  ocr_layer_match: "The passage’s recorded places could not be used on this page, so the quoted words were looked for in text that is not seen on it, as a scan’s recognition text is not, allowing for some wrong letters. The boxes are where that text puts the place found.",
} as const;

export type EstimateMethod = keyof typeof ESTIMATE_METHODS;

interface Boxed { sha256: string; page: number; page_count: number; boxes: HighlightBox[] }

export type Highlight =
  | ({ state: "boxes" } & Boxed)
  /** A place on a scan that nothing checks against the picture. It is never shown as a highlight. */
  | ({ state: "estimate"; method: EstimateMethod } & Boxed)
  | { state: "none"; reason: NoHighlightReason; why: string };

/** The quoted words and what stands before and after them in the source text, to look for them where its page cannot be matched exactly. */
export interface HighlightWords { quoted: string; before: string; after: string }

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
  /** Where the quoted words lie in that text, as string offsets. None where they are not known. */
  ranges: [number, number][];
  /** Why no highlight can be placed, whatever the page shows. An estimate on a scan still can be. */
  refused?: "hyphen_split" | "unsupported_text";
  words?: HighlightWords;
}

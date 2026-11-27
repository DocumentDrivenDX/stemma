// Which page of an original a part of a source file is (CONTRACT-007 C), from
// the record alone. Nothing is worked out from text, labels, names or order: a
// page shown for the wrong words would mislead, so every doubt gives no page.
import { type Corpus, isObject, isRetired } from "@stemma/records";

/** The types of original the served explorer draws. TIFF is not converted, so it is not one. */
export const DRAWN_TYPES = ["application/pdf", "image/png", "image/jpeg"];
/** The largest original the local server gives (CONTRACT-005 M, rule 13). */
export const MOST_ORIGINAL_BYTES = 256 * 1024 * 1024;

export interface OriginalFile { sha256: string; size: number; media_type: string; index?: number }

/** What the rule reads of one source file. */
export interface TextOriginal {
  form: string;
  paged: boolean;
  page_count?: number;
  files: OriginalFile[];
  /** The indexes of the source file's parts. */
  parts: number[];
}

export type NoPage = "physical" | "unsupported_type" | "no_page_mapping";

export type OriginalPage =
  | { state: "pdf"; sha256: string; size: number; page: number; page_count: number }
  | { state: "image"; sha256: string; size: number; media_type: string }
  | { state: "none"; reason: NoPage; why: string };

const whole = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

/** The ties of every source file in effect that can be used, by its ID. */
export function textOriginals(corpus: Corpus): Record<string, TextOriginal> {
  const found: Record<string, TextOriginal> = {};
  for (const [id, text] of corpus.texts) {
    const data = text.manifest.data;
    if (!data || !text.usable || isRetired(data) || !isObject(data.original)) continue;
    const original = data.original;
    const files = (Array.isArray(original.files) ? original.files : []).filter(isObject).flatMap((f): OriginalFile[] => (
      typeof f.sha256 === "string" && /^[0-9a-f]{64}$/.test(f.sha256) && whole(f.size) && typeof f.media_type === "string"
        ? [{ sha256: f.sha256, size: f.size, media_type: f.media_type, ...(whole(f.index) ? { index: f.index } : {}) }] : []));
    // A file entry that cannot be read leaves the others' places in doubt.
    const entire = Array.isArray(original.files) && files.length === original.files.length;
    found[id] = {
      form: String(original.form), paged: data.paged === true,
      ...(whole(original.page_count) ? { page_count: original.page_count } : {}),
      files: entire ? files : [],
      parts: (Array.isArray(data.pages) ? data.pages : []).filter(isObject).map((p) => Number(p.index)),
    };
  }
  return found;
}

const none = (reason: NoPage, why: string): OriginalPage => ({ state: "none", reason, why });
const unmapped = (why: string): OriginalPage => none("no_page_mapping", why);

/** The page of the original that the part with this index is, when the record establishes one. */
export function originalPage(text: TextOriginal, index: number): OriginalPage {
  if (text.form === "physical") return none("physical", "The original is recorded as paper or another physical object, so there is no file to show.");
  if (!text.files.some((f) => DRAWN_TYPES.includes(f.media_type))) {
    const types = [...new Set(text.files.map((f) => f.media_type))];
    if (types.length === 0) return unmapped("The source file records no original file that can be read.");
    return none("unsupported_type", `Only PDF originals and PNG or JPEG page images are shown, and the original is recorded as ${types.join(", ")}.${types.includes("image/tiff") ? " A TIFF image is not converted." : ""}`);
  }
  if (!text.paged) return unmapped("This source text has no pages, so no part of it is tied to a page of the original.");
  if (!text.parts.includes(index)) return unmapped("The source file lists no part with this index.");
  if (text.form === "file") {
    const [file] = text.files;
    if (text.files.length !== 1 || file!.media_type !== "application/pdf") return unmapped("The source file ties its text to more than one file, so it does not say which of them holds this page.");
    if (text.page_count === undefined) return unmapped("The source file records no page count for the PDF, as happens when its text was supplied as a transcription. So nothing shows that the numbers of its pages count the PDF's pages.");
    if (text.parts.some((part) => !(part >= 0 && part < text.page_count!))) return unmapped("The source file lists a page that is past the PDF's recorded page count, so its page numbers are not the PDF's.");
    return { state: "pdf", sha256: file!.sha256, size: file!.size, page: index + 1, page_count: text.page_count };
  }
  if (text.form === "page_images") {
    const named = new Map<number, OriginalFile[]>();
    for (const file of text.files) if (file.index !== undefined) named.set(file.index, [...(named.get(file.index) ?? []), file]);
    if (!text.parts.every((part) => named.get(part)?.length === 1)) {
      return unmapped("Not every page of the text has exactly one page image with its number, so the numbers of the images and of the text may not be the same numbers.");
    }
    const file = named.get(index)![0]!;
    if (!DRAWN_TYPES.includes(file.media_type) || file.media_type === "application/pdf") {
      return none("unsupported_type", `Only PNG and JPEG page images are shown, and this page's image is recorded as ${file.media_type}.${file.media_type === "image/tiff" ? " A TIFF image is not converted." : ""}`);
    }
    return { state: "image", sha256: file.sha256, size: file.size, media_type: file.media_type };
  }
  return unmapped("The source file records an original of a form this version does not know.");
}

export interface Recorded { size: number; media_type: string }

/** Each digest a source file records among its originals, with what is recorded of it. */
export function recordedOriginals(texts: Record<string, TextOriginal>): Map<string, Recorded> {
  const found = new Map<string, Recorded>();
  for (const text of Object.values(texts)) {
    for (const file of text.files) {
      // Where two source files record one digest differently, the one that can be shown stands.
      if (!found.has(file.sha256) || DRAWN_TYPES.includes(file.media_type)) found.set(file.sha256, { size: file.size, media_type: file.media_type });
    }
  }
  return found;
}

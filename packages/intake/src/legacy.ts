// What the three library codecs share: the parsed form, faults with their lines,
// and the limits on untrusted input (CONTRACT-003 B, C, G; SD-003).

export type LegacyFormat = "csl_json" | "biblatex" | "ris";

/** Raised when a codec's mapping or preserved form changes (CONTRACT-003, Versioning). */
export const CODEC_VERSION = "1";

export interface Limits {
  fileBytes: number;
  entries: number;
  depth: number;
  fieldBytes: number;
  /** All preserved values and macro values of one file, after expansion, in UTF-16 units. */
  expandedUnits: number;
  /** Faults listed from one file before the codec stops looking. */
  faults: number;
}

export const LEGACY_LIMITS: Readonly<Limits> = {
  fileBytes: 100 * 1024 * 1024,
  entries: 100_000,
  depth: 64,
  fieldBytes: 1024 * 1024,
  expandedUnits: 100 * 1024 * 1024,
  faults: 100,
};

export interface ParsedField {
  /** The native field name, tag, or member name, as written. */
  name: string;
  value: string;
  encoding: "text" | "json" | "tex" | "raw";
  /** The line the field starts on. */
  line: number;
}

export interface ParsedEntry {
  /** Position among the file's entries, from 0. */
  ordinal: number;
  line: number;
  key?: string;
  type?: string;
  /** The entry's own source text, exactly. */
  text: string;
  fields: ParsedField[];
}

export interface ParsedBlock {
  kind: "comment" | "preamble" | "string_definition" | "header" | "other";
  text: string;
  /** For a string definition, the name it defines, in lowercase. */
  name?: string;
}

/** A fault or a note. It names a place and never repeats a field's value. */
export interface Issue {
  code: string;
  line: number;
  /** The entry's native key, when one was read. */
  entry?: string;
  /** The field, tag, member, or macro name concerned. */
  name?: string;
  detail: string;
}

export interface Parsed {
  entries: ParsedEntry[];
  blocks: ParsedBlock[];
  /** Any fault means the file is not imported. */
  faults: Issue[];
  notes: Issue[];
  /** Entries accounted for: those read and those a fault stopped. */
  seen: number;
  /** For RIS, the variant detected. */
  variant?: string;
}

export class LimitExceeded extends Error {
  constructor(readonly limit: keyof Limits, readonly line: number) {
    super(`input_limit: ${limit} at line ${line}`);
  }
}

export const emptyParsed = (): Parsed => ({ entries: [], blocks: [], faults: [], notes: [], seen: 0 });

/** A function from an offset in `text` to its line, counting from 1. CR, LF, and CRLF end lines. */
export function lineFinder(text: string): (offset: number) => number {
  const starts = [0];
  const end = /\r\n|\r|\n/g;
  for (let m = end.exec(text); m; m = end.exec(text)) starts.push(m.index + m[0].length);
  return (offset) => {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (starts[middle]! <= offset) low = middle;
      else high = middle - 1;
    }
    return low + 1;
  };
}

/** A local absolute path, at the start of a value or of one part of a `file` field. */
const POSIX_PATH = /(?:^|[:;{="])[ \t]*(?:file:\/\/|~\/|\/(?:Users|home|Volumes|private|var|tmp|mnt|media)\/)/;
/** A drive letter alone before its colon, which may be escaped, then a slash or backslashes. */
const DRIVE_PATH = /(?:^|[:;{="])[ \t]*[A-Za-z]\\{0,2}:(?:\\{1,4}(?=[^\\])|\/(?!\/))/;
export const looksLocal = (value: string): boolean => POSIX_PATH.test(value) || DRIVE_PATH.test(value);

export const tooLong = (value: string, limits: Limits): boolean =>
  value.length > limits.fieldBytes || (value.length * 3 > limits.fieldBytes && Buffer.byteLength(value) > limits.fieldBytes);

export function checkField(value: string, line: number, limits: Limits): void {
  if (tooLong(value, limits)) throw new LimitExceeded("fieldBytes", line);
}

/** The text of UTF-8 bytes without a byte-order mark, or the line of the first bytes that are not UTF-8. */
export function decodeText(bytes: Uint8Array): { text: string } | { badLine: number } {
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  try {
    const text = decoder.decode(bytes);
    return { text: text.charCodeAt(0) === 0xfeff ? text.slice(1) : text };
  } catch {
    // A line feed is never part of a multi-byte sequence, so lines decode separately.
    let line = 1;
    let start = 0;
    for (let i = 0; i <= bytes.length; i++) {
      if (i < bytes.length && bytes[i] !== 10) continue;
      try {
        decoder.decode(bytes.subarray(start, i));
      } catch {
        return { badLine: line };
      }
      start = i + 1;
      line++;
    }
    return { badLine: line };
  }
}

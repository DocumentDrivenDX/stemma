// The BibLaTeX reader (CONTRACT-003 C). It expands only `@string` substitution.
// Values stay TeX source; nothing is run and no file or address in them is opened.
import { checkField, emptyParsed, type Issue, LEGACY_LIMITS, LimitExceeded, type Limits, lineFinder, type Parsed, type ParsedField } from "./legacy.ts";

export const MONTH_MACROS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const OPENING = /@[ \t\r\n]*([A-Za-z]+)[ \t\r\n]*([{(])/y;
const WORD_AFTER_AT = /@[ \t]*[A-Za-z]+/y;
/** A line that starts an entry: where reading resumes after a fault. */
const ENTRY_LINE = /(?:^|[\r\n])[ \t]*(?=@[A-Za-z]+[ \t]*[{(])/g;
const ENTRY_INSIDE = /[\r\n][ \t]*@[A-Za-z]+[ \t]*\{[^\r\n{}=,]*,/;
const LEFTOVER_FIELD = /(?:^|[\r\n])[ \t]*(?:,[ \t]*)?[A-Za-z][\w-]*[ \t]*=[ \t]*[{"\d]/;
const NAME = /[^\s=,{}()"#%@]+/y;
const WORD = /[^\s,{}()"#%=]+/y;

/**
 * `text` without the space BibTeX knows at its ends. Other characters that
 * Unicode calls space are kept. A loop, because a pattern for the end would
 * rescan long inner runs of space.
 */
function trimBlank(text: string): string {
  const blank = (i: number) => " \t\r\n\f".includes(text[i]!);
  let from = 0;
  let to = text.length;
  while (from < to && blank(from)) from++;
  while (to > from && blank(to - 1)) to--;
  return text.slice(from, to);
}

class Fault extends Error {
  constructor(readonly code: string, readonly at: number, readonly detail: string) {
    super(detail);
  }
}

type Part = { literal: string } | { unknown: string };

interface Value {
  value: string;
  encoding: "tex" | "raw";
  unknown: string[];
}

export function parseBiblatex(text: string, limits: Limits = LEGACY_LIMITS): Parsed {
  const result = emptyParsed();
  const lineAt = lineFinder(text);
  /** `@string` names whose value is known. */
  const macros = new Map<string, string>();
  let expanded = 0;
  let at = 0;
  /** Where the entry being read began, for the line of a fault. */
  let opened = 0;

  const note = (code: string, offset: number, detail: string, entry?: string, name?: string) => {
    const issue: Issue = { code, line: lineAt(offset), detail };
    if (entry !== undefined) issue.entry = entry;
    if (name !== undefined) issue.name = name;
    result.notes.push(issue);
  };
  const spend = (units: number) => {
    expanded += units;
    if (expanded > limits.expandedUnits) throw new LimitExceeded("expandedUnits", lineAt(at));
  };
  const match = (pattern: RegExp): RegExpExecArray | null => {
    pattern.lastIndex = at;
    const found = pattern.exec(text);
    if (found) at = pattern.lastIndex;
    return found;
  };
  const endOfLine = (from: number): number => {
    let i = from;
    while (i < text.length && text[i] !== "\n" && text[i] !== "\r") i++;
    return i;
  };
  /** Skip space and `%` comments inside an entry. A comment is kept as file content. */
  const space = () => {
    for (;;) {
      while (at < text.length && " \t\r\n\f".includes(text[at]!)) at++;
      if (text[at] !== "%") return;
      const end = endOfLine(at);
      result.blocks.push({ kind: "comment", text: text.slice(at, end) });
      note("comment_in_entry", at, "A % comment inside an entry is kept as a file comment.");
      at = end;
    }
  };

  /** A group too long to keep: either it was never closed, or a real value is over the limit. */
  const overlong = (start: number): never => {
    if (ENTRY_INSIDE.test(text.slice(start, start + limits.fieldBytes))) {
      throw new Fault("unclosed_brace", start, "A brace or quotation mark opened here is not closed.");
    }
    throw new LimitExceeded("fieldBytes", lineAt(start));
  };
  /**
   * Read from the opening character at `at` to its partner and return what is between.
   * Every brace counts, as BibTeX counts them. A quotation ends outside all braces.
   */
  const group = (close: "}" | '"' | ")"): string => {
    const start = at++;
    let depth = 0;
    for (; at < text.length; at++) {
      if (at - start > limits.fieldBytes) overlong(start);
      const c = text[at]!;
      if (depth === 0 && c === close) return text.slice(start + 1, at++);
      if (c === "{") {
        if (++depth >= limits.depth) throw new LimitExceeded("depth", lineAt(at));
      } else if (c === "}") {
        if (depth === 0) throw new Fault("unbalanced_brace", at, "A closing brace has no opening brace.");
        depth--;
      }
    }
    throw new Fault(close === '"' ? "unclosed_quote" : "unclosed_brace", start,
      close === '"' ? "A quotation mark opened here is not closed." : "A brace opened here is not closed.");
  };

  /** A field value or `@string` value: parts joined by `#`. */
  const value = (): Value => {
    const parts: Part[] = [];
    const start = at;
    let length = 0;
    for (;;) {
      space();
      const c = text[at];
      let part: Part;
      if (c === "{") part = { literal: group("}") };
      else if (c === '"') part = { literal: group('"') };
      else {
        const word = match(WORD)?.[0];
        if (word === undefined) throw new Fault("missing_value", at, "A value is expected here.");
        const known = macros.get(word.toLowerCase());
        part = /^\d+$/.test(word) ? { literal: word } : known !== undefined ? { literal: known } : { unknown: word };
      }
      // Summed before joining, so repeated macros cannot build a huge string.
      length += "literal" in part ? part.literal.length : part.unknown.length;
      if (length > limits.fieldBytes) throw new LimitExceeded("fieldBytes", lineAt(start));
      parts.push(part);
      space();
      if (text[at] !== "#") break;
      at++;
    }
    const unknown = parts.flatMap((p) => ("unknown" in p ? [p.unknown] : []));
    const joined = unknown.length === 0
      ? parts.map((p) => (p as { literal: string }).literal).join("")
      : parts.map((p) => ("unknown" in p ? p.unknown : `{${p.literal}}`)).join(" # ");
    checkField(joined, lineAt(start), limits);
    spend(joined.length);
    return { value: joined, encoding: unknown.length === 0 ? "tex" : "raw", unknown };
  };

  const noteUnknown = (read: Value, offset: number, entry?: string) => {
    for (const name of read.unknown) {
      if (!MONTH_MACROS.includes(name.toLowerCase())) {
        note("undefined_macro", offset, "A macro is used with no @string definition before it. The value is kept as written and not mapped.", entry, name);
      }
    }
  };

  const expect = (close: string, code: string, detail: string) => {
    space();
    if (text[at] !== close) throw new Fault(code, at, detail);
    at++;
  };

  /** Read one `@` construct whose type and opening character have been matched. */
  const construct = (start: number, type: string, open: string) => {
    const close = open === "{" ? "}" : ")";
    const lower = type.toLowerCase();
    if (lower === "comment" || lower === "preamble") {
      at--;
      group(close);
      result.blocks.push({ kind: lower, text: text.slice(start, at) });
      return;
    }
    if (lower === "string") {
      space();
      const name = match(NAME)?.[0];
      if (name === undefined) throw new Fault("bad_string_definition", at, "A name is expected in @string.");
      expect("=", "bad_string_definition", "An = is expected in @string.");
      const read = value();
      noteUnknown(read, start);
      expect(close, "bad_string_definition", "The @string definition is not closed.");
      if (read.encoding === "tex") macros.set(name.toLowerCase(), read.value);
      else macros.delete(name.toLowerCase());
      result.blocks.push({ kind: "string_definition", text: text.slice(start, at), name: name.toLowerCase() });
      return;
    }

    const ordinal = result.seen++;
    if (result.seen > limits.entries) throw new LimitExceeded("entries", lineAt(start));
    space();
    const key = match(open === "{" ? /[^,\s{}"#=%]*/y : /[^,\s{}()"#=%]*/y)![0];
    space();
    if (key === "" || text[at] === "=") throw new Fault("missing_key", at, "The entry has no key.");
    checkField(key, lineAt(start), limits);
    const fields: ParsedField[] = [];
    const names = new Set<string>();
    try {
      for (;;) {
        space();
        if (text[at] === close) break;
        if (at >= text.length) throw new Fault("unclosed_entry", start, "The entry is not closed.");
        if (text[at] !== ",") throw new Fault("missing_comma", at, "A comma or the end of the entry is expected.");
        at++;
        space();
        if (text[at] === close) break;
        if (at >= text.length) throw new Fault("unclosed_entry", start, "The entry is not closed.");
        const offset = at;
        const name = match(NAME)?.[0];
        if (name === undefined) throw new Fault("missing_field_name", at, "A field name is expected.");
        checkField(name, lineAt(offset), limits);
        expect("=", "missing_equals", "An = is expected after a field name.");
        const read = value();
        noteUnknown(read, offset, key);
        if (ENTRY_INSIDE.test(read.value)) {
          note("entry_start_inside_value", offset, "A value holds a line that looks like the start of an entry. Check that no brace is missing.", key, name);
        }
        if (names.has(name.toLowerCase())) note("repeated_field", offset, "A field is repeated. Every value is kept.", key, name);
        names.add(name.toLowerCase());
        fields.push({ name, value: read.value, encoding: read.encoding, line: lineAt(offset) });
      }
    } catch (error) {
      if (error instanceof Fault) throw Object.assign(error, { key });
      throw error;
    }
    at++;
    result.entries.push({ ordinal, line: lineAt(start), key, type, text: text.slice(start, at), fields });
  };

  /** Text between entries is a comment. */
  let freeStart = 0;
  const flush = (end: number) => {
    const comment = trimBlank(text.slice(freeStart, end));
    if (comment === "") return;
    result.blocks.push({ kind: "comment", text: comment });
    if (LEFTOVER_FIELD.test(comment)) {
      note("text_like_a_field", text.indexOf(comment, freeStart), "Text between entries looks like a field. Check that no entry was closed too early.");
    }
  };

  const next = /[@%]/g;
  for (;;) {
    next.lastIndex = at;
    const found = next.exec(text);
    if (!found) break;
    opened = found.index;
    if (found[0] === "%") {
      at = endOfLine(opened);
      continue;
    }
    at = opened;
    const opening = match(OPENING);
    if (!opening) {
      let before = opened - 1;
      while (before >= 0 && (text[before] === " " || text[before] === "\t")) before--;
      WORD_AFTER_AT.lastIndex = opened;
      if ((before < 0 || text[before] === "\n" || text[before] === "\r") && WORD_AFTER_AT.test(text)) {
        result.seen++;
        result.faults.push({ code: "missing_opening", line: lineAt(opened), detail: "A line starts with @ and a word, with no { or ( after it." });
      }
      at = opened + 1;
      continue;
    }
    flush(opened);
    const before = result.seen;
    try {
      construct(opened, opening[1]!, opening[2]!);
    } catch (error) {
      if (!(error instanceof Fault)) throw error;
      if (result.seen === before) result.seen++;
      const key = (error as Fault & { key?: string }).key;
      const where = lineAt(error.at);
      const issue: Issue = {
        code: error.code,
        line: lineAt(opened),
        detail: where === lineAt(opened) ? error.detail : `${error.detail} Noticed at line ${where}.`,
      };
      if (key !== undefined) issue.entry = key;
      result.faults.push(issue);
      ENTRY_LINE.lastIndex = opened + 1;
      const resume = ENTRY_LINE.exec(text);
      at = resume ? resume.index + resume[0].length : text.length;
    }
    freeStart = at;
    if (result.faults.length >= limits.faults) break;
  }
  flush(text.length);
  return result;
}

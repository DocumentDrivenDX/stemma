// The CSL-JSON reader (CONTRACT-003 C). It has its own JSON parser because each
// member's source text, with its number text, must be kept, and every fault
// needs its line.
import { checkField, emptyParsed, type Issue, LEGACY_LIMITS, LimitExceeded, type Limits, lineFinder, type Parsed, type ParsedField } from "./legacy.ts";

const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const LONE_SURROGATE = /\p{Surrogate}/u;

class Syntax extends Error {
  constructor(readonly at: number, readonly detail: string) {
    super(detail);
  }
}

export function parseCslJson(text: string, limits: Limits = LEGACY_LIMITS): Parsed {
  const result = emptyParsed();
  const lineAt = lineFinder(text);
  let at = 0;
  let key: string | undefined;

  const fault = (code: string, offset: number, detail: string, name?: string, entry = key) => {
    if (result.faults.length >= limits.faults) return;
    const issue: Issue = { code, line: lineAt(offset), detail };
    if (entry !== undefined) issue.entry = entry;
    if (name !== undefined) issue.name = name;
    result.faults.push(issue);
  };
  const space = () => {
    while (at < text.length && " \t\n\r".includes(text[at]!)) at++;
  };
  const take = (expected: string) => {
    space();
    if (text[at] !== expected) throw new Syntax(at, `${expected} is expected.`);
    at++;
  };
  /** Take the next character if it is `wanted`. */
  const has = (wanted: string): boolean => {
    space();
    if (text[at] !== wanted) return false;
    at++;
    return true;
  };
  const string = (): string => {
    space();
    if (text[at] !== '"') throw new Syntax(at, "A string is expected.");
    const start = at++;
    while (at < text.length && text[at] !== '"') at += text[at] === "\\" ? 2 : 1;
    if (text[at] !== '"') throw new Syntax(start, "A string is not closed.");
    at++;
    try {
      const decoded = JSON.parse(text.slice(start, at)) as string;
      if (LONE_SURROGATE.test(decoded)) fault("lone_surrogate", start, "A string holds half of a surrogate pair.");
      return decoded;
    } catch {
      throw new Syntax(start, "A string holds a character or escape that JSON does not allow.");
    }
  };
  /** Check one value and move past it. Duplicate member names are faults. */
  const skip = (depth: number): void => {
    space();
    const first = text[at];
    if (first === '"') {
      string();
    } else if (first === "{" || first === "[") {
      if (depth >= limits.depth) throw new LimitExceeded("depth", lineAt(at));
      at++;
      const close = first === "{" ? "}" : "]";
      if (has(close)) return;
      const names = new Set<string>();
      for (;;) {
        if (first === "{") {
          space();
          const offset = at;
          const name = string();
          if (names.has(name)) fault("duplicate_member", offset, "A member name is repeated in one object.", name);
          names.add(name);
          take(":");
        }
        skip(depth + 1);
        if (has(close)) return;
        take(",");
      }
    } else {
      for (const word of ["true", "false", "null"]) {
        if (text.startsWith(word, at)) {
          at += word.length;
          return;
        }
      }
      NUMBER.lastIndex = at;
      if (!NUMBER.test(text)) throw new Syntax(at, "A value is expected.");
      at = NUMBER.lastIndex;
    }
  };

  const item = () => {
    space();
    const start = at;
    key = undefined;
    if (result.seen >= limits.entries) throw new LimitExceeded("entries", lineAt(start));
    const ordinal = result.seen++;
    if (text[at] !== "{") {
      fault("not_an_item", start, "Each member of the array must be an object.");
      skip(1);
      return;
    }
    at++;
    const fields: ParsedField[] = [];
    const names = new Set<string>();
    let type: string | undefined;
    const faultsBefore = result.faults.length;
    if (!has("}")) {
      for (;;) {
        space();
        const offset = at;
        const name = string();
        checkField(name, lineAt(offset), limits);
        if (names.has(name)) fault("duplicate_member", offset, "A member name is repeated in one object.", name);
        names.add(name);
        take(":");
        space();
        const from = at;
        skip(2);
        const value = text.slice(from, at);
        checkField(value, lineAt(offset), limits);
        fields.push({ name, value, encoding: "json", line: lineAt(offset) });
        if (name === "id" || name === "type") {
          const scalar = JSON.parse(value) as unknown;
          if (name === "type" && typeof scalar === "string") type = scalar;
          if (name === "id" && (typeof scalar === "string" || typeof scalar === "number")) {
            // A number keeps its own text.
            key = typeof scalar === "string" ? scalar : value;
          }
        }
        if (has("}")) break;
        take(",");
      }
    }
    // The key may follow the member at fault.
    if (key !== undefined) for (const f of result.faults.slice(faultsBefore)) f.entry = key;
    if (result.faults.length > faultsBefore) return;
    if (type === undefined) result.notes.push({ code: "no_type", line: lineAt(start), detail: "The item names no type.", ...(key === undefined ? {} : { entry: key }) });
    result.entries.push({
      ordinal, line: lineAt(start), text: text.slice(start, at), fields,
      ...(key === undefined ? {} : { key }), ...(type === undefined ? {} : { type }),
    });
  };

  try {
    if (!has("[")) {
      fault("not_an_array", at, "A CSL-JSON library is an array of items.");
      return result;
    }
    if (!has("]")) {
      for (;;) {
        item();
        if (has("]")) break;
        take(",");
      }
    }
    key = undefined;
    space();
    if (at !== text.length) fault("trailing_text", at, "Text follows the array.");
  } catch (error) {
    if (!(error instanceof Syntax)) throw error;
    // JSON gives no safe place to resume, so reading stops here.
    fault("json_syntax", error.at, `${error.detail} Items after this point were not read.`);
  }
  return result;
}

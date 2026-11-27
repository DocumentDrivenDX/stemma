// Strict JSON reading and the canonical form of CONTRACT-001 D.
import { createHash } from "node:crypto";

export type Json = null | boolean | number | string | Json[] | JsonObject;
export interface JsonObject { [key: string]: Json }

export interface ParseResult {
  value: Json;
  /** Values the canonical form forbids (D4, D5). Rewriting would change them. */
  forbidden: { field: string; problem: "null_value" | "number_not_integer" }[];
}

export class JsonUnreadable extends Error {
  constructor(readonly problem: "syntax" | "duplicate_key" | "lone_surrogate" | "too_deep" | "not_utf8") {
    super(problem);
  }
}

export function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new JsonUnreadable("not_utf8");
  }
}

const MAX_DEPTH = 100;
const LONE_SURROGATE = /\p{Surrogate}/u;

export function emptyObject(): JsonObject {
  // No prototype: a key such as "__proto__" stays an ordinary key.
  return Object.create(null) as JsonObject;
}

export function parseJson(text: string): ParseResult {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const forbidden: ParseResult["forbidden"] = [];
  let at = 0;
  const fail = (problem: JsonUnreadable["problem"] = "syntax"): never => {
    throw new JsonUnreadable(problem);
  };
  const space = () => {
    while (at < source.length && " \t\n\r".includes(source[at]!)) at++;
  };
  const string = (): string => {
    const start = at++;
    while (at < source.length && source[at] !== '"') at += source[at] === "\\" ? 2 : 1;
    if (source[at] !== '"') fail();
    at++;
    let decoded: string;
    try {
      decoded = JSON.parse(source.slice(start, at)) as string;
    } catch {
      return fail();
    }
    if (LONE_SURROGATE.test(decoded)) fail("lone_surrogate");
    return decoded;
  };
  const value = (field: string, depth: number): Json => {
    if (depth > MAX_DEPTH) fail("too_deep");
    space();
    const first = source[at];
    if (first === '"') return string();
    if (first === "{" || first === "[") {
      const isObject = first === "{";
      const close = isObject ? "}" : "]";
      const object = emptyObject();
      const array: Json[] = [];
      at++;
      space();
      if (source[at] === close) {
        at++;
        return isObject ? object : array;
      }
      for (;;) {
        if (isObject) {
          space();
          if (source[at] !== '"') fail();
          const key = string();
          if (Object.hasOwn(object, key)) fail("duplicate_key");
          space();
          if (source[at++] !== ":") fail();
          object[key] = value(`${field}/${key}`, depth + 1);
        } else array.push(value(`${field}/${array.length}`, depth + 1));
        space();
        const next = source[at++];
        if (next === close) return isObject ? object : array;
        if (next !== ",") fail();
      }
    }
    for (const [word, literal] of [["true", true], ["false", false], ["null", null]] as const) {
      if (source.startsWith(word, at)) {
        at += word.length;
        if (literal === null) forbidden.push({ field, problem: "null_value" });
        return literal;
      }
    }
    const number = /-?(?:0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/y;
    number.lastIndex = at;
    const match = number.exec(source) ?? fail();
    at += match[0].length;
    const parsed = Number(match[0]);
    if (match[1] || match[2] || !Number.isSafeInteger(parsed)) forbidden.push({ field, problem: "number_not_integer" });
    return parsed;
  };
  const result = value("", 0);
  space();
  if (at !== source.length) fail();
  return { value: result, forbidden };
}

export function compareCodePoints(a: string, b: string): number {
  // No arrays are made: this runs for every key of every record written.
  let i = 0;
  for (; i < a.length && i < b.length; ) {
    const left = a.codePointAt(i)!;
    const difference = left - b.codePointAt(i)!;
    if (difference !== 0) return difference;
    i += left > 0xffff ? 2 : 1;
  }
  // What is left of the longer one, in code points.
  const points = (text: string) => { let n = 0; for (let at = i; at < text.length; at += text.codePointAt(at)! > 0xffff ? 2 : 1) n++; return n; };
  return points(a) - points(b);
}

/** Fields whose exact code points are kept (CONTRACT-001 D). */
const EXACT_STRINGS = /^\/legacy\/\d+\/(entry_text|fields\/\d+\/value)$|^\/blocks\/\d+\/text$/;

function write(value: unknown, indent: string, field: string): string {
  if (typeof value === "string") {
    return JSON.stringify(EXACT_STRINGS.test(field) ? value : value.replace(/\r\n?/g, "\n"));
  }
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((item, i) => inner + write(item, inner, `${field}/${i}`));
    return `[\n${items.join(",\n")}\n${indent}]`;
  }
  const object = value as Record<string, unknown>;
  const keys = Object.keys(object).filter((k) => object[k] !== undefined).sort(compareCodePoints);
  if (keys.length === 0) return "{}";
  const entries = keys.map((k) => `${inner}${JSON.stringify(k)}: ${write(object[k], inner, `${field}/${k}`)}`);
  return `{\n${entries.join(",\n")}\n${indent}}`;
}

export function canonical(value: unknown): string {
  return `${write(value, "", "")}\n`;
}

export function sha256(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

export function digest(value: unknown): string {
  return sha256(canonical(value));
}

/** The stored sentence form of CONTRACT-001 E. */
export function normalizeSentence(text: string): string {
  return text.replace(/\p{White_Space}+/gu, " ").replace(/^ | $/g, "");
}

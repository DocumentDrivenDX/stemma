// Attributes, `{ .class #id name="value" }` (CONTRACT-006 B), and citation
// clusters (C). An unknown class or attribute is refused.
import { isRecordId } from "@stemma/records";
import { type Citation, malformed, type Position, unsupported } from "./model.ts";

export interface Attributes { classes: string[]; ids: string[]; values: Map<string, string> }

const NAME = /^[A-Za-z][A-Za-z0-9-]*/;

/** `name="value"`, where the value escapes `"` and `\` with `\`. */
function quotedValue(text: string, from: number, at: Position): { value: string; end: number } {
  if (text[from] !== '"') throw malformed("an attribute value must be in double quotes", at);
  let value = "";
  for (let i = from + 1; i < text.length; i++) {
    if (text[i] === "\\" && (text[i + 1] === '"' || text[i + 1] === "\\")) value += text[++i];
    else if (text[i] === '"') return { value, end: i + 1 };
    else value += text[i];
  }
  throw malformed("an attribute value is not closed", at);
}

const space = (text: string, i: number) => i + /^\s*/.exec(text.slice(i))![0].length;

/** Reads from the `{` at `from`; `end` is the index after the `}`. */
export function readAttributes(text: string, from: number, at: Position): { attributes: Attributes; end: number } {
  const attributes: Attributes = { classes: [], ids: [], values: new Map() };
  let i = space(text, from + 1);
  while (i < text.length && text[i] !== "}") {
    const first = text[i]!;
    if (first === "." || first === "#") {
      const word = /^[^\s{}".#]+/.exec(text.slice(i + 1))?.[0];
      if (!word) throw malformed("an empty class or ID", at);
      (first === "." ? attributes.classes : attributes.ids).push(word);
      i += 1 + word.length;
    } else {
      const name = NAME.exec(text.slice(i))?.[0];
      if (!name || text[i + name.length] !== "=") throw malformed("attributes are `.class`, `#id` or `name=\"value\"`", at);
      if (attributes.values.has(name)) throw malformed("an attribute is given twice", at);
      const read = quotedValue(text, i + name.length + 1, at);
      attributes.values.set(name, read.value);
      i = read.end;
    }
    if (i < text.length && !/[\s}]/.test(text[i]!)) throw malformed("attributes must be separated by spaces", at);
    i = space(text, i);
  }
  if (text[i] !== "}") throw malformed("attributes are not closed", at);
  if (attributes.classes.length === 0 && attributes.ids.length === 0 && attributes.values.size === 0) {
    throw malformed("empty attributes", at);
  }
  return { attributes, end: i + 1 };
}

export type Mark = "quote" | "claim" | "needs-source" | "not-quote";

export interface SpanAttributes { mark?: Mark; claims?: string[]; cite?: number; language: boolean }

const MARKS: Record<string, string[]> = { quote: ["cite"], claim: ["ids"], "needs-source": [], "not-quote": [] };

/** What a span, or a block quote's attribute line, may say in this version. */
export function spanAttributes(attributes: Attributes, at: Position): SpanAttributes {
  const [mark, second] = attributes.classes;
  if (attributes.ids.length > 0) throw unsupported("an ID on a span or block quote", at);
  if (second !== undefined) throw unsupported("more than one class", at);
  if (mark !== undefined && !Object.hasOwn(MARKS, mark)) throw unsupported("unknown class", at);
  const allowed = [...(mark ? MARKS[mark]! : []), "lang", "dir"];
  for (const name of attributes.values.keys()) if (!allowed.includes(name)) throw unsupported("unknown attribute", at);
  const dir = attributes.values.get("dir");
  if (dir !== undefined && dir !== "ltr" && dir !== "rtl") throw malformed("dir is ltr or rtl", at);
  const language = attributes.values.has("lang") || dir !== undefined;
  const out: SpanAttributes = { language, ...(mark ? { mark: mark as Mark } : {}) };
  const cite = attributes.values.get("cite");
  if (cite !== undefined) {
    if (!/^[1-9]\d{0,2}$/.test(cite)) throw malformed("cite is the position of a citation, from 1", at);
    out.cite = Number(cite);
  }
  if (mark === "claim") {
    const ids = attributes.values.get("ids")?.split(/\s+/).filter(Boolean) ?? [];
    if (ids.length === 0 || !ids.every((id) => isRecordId("claim", id))) throw malformed("a claim span needs claim record IDs", at);
    out.claims = ids;
  }
  return out;
}

/** The CSL locator terms a citation item may name its locator with. */
export const LOCATOR_TERMS = new Set([
  "act", "appendix", "article-locator", "book", "canon", "chapter", "column", "elocation", "equation", "figure", "folio",
  "issue", "line", "note", "number", "opus", "page", "paragraph", "part", "rule", "scene", "section", "sub-verbo",
  "supplement", "table", "timestamp", "title-locator", "verse", "version", "volume",
]);

const KEY = /^[A-Za-z0-9_](?:[A-Za-z0-9_:.-]{0,126}[A-Za-z0-9_])?/;

export type CitationItem = Omit<Citation, "sentence" | "ordinal" | "line" | "column">;

/** Reads the cluster whose `[` is at `from`; `end` is the index after its `]`. */
export function readCluster(text: string, from: number, at: Position): { items: CitationItem[]; end: number } {
  const items: CitationItem[] = [];
  let i = from + 1;
  for (;;) {
    if (text[i] !== "@") throw malformed("each citation item starts with @", at);
    const key = text[i + 1] === "?" ? "?" : KEY.exec(text.slice(i + 1))?.[0];
    if (!key) throw malformed("a citation key is missing or has characters keys may not have", at);
    i += 1 + key.length;
    const item: CitationItem = { key };
    const seen = new Set<string>();
    for (;;) {
      const next = space(text, i);
      const name = NAME.exec(text.slice(next))?.[0];
      if (!name || next === i) {
        i = next;
        break;
      }
      if (text[next + name.length] !== "=") throw malformed("a citation attribute is `name=\"value\"`", at);
      const { value, end } = quotedValue(text, next + name.length + 1, at);
      i = end;
      if (seen.has(name)) throw malformed("a citation attribute is given twice", at);
      seen.add(name);
      if (LOCATOR_TERMS.has(name)) {
        if (item.locator) throw malformed("a citation item takes one locator", at);
        if (value.trim() === "") throw malformed("a locator is empty", at);
        item.locator = { label: name, value };
      } else if (name === "prefix" || name === "suffix") item[name] = value;
      else if (name === "mode") {
        if (value !== "suppress-author" && value !== "author-only") throw malformed("mode is suppress-author or author-only", at);
        item.mode = value;
      } else if (name === "id") {
        if (!isRecordId("citation", value)) throw malformed("a citation id names a citation record", at);
        item.id = value;
      } else throw unsupported("unknown citation attribute", at);
    }
    if (key === "?" && !item.id) throw malformed("an unbound citation (`@?`) needs the id of its citation record", at);
    items.push(item);
    if (text[i] === "]") return { items, end: i + 1 };
    if (text[i] !== ";") throw malformed("citation items are separated by `;` and the cluster ends with `]`", at);
    i = space(text, i + 1);
  }
}

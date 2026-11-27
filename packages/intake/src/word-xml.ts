// A strict XML reader for the parts of a Word file. It refuses what is not
// well-formed, so a damaged part never reads as a shorter whole one. It reads no
// document type declaration, so no entity is defined and nothing is fetched.
// Namespaces are resolved: a known one gets its usual prefix, whatever prefix
// the file writes.
import { overLimit, unreadable, type WordLimits } from "./word-zip.ts";

/** What became of one text value, for the reader's account. */
export type Disposition = "converted" | "removed" | "reported" | "layout" | "duplicate";

export interface XmlText {
  text: string;
  disposition?: Disposition;
}

export interface XmlElement {
  name: string;
  attrs: Record<string, string>;
  children: (XmlElement | XmlText)[];
  parent?: XmlElement;
  /** Its place among the siblings of the same name, from 1. */
  nth: number;
  /** For `mc:Choice`, the namespaces it requires, as usual prefixes or addresses. */
  requires?: string[];
}

export const isElement = (node: XmlElement | XmlText): node is XmlElement => "name" in node;

const OOXML = "http://schemas.openxmlformats.org/";
const STRICT = "http://purl.oclc.org/ooxml/";
const WORD = "http://schemas.microsoft.com/office/word/";

const NAMESPACES = new Map<string, string>([
  [`${OOXML}wordprocessingml/2006/main`, "w"], [`${STRICT}wordprocessingml/main`, "w"],
  [`${OOXML}officeDocument/2006/relationships`, "r"], [`${STRICT}officeDocument/relationships`, "r"],
  [`${OOXML}markup-compatibility/2006`, "mc"],
  [`${OOXML}drawingml/2006/wordprocessingDrawing`, "wp"], [`${STRICT}drawingml/wordprocessingDrawing`, "wp"],
  [`${OOXML}drawingml/2006/main`, "a"], [`${STRICT}drawingml/main`, "a"],
  [`${OOXML}drawingml/2006/picture`, "pic"], [`${STRICT}drawingml/picture`, "pic"],
  [`${OOXML}officeDocument/2006/math`, "m"], [`${STRICT}officeDocument/math`, "m"],
  [`${OOXML}package/2006/relationships`, "rel"],
  ["urn:schemas-microsoft-com:vml", "v"],
  ["urn:schemas-microsoft-com:office:office", "o"],
  ["urn:schemas-microsoft-com:office:word", "w10"],
  [`${WORD}2010/wordprocessingShape`, "wps"], [`${WORD}2010/wordprocessingGroup`, "wpg"],
  [`${WORD}2010/wordprocessingCanvas`, "wpc"], [`${WORD}2010/wordprocessingInk`, "wpi"],
  [`${WORD}2010/wordprocessingDrawing`, "wp14"], [`${WORD}2010/wordml`, "w14"], [`${WORD}2012/wordml`, "w15"],
]);

/** Elements and attributes whose values are embedded data, with the larger cap. */
const EMBEDDED_TEXT = new Set(["w:instrText", "w:delInstrText", "w:fldData"]);
const embeddedAttribute = (element: string, attribute: string): boolean =>
  attribute === "o:gfxdata" || (element === "w:fldSimple" && attribute === "w:instr") || (element === "w:tag" && attribute === "w:val");

const PREDEFINED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(raw: string): string {
  if (!raw.includes("&")) return raw;
  return raw.replace(/&(?:(amp|lt|gt|quot|apos);|#(\d{1,7});|#x([0-9a-fA-F]{1,6});)?/g, (whole, named?: string, decimal?: string, hex?: string) => {
    if (named) return PREDEFINED[named]!;
    if (whole === "&") return unreadable("a part holds an undefined or unfinished entity reference");
    const code = decimal ? Number(decimal) : parseInt(hex!, 16);
    const allowed = code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) && code !== 0xfffe && code !== 0xffff);
    return allowed ? String.fromCodePoint(code) : unreadable("a part holds a character XML does not allow");
  });
}

/** A part's text: UTF-8, or UTF-16 with a byte order mark. */
export function decodePart(bytes: Uint8Array): string {
  try {
    const utf16 = bytes[0] === 0xff && bytes[1] === 0xfe ? "le" : bytes[0] === 0xfe && bytes[1] === 0xff ? "be" : undefined;
    if (!utf16) return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (bytes.length % 2) throw new Error("odd length");
    const body = Buffer.from(bytes.subarray(2));
    if (utf16 === "be") body.swap16();
    return new TextDecoder("utf-16le", { fatal: true }).decode(body);
  } catch {
    return unreadable("a part is not UTF-8 or UTF-16 text");
  }
}

const NAME = /[^\s/>=<"'&]+/y;
const ATTRIBUTE = /\s+([^\s/>=<"'&]+)\s*=\s*(?:"([^<"]*)"|'([^<']*)')/y;
const TAG_END = /\s*(\/?)>/y;

/** Elements read so far in one file, so that the cap covers all its parts. */
export interface XmlBudget { elements: number }

export function parseXml(bytes: Uint8Array, limits: WordLimits, budget: XmlBudget): XmlElement {
  let source = decodePart(bytes);
  if (source.charCodeAt(0) === 0xfeff) source = source.slice(1);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(source)) unreadable("a part holds a character XML does not allow");
  if (source.includes("\r")) source = source.replace(/\r\n?/g, "\n");
  const broken = (): never => unreadable("a part is not well-formed XML");

  const top: XmlElement = { name: "#document", attrs: {}, children: [], nth: 1 };
  interface Open { element: XmlElement; written: string; scope: Record<string, string>; counts: Map<string, number> }
  const rootScope: Record<string, string> = Object.create(null);
  const stack: Open[] = [{ element: top, written: "", scope: rootScope, counts: new Map() }];
  let rooted = false;
  /** The text node being built, with its size, across comments and CDATA sections. */
  let last: { node: XmlText; bytes: number } | undefined;

  const addText = (text: string) => {
    if (!text) return;
    const { element } = stack.at(-1)!;
    if (stack.length === 1) {
      if (text.trim()) broken();
      return;
    }
    if (!last) {
      last = { node: { text: "" }, bytes: 0 };
      element.children.push(last.node);
    }
    last.node.text += text;
    last.bytes += Buffer.byteLength(text);
    if (last.bytes > (EMBEDDED_TEXT.has(element.name) ? limits.embedded_bytes : limits.text_value_bytes)) overLimit("the size of one text value");
  };

  let at = 0;
  while (at < source.length) {
    const next = source.indexOf("<", at);
    if (next !== at) {
      const raw = source.slice(at, next < 0 ? source.length : next);
      if (raw.includes("]]>")) broken();
      addText(decode(raw));
      at = next < 0 ? source.length : next;
      continue;
    }
    const after = (until: string, from: number): number => {
      const end = source.indexOf(until, from);
      return end < 0 ? broken() : end + until.length;
    };
    if (source.startsWith("<!--", at)) at = after("-->", at + 4);
    else if (source.startsWith("<![CDATA[", at)) {
      const end = after("]]>", at + 9);
      if (stack.length === 1) broken();
      addText(source.slice(at + 9, end - 3));
      at = end;
    } else if (source.startsWith("<!", at)) unreadable("a part has a document type declaration, which is not processed");
    else if (source.startsWith("<?", at)) at = after("?>", at + 2);
    else if (source[at + 1] === "/") {
      NAME.lastIndex = at + 2;
      const written = NAME.exec(source)?.[0];
      const open = stack.pop()!;
      if (stack.length === 0 || written !== open.written) broken();
      TAG_END.lastIndex = at + 2 + written!.length;
      const end = TAG_END.exec(source);
      if (!end || end[1]) broken();
      at = TAG_END.lastIndex;
      last = undefined;
    } else {
      NAME.lastIndex = at + 1;
      const written = NAME.exec(source)?.[0] ?? broken();
      at += 1 + written.length;
      const pairs = new Map<string, string>();
      for (;;) {
        ATTRIBUTE.lastIndex = at;
        const found = ATTRIBUTE.exec(source);
        if (!found) break;
        if (pairs.has(found[1]!)) broken();
        pairs.set(found[1]!, decode((found[2] ?? found[3] ?? "").replace(/[\t\n]/g, " ")));
        at = ATTRIBUTE.lastIndex;
      }
      TAG_END.lastIndex = at;
      const end = TAG_END.exec(source) ?? broken();
      at = TAG_END.lastIndex;

      if (++budget.elements > limits.xml_elements) overLimit("the number of XML elements");
      if (stack.length > limits.xml_depth) overLimit("the XML nesting depth");
      const outer = stack.at(-1)!;
      if (stack.length === 1) {
        if (rooted) broken();
        rooted = true;
      }
      let scope = outer.scope;
      for (const [key, value] of pairs) {
        if (key !== "xmlns" && !key.startsWith("xmlns:")) continue;
        if (scope === outer.scope) scope = Object.create(outer.scope) as Record<string, string>;
        scope[key === "xmlns" ? "" : key.slice(6)] = value;
      }
      const usual = (uri: string): string => NAMESPACES.get(uri) ?? `{${uri}}`;
      /** An undeclared prefix is kept as written. */
      const resolve = (name: string, attribute: boolean): string => {
        const colon = name.indexOf(":");
        const prefix = colon < 0 ? "" : name.slice(0, colon);
        const local = name.slice(colon + 1);
        if (attribute && !prefix) return local;
        const uri = scope[prefix];
        if (!uri) return name;
        const known = usual(uri);
        return known.startsWith("{") ? `${known}${local}` : `${known}:${local}`;
      };
      const name = resolve(written, false);
      const attrs: Record<string, string> = Object.create(null);
      for (const [key, value] of pairs) {
        if (key === "xmlns" || key.startsWith("xmlns:")) continue;
        const resolved = resolve(key, true);
        if (resolved in attrs) broken();
        if (Buffer.byteLength(value) > (embeddedAttribute(name, resolved) ? limits.embedded_bytes : limits.text_value_bytes)) overLimit("the size of one text value");
        attrs[resolved] = value;
      }
      const nth = (outer.counts.get(name) ?? 0) + 1;
      outer.counts.set(name, nth);
      const element: XmlElement = { name, attrs, children: [], parent: outer.element, nth };
      if (name === "mc:Choice") {
        element.requires = (attrs.Requires ?? "").split(/\s+/).filter(Boolean)
          .map((prefix) => (scope[prefix] ? usual(scope[prefix]) : prefix));
      }
      outer.element.children.push(element);
      if (!end[1]) stack.push({ element, written, scope, counts: new Map() });
      last = undefined;
    }
  }
  if (stack.length !== 1 || !rooted) broken();
  return top.children.find(isElement)!;
}

/** Where an element stands in its part, such as `w:body/w:p[3]/w:r[1]`. */
export function pathOf(element: XmlElement): string {
  const steps: string[] = [];
  for (let at: XmlElement | undefined = element; at?.parent; at = at.parent) steps.push(`${at.name}[${at.nth}]`);
  return steps.reverse().join("/");
}

export const childElements = (node: XmlElement): XmlElement[] => node.children.filter(isElement);
export const childNamed = (node: XmlElement | undefined, name: string): XmlElement | undefined =>
  node?.children.find((c): c is XmlElement => isElement(c) && c.name === name);

export function* descendants(node: XmlElement): Generator<XmlElement> {
  for (const child of node.children) {
    if (isElement(child)) {
      yield child;
      yield* descendants(child);
    }
  }
}

export function* textNodes(node: XmlElement): Generator<XmlText> {
  for (const child of node.children) {
    if (isElement(child)) yield* textNodes(child);
    else yield child;
  }
}

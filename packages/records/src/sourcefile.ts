// The source-file format (CONTRACT-007): front matter, blocks, inline
// annotations, escaping, the three text streams, and digests. Source text is
// untrusted data: every "<" in it is escaped, so nothing in it can form an
// annotation.
import { canonical, digest, type Json, type JsonObject, JsonUnreadable, parseJson, sha256 } from "./json.ts";

export const MAIN_ROLES = ["undetermined", "paragraph", "heading", "blockquote", "list-item", "table", "caption"];
export const NOTE_ROLES = ["footnote"];
export const FURNITURE_ROLES = ["running-head", "folio", "boilerplate"];
export const ASIDE_ROLES = ["figure", "note"];
export const BLOCK_ROLES = [...MAIN_ROLES, ...NOTE_ROLES, ...FURNITURE_ROLES, ...ASIDE_ROLES];
/** Blocks that count as a paragraph for a paragraph locator. */
export const PARAGRAPH_ROLES = ["paragraph", "blockquote", "list-item", "table"];

const BLOCK_ATTRIBUTES = ["role", "level", "label", "continued", "column", "by", "basis"] as const;
const INLINE_ATTRIBUTES: Record<string, string[]> = {
  fnref: ["label"], uncertain: ["by", "alt"], corrected: ["was", "by", "basis"],
};

export interface Block {
  role: string;
  level?: string;
  label?: string;
  continued?: string;
  column?: string;
  by?: string;
  basis?: string;
  /** The lines as written: escaped text with inline annotations. */
  content: string;
}

export interface Part { front: JsonObject; blocks: Block[] }

export type FormatProblem =
  | "front_matter_missing" | "front_matter_unreadable" | "text_outside_block" | "unknown_annotation"
  | "unknown_role" | "raw_angle" | "correction_not_by_person";

export interface Located { code: FormatProblem; line: number }

/** A "<" in source text, and an "&" that would read as an escape, are written as entities. */
export const encodeText = (text: string): string => text.replace(/<|&(?=(?:lt|amp);)/g, (c) => (c === "<" ? "&lt;" : "&amp;"));
export const decodeText = (text: string): string => text.replace(/&(lt|amp);/g, (_, name: string) => (name === "lt" ? "<" : "&"));

const encodeValue = (value: string): string =>
  value.replace(/\s*[\r\n]+\s*/g, " ").replace(/[&"<>]/g, (c) => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" })[c]!);
const decodeValue = (value: string): string =>
  value.replace(/&(amp|quot|lt|gt);/g, (_, n: string) => ({ amp: "&", quot: '"', lt: "<", gt: ">" })[n as "amp"]);

const attributes = (names: readonly string[], values: Record<string, string | undefined>): string =>
  names.filter((n) => values[n] !== undefined).map((n) => ` ${n}="${encodeValue(values[n]!)}"`).join("");

export const blockLine = (block: Block): string =>
  `<!-- stemma:block${attributes(BLOCK_ATTRIBUTES, block as unknown as Record<string, string>)} -->`;

/** An inline annotation around text that is already encoded. */
export const inline = (kind: "fnref" | "uncertain" | "corrected", values: Record<string, string>, encoded: string): string =>
  `<!--stemma:${kind}${attributes(INLINE_ATTRIBUTES[kind]!, values)}-->${encoded}<!--/stemma:${kind}-->`;

const INLINE = /<!--stemma:(fnref|uncertain|corrected)((?: [a-z]+="[^"<>\n]*")*)-->([^<]*)<!--\/stemma:\1-->/g;
const BLOCK_LINE = /^<!-- stemma:block((?: [a-z]+="[^"<>\n]*")*) -->$/;

export function parseAttributes(text: string): Record<string, string> {
  const found: Record<string, string> = {};
  for (const [, name, value] of text.matchAll(/ ([a-z]+)="([^"]*)"/g)) found[name!] = decodeValue(value!);
  return found;
}

/** Lines that are empty at either edge are layout, not content. */
export const trimLines = (text: string): string => {
  const trimmed = text.replace(/^(?:[ \t]*\n)+/, "");
  // Read from the end: a pattern anchored there is tried at every line of every part.
  let start = trimmed.length;
  while (start > 0 && " \t\n".includes(trimmed[start - 1]!)) start--;
  const first = trimmed.indexOf("\n", start);
  return first < 0 ? trimmed : trimmed.slice(0, first);
};

/** Parses a body into blocks. `from` is the line number of the body's first line. */
export function parseBlocks(body: string, from = 1): { blocks: Block[]; problems: Located[] } {
  const problems: Located[] = [];
  const blocks: Block[] = [];
  let open: { block: Block; lines: string[]; line: number } | undefined;
  const close = () => {
    if (!open) return;
    open.block.content = trimLines(open.lines.join("\n"));
    let rest = open.block.content;
    for (const match of rest.matchAll(INLINE)) {
      const values = parseAttributes(match[2]!);
      if (Object.keys(values).some((n) => !INLINE_ATTRIBUTES[match[1]!]!.includes(n))) {
        problems.push({ code: "unknown_annotation", line: open.line });
      }
      if (match[1] === "corrected" && !/^person:\S/.test(values.by ?? "")) {
        problems.push({ code: "correction_not_by_person", line: open.line });
      }
    }
    rest = rest.replace(INLINE, "");
    if (rest.includes("<")) {
      problems.push({ code: /<!--\/?stemma/.test(rest) ? "unknown_annotation" : "raw_angle", line: open.line });
    }
    blocks.push(open.block);
    open = undefined;
  };
  body.split("\n").forEach((line, i) => {
    const header = BLOCK_LINE.exec(line);
    if (header) {
      close();
      const values = parseAttributes(header[1]!);
      if (Object.keys(values).some((n) => !(BLOCK_ATTRIBUTES as readonly string[]).includes(n))) {
        problems.push({ code: "unknown_annotation", line: from + i });
      }
      if (!BLOCK_ROLES.includes(values.role ?? "")) problems.push({ code: "unknown_role", line: from + i });
      open = { block: { ...values, role: values.role ?? "", content: "" }, lines: [], line: from + i };
    } else if (open) open.lines.push(line);
    else if (line.trim() !== "") problems.push({ code: "text_outside_block", line: from + i });
  });
  close();
  return { blocks, problems };
}

/** Splits `---`, one JSON object, `---`, and the rest. */
export function splitFrontMatter(text: string): { front: JsonObject; body: string; bodyLine: number } | { problem: FormatProblem; detail?: string } {
  const normal = text.replace(/\r\n/g, "\n");
  if (!normal.startsWith("---\n")) return { problem: "front_matter_missing" };
  const end = normal.indexOf("\n---\n", 3);
  if (end < 0) return { problem: "front_matter_missing" };
  const json = normal.slice(4, end + 1);
  try {
    const { value } = parseJson(json);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return { problem: "front_matter_unreadable" };
    const body = normal.slice(end + 5);
    return { front: value as JsonObject, body, bodyLine: normal.slice(0, end + 5).split("\n").length };
  } catch (error) {
    if (!(error instanceof JsonUnreadable)) throw error;
    return { problem: "front_matter_unreadable", detail: error.problem };
  }
}

export const frontMatter = (front: unknown): string => `---\n${canonical(front)}---\n`;

export function serializePart(front: unknown, blocks: Block[]): string {
  const body = blocks.map((b) => `${blockLine(b)}\n${b.content === "" ? "" : `${trimLines(b.content)}\n`}`).join("\n");
  return `${frontMatter(front)}${body === "" ? "" : `\n${body}`}`;
}

export function serializeManifest(front: unknown, body = ""): string {
  const rest = trimLines(body);
  return `${frontMatter(front)}${rest === "" ? "" : `\n${rest}\n`}`;
}

export interface Streams { main: string; notes: string; furniture: string }

function tableText(content: string): string {
  return content.split("\n")
    .filter((line) => !(line.includes("-") && /^[\s|:-]+$/.test(line)))
    .map((line) => line.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|")).join(" "))
    .join("\n");
}

/**
 * The text of one block as a quotation is compared with it. Footnote markers are
 * left out. `asConverted` gives back the reading a person's correction replaced.
 */
export function blockText(block: Block, asConverted = false): string {
  const plain = block.content.replace(INLINE, (_, kind: string, attrs: string, inner: string) => {
    if (kind === "fnref") return "";
    if (kind === "corrected" && asConverted) return encodeText(parseAttributes(attrs).was ?? "");
    return inner;
  });
  return decodeText(block.role === "table" ? tableText(plain) : plain);
}

/**
 * The streams and digest of the blocks of a part file a project was read with,
 * which nothing changes once read. Each is made once: a check or an export asks
 * for the same part's several times over.
 */
const made = new WeakMap<Block[], Map<string, unknown>>();
export function readBlocks(blocks: Block[]): Block[] {
  made.set(blocks, new Map());
  return blocks;
}

/** What `make` gives for these blocks: once for each `name` if they are blocks a project was read with. */
export function madeOnce<T>(blocks: Block[], name: string, make: () => T): T {
  const kept = made.get(blocks);
  if (!kept) return make();
  if (!kept.has(name)) kept.set(name, make());
  return kept.get(name) as T;
}

export function streamsOf(blocks: Block[], asConverted = false): Streams {
  const make = (): Streams => {
    const of = (roles: string[]) => blocks.filter((b) => roles.includes(b.role)).map((b) => blockText(b, asConverted)).filter((t) => t !== "").join("\n");
    return { main: of(MAIN_ROLES), notes: of(NOTE_ROLES), furniture: of(FURNITURE_ROLES) };
  };
  // A copy, so that a caller that changes what it is given changes nothing kept.
  return { ...madeOnce(blocks, asConverted ? "streams as converted" : "streams", make) };
}

/** What a review or a comparison binds to: the words and what counts as source text. */
export const textDigest = (blocks: Block[]): string => madeOnce(blocks, "text digest", () => {
  const { main, notes, furniture } = streamsOf(blocks);
  return digest({ furniture, main, notes });
});

/** A part entry's digest: the file's bytes with CRLF turned into LF. */
export const fileDigest = (text: string): string => sha256(text.replace(/\r\n/g, "\n"));

/** Footnote markers in the text, and the notes that carry a label. */
export function noteMarks(blocks: Block[]): { markers: string[]; notes: { label: string; continued: boolean }[] } {
  const markers = blocks.flatMap((b) => [...b.content.matchAll(INLINE)].filter((m) => m[1] === "fnref").map((m) => parseAttributes(m[2]!).label ?? ""));
  const notes = blocks.filter((b) => b.role === "footnote").map((b) => ({ label: b.label ?? "", continued: b.continued === "yes" }));
  return { markers, notes };
}

export const partFile = (paged: boolean, index: number): string =>
  `${paged ? "pages/p" : "sections/s"}${String(index).padStart(4, "0")}.md`;

export const SOURCE_DIRECTORY_NAME = /^[a-z0-9][a-z0-9-]{0,79}$/;

/** A name for a source directory taken from a citation key, or undefined when it gives no safe one. */
export function slugOf(key: string): string | undefined {
  const slug = key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return SOURCE_DIRECTORY_NAME.test(slug) && !/^(con|prn|aux|nul|com\d|lpt\d)$/.test(slug) ? slug : undefined;
}

export type { Json };

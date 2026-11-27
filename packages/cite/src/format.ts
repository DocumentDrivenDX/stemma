// Notes and bibliography formatted by citeproc-js with the pinned Chicago style
// and locale (ADR-005, CONTRACT-006 G). Every citation is formatted in note
// order with its note number, so that first and shortened forms follow the
// style. Text Stemma puts before or after an item, such as a verbatim
// quotation, never passes through the processor: it is put in by a placeholder
// after formatting, so the processor cannot change a character of it. Output is
// Markdown with *italic*.
import CSL from "citeproc";
import type { Corpus, JsonObject } from "@stemma/records";
import { cslItem, type CslItem, containerOf, sourceByKey } from "./csl.ts";
import style from "../vendor/chicago-notes-bibliography.csl" with { type: "text" };
import localeText from "../vendor/locales-en-US.xml" with { type: "text" };
import pins from "../vendor/pins.json";

export const CITEPROC_VERSION: string = pins.citeproc.version;
export const STYLE = { file: pins.style.file, title: pins.style.title, edition: pins.style.edition, commit: pins.style.commit, sha256: pins.style.sha256 };
export const LOCALE = { file: pins.locale.file, commit: pins.locale.commit, sha256: pins.locale.sha256 };

const ITALIC_OPEN = "";
const ITALIC_CLOSE = "";
// Some type declarations take an .xml import for a parsed document; it is text here.
const locale = localeText as unknown as string;
const HOLD_OPEN = "";
const HOLD_CLOSE = "";

// A plain-text output format whose only markup is italic, as two private-use
// characters that no record text may contain (checked below).
const formats = CSL.Output.Formats as Record<string, Record<string, unknown>>;
formats.stemma ??= {
  ...formats.text,
  "@font-style/italic": `${ITALIC_OPEN}%%STRING%%${ITALIC_CLOSE}`,
  "@font-style/oblique": `${ITALIC_OPEN}%%STRING%%${ITALIC_CLOSE}`,
};

export interface CiteItem {
  /** A citation key, a key alias, or a source record ID. */
  key: string;
  /** A CSL locator term and the printed value, such as page and 88–89. */
  label?: string;
  locator?: string;
  /** Markdown put before the formatted item, such as a quotation it supports. */
  before?: string;
  /** Markdown put after the formatted item, before the next item's separator. */
  after?: string;
}
/** One citation: its items, and the note it is in (several citations may share a note). */
export interface Cluster { note: number; items: CiteItem[] }
export interface Problem { note: number; key: string; problem: "no_source" | "private_use_text" }
export interface Formatted {
  /** One Markdown string for each cluster, in order. */
  citations: string[];
  bibliography: string[];
  /** For each cluster, its citation without the text its items put before them. */
  bare: string[];
  /** For each cluster, the sources its items name, with the source each is listed under in the bibliography. */
  cited: { source: string; listed: string }[][];
  /** For each bibliography entry, in order, the IDs of the sources the processor made it from. */
  bibliographyIds: string[][];
  problems: Problem[];
  /** The CSL-JSON items given to the processor, by source ID. */
  items: Record<string, CslItem>;
}

const markdown = (s: string): string => s.replaceAll(ITALIC_OPEN, "*").replaceAll(ITALIC_CLOSE, "*");
const hasPrivate = (v: unknown): boolean => /[]/.test(JSON.stringify(v));
// While compiling a style, the processor looks up each macro it expands by
// walking the whole parsed style, which made that walk most of the time taken
// to format anything. The macros it holds do not change while it compiles, so
// they are listed once for each parsed style and looked up by name.
type StyleNode = { name?: string; attrs?: Record<string, string>; children?: unknown[] };
type NodeSearch = (this: unknown, node: StyleNode, name: string, nameValue?: string, found?: StyleNode[]) => StyleNode[];
const xml = (CSL as unknown as { XmlJSON: { prototype: { getNodesByName: NodeSearch; dataObj?: StyleNode } } }).XmlJSON.prototype;
const walk = xml.getNodesByName;
const macros = new WeakMap<StyleNode, Map<string, StyleNode[]>>();
xml.getNodesByName = function (node, name, nameValue, found) {
  if (name !== "macro" || !nameValue || found || node !== (this as { dataObj?: StyleNode }).dataObj) return walk.call(this, node, name, nameValue, found);
  let byName = macros.get(node);
  if (!byName) {
    byName = new Map();
    for (const macro of walk.call(this, node, name)) {
      const own = macro.attrs?.name ?? "";
      byName.set(own, [...(byName.get(own) ?? []), macro]);
    }
    macros.set(node, byName);
  }
  return [...(byName.get(nameValue) ?? [])];
};

// Each node of the style is given its formatting attributes in a fixed order,
// which the processor found by enumerating the keys of the array that lists the
// order, a third of the time taken to compile the style. The same attributes are
// taken in the same order by walking the array itself.
const processor = CSL as unknown as { FORMAT_KEY_SEQUENCE: string[]; setDecorations: (state: unknown, attributes: Record<string, unknown>) => [string, unknown][] };
processor.setDecorations = (_state, attributes) => {
  const ret: [string, unknown][] = [];
  for (const key of processor.FORMAT_KEY_SEQUENCE) {
    if (attributes[key]) {
      ret.push([key, attributes[key]]);
      delete attributes[key];
    }
  }
  return ret;
};

const engineFor = (items: Record<string, CslItem>) => {
  const engine = new CSL.Engine({ retrieveLocale: () => locale, retrieveItem: (id: string) => items[id] }, style, "en-US", true);
  engine.setOutputFormat("stemma");
  return engine;
};
const formatOne = (engine: ReturnType<typeof engineFor>, id: string, note: number, pre: [string, number][]): string => {
  const out = engine.processCitationCluster({ citationID: `x${note}`, citationItems: [{ id }], properties: { noteIndex: note } }, pre, []) as [unknown, [number, string, string][]];
  return markdown(out[1].find((c) => c[2] === `x${note}`)?.[1] ?? "").replace(/\.$/, "");
};

/**
 * A letter printed in a collection is cited as the collection, at the page,
 * with the letter's own description before it: "Charles Darwin to Karl Semper,
 * October 2, 1879, in …" the first time, "Darwin to Semper, October 2, 1879,
 * in …" after. The style's own short form of a letter names no volume or page,
 * so a reader of a later note could not find it; this way every note names
 * where the letter is printed. The descriptions are the style's own, formed for
 * the letter with nothing of its collection: in full, and in the short form
 * (which the style forms only for a letter it treats as published, so the
 * publisher is kept for that one).
 */
function letterDescriber(corpus: Corpus): (record: JsonObject) => { full: string; short: string } {
  // Compiling the style is the costly step, so one engine for each form serves
  // every letter, emptied before each so that no letter affects another.
  const maker = () => {
    const items: Record<string, CslItem> = {};
    let engine: ReturnType<typeof engineFor> | undefined;
    return (item: CslItem) => {
      items[item.id] = item;
      engine ??= engineFor(items);
      engine.updateItems([]);
      return engine;
    };
  };
  const fullEngine = maker();
  const shortEngine = maker();
  const described = new Map<string, { full: string; short: string }>();
  return (record) => {
    const own = cslItem(corpus, record);
    const known = described.get(own.id);
    if (known) return known;
    const bare = { ...own };
    for (const v of ["container-title", "container-title-short", "editor", "volume", "publisher", "publisher-place", "issued", "container-author", "page", "collection-title", "edition"]) delete bare[v];
    const full = formatOne(fullEngine(bare), own.id, 1, []);
    const engine = shortEngine({ ...bare, ...(own.publisher !== undefined ? { publisher: own.publisher } : {}) });
    formatOne(engine, own.id, 1, []);
    const made = { full, short: formatOne(engine, own.id, 2, [["x1", 1]]) };
    described.set(own.id, made);
    return made;
  };
}

/**
 * Formats citations in order. A key that names no source is shown, marked, and
 * reported (`cite.format`); nothing is made up for it. The bibliography lists
 * the cited sources and `include`; a letter in a published collection is listed
 * under the collection, as Chicago does.
 */
export function formatCitations(corpus: Corpus, clusters: Cluster[], include: string[] = []): Formatted {
  const items: Record<string, CslItem> = {};
  const problems: Problem[] = [];
  const idOf = (key: string, note: number): string | undefined => {
    const source = sourceByKey(corpus, key);
    if (!source) {
      problems.push({ note, key, problem: "no_source" });
      return undefined;
    }
    const id = String(source.id);
    if (!items[id]) {
      const item = cslItem(corpus, source);
      if (hasPrivate(item)) problems.push({ note, key, problem: "private_use_text" });
      items[id] = item;
    }
    return id;
  };
  const engine = engineFor(items);
  const describeLetter = letterDescriber(corpus);
  const lettersSeen = new Set<string>();
  const citations: string[] = [];
  const bare: string[] = [];
  const cited: Formatted["cited"] = [];
  const pre: [string, number][] = [];
  clusters.forEach((cluster, n) => {
    const holds: string[] = [];
    const hold = (text: string) => `${HOLD_OPEN}${holds.push(text) - 1}${HOLD_CLOSE}`;
    const befores = new Set<number>();
    const named: Formatted["cited"][number] = [];
    const citationItems: object[] = [];
    const missing: string[] = [];
    const missingBare: string[] = [];
    for (const item of cluster.items) {
      const id = idOf(item.key, cluster.note);
      if (!id) {
        const mark = `[no source for the key ${item.key}]${item.after ?? ""}`;
        missing.push(`${item.before ?? ""}${mark}`);
        missingBare.push(mark);
        continue;
      }
      const record = corpus.byId.get(id)!.data!;
      const container = record.type === "personal_communication" ? containerOf(corpus, record) : undefined;
      let target = id;
      if (item.before) befores.add(holds.length);
      let prefix = item.before ? hold(item.before) : "";
      if (container) {
        const described = describeLetter(record);
        prefix += hold(`${lettersSeen.has(id) ? described.short : described.full}, in `);
        lettersSeen.add(id);
        target = String(container.id);
        items[target] ??= cslItem(corpus, container);
      }
      named.push({ source: id, listed: target });
      citationItems.push({
        id: target, ...(item.locator ? { locator: item.locator, label: item.label ?? "page" } : {}),
        ...(prefix ? { prefix } : {}), ...(item.after ? { suffix: hold(item.after) } : {}),
      });
    }
    let text = "";
    let without = "";
    if (citationItems.length > 0) {
      const id = `c${n}`;
      const [, changed] = engine.processCitationCluster({ citationID: id, citationItems, properties: { noteIndex: cluster.note } }, pre, []) as [unknown, [number, string, string][]];
      pre.push([id, cluster.note]);
      const made = markdown(changed.find((c) => c[2] === id)?.[1] ?? "");
      const fill = (put: (i: number) => string) => made.replace(new RegExp(`${HOLD_OPEN}(\\d+)${HOLD_CLOSE}`, "g"), (_, i: string) => put(Number(i)));
      text = fill((i) => holds[i]!);
      without = fill((i) => (befores.has(i) ? "" : holds[i]!));
    }
    citations.push([text, ...missing].filter(Boolean).join(" "));
    bare.push([without, ...missingBare].filter(Boolean).join(" "));
    cited.push(named);
  });
  // The bibliography: a letter is listed under its collection.
  const listed = new Set<string>();
  const add = (id: string) => {
    const record = corpus.byId.get(id)?.data as JsonObject | undefined;
    if (!record) return;
    const target = (record.type === "personal_communication" ? containerOf(corpus, record) : undefined) ?? record;
    const targetId = String(target.id);
    items[targetId] ??= cslItem(corpus, target);
    listed.add(targetId);
  };
  for (const id of Object.keys(items)) add(id);
  for (const key of include) {
    const id = idOf(key, 0);
    if (id) add(id);
  }
  engine.updateItems([...listed].sort());
  const made = engine.makeBibliography() as [{ entry_ids: unknown[][] }, string[]] | false;
  const bibliography = made ? made[1].map((e) => markdown(e.trim())) : [];
  const bibliographyIds = made ? made[0].entry_ids.map((ids) => ids.map(String)) : [];
  return { citations, bibliography, bare, cited, bibliographyIds, problems, items };
}

export type { CslItem };

// Notes and bibliography formatted by citeproc-js with the pinned Chicago style
// and locale (ADR-005, CONTRACT-006 G). Every cluster is formatted in note
// order with its note number, so that first and shortened forms follow the
// style. Text Stemma adds after an item, such as verbatim evidence, never passes
// through the processor: it is put in by a placeholder after formatting, so the
// processor cannot change a character of it. Output is Markdown with *italic*.
import CSL from "citeproc";
import type { Corpus, JsonObject } from "@stemma/records";
import { cslItem, type CslItem, containerOf, sourceByKey } from "./csl.ts";
import style from "../vendor/chicago-notes-bibliography.csl" with { type: "text" };
import locale from "../vendor/locales-en-US.xml" with { type: "text" };
import pins from "../vendor/pins.json";

export const CITEPROC_VERSION: string = pins.citeproc.version;
export const STYLE = { file: pins.style.file, title: pins.style.title, edition: pins.style.edition, commit: pins.style.commit, sha256: pins.style.sha256 };
export const LOCALE = { file: pins.locale.file, commit: pins.locale.commit, sha256: pins.locale.sha256 };

const ITALIC_OPEN = "";
const ITALIC_CLOSE = "";
const HOLD_OPEN = "";
const HOLD_CLOSE = "";

// A plain-text output format whose only markup is italic, as two private-use
// characters that no record text contains (checked below).
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
  /** Markdown put after the formatted item, before the next item's separator. */
  after?: string;
}
export interface Problem { note: number; key: string; problem: "no_source" | "private_use_text" }
export interface Formatted {
  /** One Markdown string for each cluster, in order. */
  notes: string[];
  bibliography: string[];
  problems: Problem[];
  /** The CSL-JSON items given to the processor, by source ID. */
  items: Record<string, CslItem>;
}

const markdown = (s: string): string => s.replaceAll(ITALIC_OPEN, "*").replaceAll(ITALIC_CLOSE, "*");
const hasPrivate = (v: unknown): boolean => JSON.stringify(v).match(/[]/) !== null;

/**
 * Formats clusters in note order. A key that names no source is shown in the
 * note, marked, and reported (`cite.format`); nothing is made up for it. The
 * bibliography lists the cited sources and `include`, except that a letter or
 * other personal communication in a published collection is listed under the
 * collection, as Chicago does.
 */
export function formatCitations(corpus: Corpus, clusters: CiteItem[][], include: string[] = []): Formatted {
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
  const engine = new CSL.Engine({ retrieveLocale: () => locale, retrieveItem: (id: string) => items[id] }, style, "en-US", true);
  engine.setOutputFormat("stemma");
  const notes: string[] = [];
  const pre: [string, number][] = [];
  clusters.forEach((cluster, n) => {
    const note = n + 1;
    const known: { id: string; item: CiteItem; hold: number }[] = [];
    const missing: string[] = [];
    cluster.forEach((item, i) => {
      const id = idOf(item.key, note);
      if (id) known.push({ id, item, hold: i });
      else missing.push(`[no source for the key ${item.key}]`);
    });
    let text = "";
    if (known.length > 0) {
      const citation = {
        citationID: `n${note}`, properties: { noteIndex: note },
        citationItems: known.map(({ id, item, hold }) => ({
          id, ...(item.locator ? { locator: item.locator, label: item.label ?? "page" } : {}),
          ...(item.after ? { suffix: `${HOLD_OPEN}${hold}${HOLD_CLOSE}` } : {}),
        })),
      };
      const [, changed] = engine.processCitationCluster(citation, pre, []) as [unknown, [number, string, string][]];
      text = changed.find((c) => c[2] === `n${note}`)?.[1] ?? "";
      text = markdown(text).replace(new RegExp(`${HOLD_OPEN}(\\d+)${HOLD_CLOSE}`, "g"), (_, i: string) => cluster[Number(i)]!.after!);
    }
    pre.push([`n${note}`, note]);
    notes.push([text, ...missing].filter(Boolean).join(" "));
  });
  // The bibliography: a part listed under its collection where Chicago lists the collection.
  const listed = new Set<string>();
  const add = (id: string) => {
    const record = corpus.byId.get(id)?.data as JsonObject | undefined;
    if (!record) return;
    const container = record.type === "personal_communication" ? containerOf(corpus, record) : undefined;
    const target = container ?? record;
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
  const made = engine.makeBibliography() as [unknown, string[]] | false;
  const bibliography = made ? made[1].map((e) => markdown(e.trim())) : [];
  return { notes, bibliography, problems, items };
}

export type { CslItem };

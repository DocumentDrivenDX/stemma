// Which file this is: whether a file repeats text already taken over
// (CONTRACT-003 I, "Which file this is", rule 3). The comparison reads the new
// file's body outside its reference lists, and each earlier file's chapters as
// the Stemma copy holds them now.
import type { Manuscript } from "@stemma/manuscript";
import type { Corpus } from "@stemma/records";
import type { Document } from "./document.ts";
import type { ReferenceList } from "./lists.ts";
import { fold } from "./text.ts";

export const RUN_WORDS = 12;
export const REPEATED_SHARE = 0.2;

/** Bracketed text out, so that a citation as typed and its marker compare alike. */
function unbracketed(text: string): string {
  let out = text;
  for (let before = ""; before !== out; ) {
    before = out;
    out = out.replace(/\([^()]*\)|\[[^[\]]*\]/g, " ");
  }
  return out;
}

export function runs(texts: string[]): Set<string> {
  const words = texts.flatMap((t) => fold(unbracketed(t)).match(/[\p{L}\p{N}]+/gu) ?? []);
  const out = new Set<string>();
  for (let i = 0; i + RUN_WORDS <= words.length; i++) out.add(words.slice(i, i + RUN_WORDS).join(" "));
  return out;
}

export function newRuns(document: Document, lists: ReferenceList[]): Set<string> {
  return runs(document.paragraphs.filter((p, i) => p.location === "body" && !lists.some((l) => i >= l.start && i < l.end)).map((p) => p.text));
}

/** For each import batch, the runs of the chapters that came from it. */
export function takenRuns(corpus: Corpus, manuscript: Manuscript): Map<string, Set<string>> {
  const texts = new Map<string, string[]>();
  for (const chapter of manuscript.chapters) {
    const record = corpus.byId.get(chapter.id)?.data;
    const created = record?.created as { import?: unknown } | undefined;
    if (typeof created?.import !== "string") continue;
    const body = chapter.blocks.filter((b) => !b.note && b.kind !== "unconverted").map((b) => b.text);
    texts.set(created.import, [...texts.get(created.import) ?? [], ...body]);
  }
  return new Map([...texts].map(([batch, body]) => [batch, runs(body)]));
}

/** The share of `fresh` that occurs in `earlier`. */
export const shareIn = (fresh: Set<string>, earlier: Set<string>): number =>
  fresh.size === 0 ? 0 : [...fresh].filter((r) => earlier.has(r)).length / fresh.size;

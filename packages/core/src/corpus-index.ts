// Lookups over one loaded corpus, each made once. Without them every check
// rescans every record for each item, and a run's time grows with the square of
// the project. A corpus is not changed after `loadCorpus`: a different one is a
// different object, and gets its own lookups. Each list keeps the order of
// `corpus.records` and is shared, so a caller that sorts it copies it first.
import { type Corpus, isRetired, type LoadedFile } from "@stemma/records";

const known = new WeakMap<Corpus, Map<string, unknown>>();

/** What `make` returns, made once for this corpus under `name`. */
export function once<T>(corpus: Corpus, name: string, make: () => T): T {
  let made = known.get(corpus);
  if (!made) known.set(corpus, made = new Map());
  if (!made.has(name)) made.set(name, make());
  return made.get(name) as T;
}

/** The items under each key, in their order. */
export function grouped<K, T>(items: Iterable<T>, keysOf: (item: T) => Iterable<K>): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const item of items) {
    for (const key of keysOf(item)) {
      const list = out.get(key);
      if (!list) out.set(key, [item]);
      else if (list.at(-1) !== item) list.push(item);
    }
  }
  return out;
}

const NONE: LoadedFile[] = [];

/** Records of a kind that can be read and are not retired. */
export const activeRecords = (corpus: Corpus, kind: string): LoadedFile[] =>
  once(corpus, "active", () => grouped(corpus.records.filter((f) => f.state === "ok" && f.data !== undefined && !isRetired(f.data)), (f) => [f.data!.kind]))
    .get(kind) ?? NONE;

/** Those whose `field` is exactly `value`. */
export const activeWhere = (corpus: Corpus, kind: string, field: string, value: unknown): LoadedFile[] =>
  once(corpus, `active ${kind} by ${field}`, () => grouped<unknown, LoadedFile>(activeRecords(corpus, kind), (f) => [f.data![field]])).get(value) ?? NONE;

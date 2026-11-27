// The served explorer's own search (CONTRACT-005 M, "Search"): every entry of
// every type, matched, ranked, counted and paged over the folded search texts of
// one snapshot, held in memory. There is no index (ADR-012): one search reads
// each text once. It also answers arras's search query, in arras's result shape.
import { searchFold } from "../../records/src/search-fold.ts";

export interface SearchData {
  /** In declaration order. */
  types: { type: string; label: string }[];
  /** In the declaration order of their types, then by key: the order of equal ranks. */
  entries: { type: string; key: string; label: string; text: string }[];
}

/** `page` bounds one page of `/api/search`; `arrasPage` the limit of arras's query; `chars` is code points as sent. */
export const SEARCH_LIMITS = { chars: 200, words: 16, page: 200, arrasPage: 500, excerpt: 160 };
const ID_SCORE = 1000;

export interface Query {
  /** As folded. */
  text: string;
  words: string[];
}

/** The query of a text as sent, or nothing when it is outside the bounds. */
export function queryOf(sent: string): Query | undefined {
  // Two UTF-16 units a code point at most, so a longer string is not counted.
  if (sent.length > SEARCH_LIMITS.chars * 2 || Array.from(sent).length > SEARCH_LIMITS.chars) return undefined;
  const text = searchFold(sent);
  const words = text.split(" ").filter((word) => word !== "");
  return words.length >= 1 && words.length <= SEARCH_LIMITS.words ? { text, words } : undefined;
}

export interface ExcerptPart { text: string; mark: boolean }

/**
 * At most 160 UTF-16 units, so at most as many code points, of a search text
 * around its first match after the heading, or its first match, with every match
 * in it marked.
 */
export function excerptOf(text: string, words: string[], headLength: number): ExcerptPart[] {
  const first = (from: number) => Math.min(...words.map((w) => {
    const at = text.indexOf(w, from);
    return at < 0 ? Number.POSITIVE_INFINITY : at;
  }));
  let at = first(headLength);
  if (at === Number.POSITIVE_INFINITY) at = first(0);
  if (at === Number.POSITIVE_INFINITY) return [];
  // No character is cut in half.
  const whole = (i: number) => (i > 0 && i < text.length && text.charCodeAt(i) >= 0xdc00 && text.charCodeAt(i) <= 0xdfff ? i - 1 : i);
  let start = 0;
  if (text.length > SEARCH_LIMITS.excerpt && at > 40) {
    start = whole(at - 40);
    const space = text.indexOf(" ", start);
    if (space >= 0 && space < at) start = space + 1;
  }
  let end = whole(Math.min(text.length, start + SEARCH_LIMITS.excerpt - 2));
  if (end < text.length) {
    const space = text.lastIndexOf(" ", end);
    if (space > at) end = space;
  }
  const slice = text.slice(start, end);
  const found: [number, number][] = [];
  for (const word of new Set(words)) {
    // A word longer than what is left of the window is marked as far as it shows.
    if (start + slice.length - at < word.length && text.startsWith(word, at)) found.push([at - start, slice.length]);
    for (let i = slice.indexOf(word); i >= 0; i = slice.indexOf(word, i + word.length)) found.push([i, i + word.length]);
  }
  found.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const parts: ExcerptPart[] = [];
  const plain = (value: string) => {
    if (value) parts.push({ text: value, mark: false });
  };
  let done = 0;
  for (let i = 0; i < found.length;) {
    const from = found[i]![0];
    let to = found[i]![1];
    for (i++; i < found.length && found[i]![0] <= to; i++) to = Math.max(to, found[i]![1]);
    plain((done === 0 && start > 0 ? "…" : "") + slice.slice(done, from));
    parts.push({ text: slice.slice(from, to), mark: true });
    done = to;
  }
  plain(slice.slice(done) + (end < text.length ? "…" : ""));
  return parts;
}

export interface Hit {
  /** From 1, among all matches of the asked types. */
  rank: number;
  index: number;
  score: number;
}

export interface Found {
  /** Matches of the asked types. */
  total: number;
  /** Matches of each type, over every type, by its place in `types`. */
  counts: number[];
  hits: Hit[];
}

export function createSearch(data: SearchData) {
  const { types, entries } = data;
  const place = new Map(types.map((t, i) => [t.type, i]));
  const typeOf = Uint16Array.from(entries, (e) => place.get(e.type)!);
  const heads = entries.map((e) => searchFold(e.label));
  const byKey = new Map<string, number[]>();
  entries.forEach((e, i) => {
    const key = e.key.toLowerCase();
    const known = byKey.get(key);
    if (known) known.push(i);
    else byKey.set(key, [i]);
  });

  /** One page of the matches, best first. `asked` holds the places of the types listed; every type is counted. */
  function find({ text, words }: Query, asked: Set<number> | undefined, offset: number, limit: number): Found {
    const spaced = words.map((w) => ` ${w}`);
    const counts = types.map(() => 0);
    const named = new Set(byKey.get(text.toLowerCase()) ?? []);
    // One list for each score, filled in the order of the entries, which is the order of equal ranks.
    const ranked: number[][] = Array.from({ length: words.length * 4 + 1 }, () => []);
    let total = 0;
    next: for (let i = 0; i < entries.length; i++) {
      let score = 0;
      if (named.has(i)) {
        counts[typeOf[i]!]!++;
        if (!asked || asked.has(typeOf[i]!)) total++;
        continue;
      }
      const body = entries[i]!.text;
      for (let w = 0; w < words.length; w++) if (!body.includes(words[w]!)) continue next;
      counts[typeOf[i]!]!++;
      if (asked && !asked.has(typeOf[i]!)) continue;
      total++;
      const head = heads[i]!;
      for (let w = 0; w < words.length; w++) {
        const word = words[w]!;
        if (head.includes(word)) score += head.startsWith(word) || head.includes(spaced[w]!) ? 4 : 3;
        else score += body.startsWith(word) || body.includes(spaced[w]!) ? 2 : 1;
      }
      ranked[score]!.push(i);
    }
    const hits: Hit[] = [];
    let before = 0;
    const take = (list: number[], score: number) => {
      for (let at = Math.max(0, offset - before); at < list.length && hits.length < limit; at++) hits.push({ rank: before + at + 1, index: list[at]!, score });
      before += list.length;
    };
    take([...named].filter((i) => !asked || asked.has(typeOf[i]!)).sort((a, b) => a - b), ID_SCORE);
    for (let score = ranked.length - 1; score >= 0; score--) take(ranked[score]!, score);
    return { total, counts, hits };
  }

  const excerpt = ({ words }: Query, index: number) => excerptOf(entries[index]!.text, words, heads[index]!.length);

  /** One page of results, as `/api/search` answers (CONTRACT-005 M). */
  function page(query: Query, type: string | undefined, offset: number, limit: number) {
    const asked = type === undefined ? undefined : new Set([place.get(type)!]);
    const found = find(query, asked, offset, limit);
    return {
      text: query.text,
      total: found.total,
      all: found.counts.reduce((a, b) => a + b, 0),
      counts: found.counts.flatMap((count, i) => (count > 0 ? [{ ...types[i]!, count }] : [])),
      searched: { entries: entries.length, types: types.length },
      offset,
      hits: found.hits.map(({ rank, index }) => {
        const entry = entries[index]!;
        return { rank, type: entry.type, type_label: types[typeOf[index]!]!.label, key: entry.key, label: entry.label, excerpt: excerpt(query, index) };
      }),
    };
  }

  /** What arras's `_search` field holds. `names` is the types it asked for, all when absent. */
  function arrasPage(query: Query, names: string[] | undefined, limit: number, freshness: unknown[]) {
    const asked = names && new Set(names.map((name) => place.get(name)!));
    const found = find(query, asked, 0, limit);
    const number = (n: number) => n.toLocaleString("en-US");
    return {
      // arras shows this beside its count of the results listed. Its own words for a cut answer would be untrue.
      text: found.total > found.hits.length
        ? `${query.text} (the best ${number(found.hits.length)} of ${number(found.total)} matches are listed; the Search view lists all of them)`
        : query.text,
      hits: found.hits.map(({ index, score }) => {
        const entry = entries[index]!;
        const parts = excerpt(query, index);
        return {
          type: entry.type, key: entry.key, score, label: entry.label, excerpt: parts.length > 0 ? parts : null,
          matched: ["searchText"], entity: { key: entry.key, type: entry.type },
        };
      }),
      counts: types.flatMap((t, i) => (!asked || asked.has(i) ? [{ type: t.type, count: found.counts[i]!, atLeast: false }] : [])),
      notSearched: [],
      truncated: false,
      freshness,
    };
  }

  return { page, arrasPage, hasType: (type: string) => place.has(type) };
}

/** The search query the pinned arras browser sends (arras 0.8.1), for a module whose types have no badge field. */
export const ARRAS_SEARCH_QUERY = /^query\(\$text: String!, \$types: \[String!\], \$limit: Int\) \{ _search\(text: \$text, types: \$types, limit: \$limit\) \{ text hits \{ type key score label excerpt \{ text mark \} matched entity \{ key type +\} \} counts \{ type count atLeast \} notSearched \{ type reason backend \} truncated freshness \{ backend asOf at consistency \} \} \}$/;

/** What the pinned arras itself accepts as a search's text: 2 to 200 characters and at most 6 words. */
export function arrasAccepts(text: string): boolean {
  const words = text.split(/\s+/u).filter((word) => word !== "");
  const length = Array.from(words.join(" ").toLowerCase()).length;
  return length >= 2 && length <= 200 && words.length <= 6;
}

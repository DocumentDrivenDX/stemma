// The author-date matcher: finds every bracketed year outside the reference
// lists, reads its citation forms, and links, leaves unresolved, or leaves
// unlinked with a reason (CONTRACT-003 H; SD-015 BR-1522 to BR-1524). Only
// these rules decide. It is a pure function of the documents it is given.
import type { Document, Location, Position } from "./document.ts";
import { type Authors, type Entry, readReferenceLists, type ReferenceList } from "./lists.ts";
import {
  fold, holdsWords, isCapitalWord, isConnector, isInitials, isName, isParticle, MONTHS, PROFILE, SENTENCE_WORDS,
  words, yearAt, yearForms, type YearForm,
} from "./text.ts";

export type UnresolvedReason = "no_list" | "several_entries" | "unread_entry" | "no_entry";
export type UnlinkedReason = "in_table" | "year_range" | "no_author_form" | "mixed_parts" | "unrecognized_form";

export const UNLINKED_REASONS: UnlinkedReason[] = ["in_table", "year_range", "no_author_form", "mixed_parts", "unrecognized_form"];
export const UNRESOLVED_REASONS: UnresolvedReason[] = ["no_list", "several_entries", "unread_entry", "no_entry"];

/** A reference-list entry, named by its file and paragraph. */
export interface EntryRef { file: string; paragraph: number; asFound: string }
export type Candidate = EntryRef & { why: "matches" | "could_fit" | "other_list" };

export interface Cited {
  /** The family names in order, or none when the words read only as one whole name. */
  names: string[] | undefined;
  /** All the names with their joining words, without `et al.`. */
  whole: string;
  etAl: boolean;
}

export type CitationItem = Cited & {
  year: string;
  suffix: string;
  narrative: boolean;
  prefix?: string;
  /** A page locator, as printed. */
  locator?: string;
  /** The author's bracketed working markers that follow this item, exactly as typed. */
  marker?: string;
  candidates: Candidate[];
} & ({ state: "linked"; entry: EntryRef } | { state: "unresolved"; reason: UnresolvedReason });

export interface PartReading { text: string; read: "citation" | "years_only" | "not_citation" }

export type Bracket = Position & {
  location: Location;
  /** The brackets and what they hold, as typed. */
  text: string;
} & (
  | { state: "linked" | "unresolved"; items: CitationItem[] }
  | { state: "unlinked"; reason: UnlinkedReason; parts: PartReading[]; possibleNarrative: boolean }
);

export interface AuthorDateResult {
  profile: typeof PROFILE;
  lists: ReferenceList[];
  files: { file: string; lists: number }[];
  /** In file and document order. */
  brackets: Bracket[];
  /** Brackets with no partner that a year form follows. They are outside the counts. */
  unpaired: (Position & { location: Location })[];
  counts: {
    examined: number;
    linked: number;
    unresolved: number;
    unlinked: number;
    unlinkedByReason: Record<UnlinkedReason, number>;
    items: { linked: number; unresolved: number; unresolvedByReason: Record<UnresolvedReason, number> };
  };
}

// ---- Brackets ----

interface Pair { start: number; end: number; nested: boolean; own: string }

function pairs(text: string): { pairs: Pair[]; unpaired: number[] } {
  const stack: { start: number; inner: Pair[] }[] = [];
  const found: Pair[] = [];
  const alone: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(") stack.push({ start: i, inner: [] });
    else if (text[i] === ")") {
      const open = stack.pop();
      if (!open) {
        alone.push(i);
        continue;
      }
      let own = "";
      let at = open.start + 1;
      for (const inner of open.inner) {
        own += `${text.slice(at, inner.start)} · `;
        at = inner.end;
      }
      const pair = { start: open.start, end: i + 1, nested: open.inner.length > 0, own: own + text.slice(at, i) };
      found.push(pair);
      stack.at(-1)?.inner.push(pair);
    }
  }
  alone.push(...stack.map((s) => s.start));
  // Text inside any pair does not count as following a bracket that has no partner.
  const outside = found.reduce((t, p) => t.slice(0, p.start) + " ".repeat(p.end - p.start) + t.slice(p.end), text);
  return {
    pairs: found.filter((p) => yearForms(p.own).length > 0).sort((a, b) => a.start - b.start),
    unpaired: alone.filter((i) => yearForms(outside.slice(i + 1)).length > 0).sort((a, b) => a - b),
  };
}

// ---- Parts and citation forms ----

interface YearItem { year: string; suffix: string; locator?: string; marker?: string }

/** A part without the working markers that end it, and those markers as typed. */
function withoutMarkers(part: string): { body: string; marker?: string } {
  let body = part;
  for (;;) {
    const found = /(?<=[^\s,])(?:\s*,)?\s+\[([^[\]]*)\]\s*$/.exec(body);
    if (!found || !/\p{L}/u.test(found[1]!) || yearForms(found[1]!).length > 0) break;
    body = body.slice(0, found.index);
  }
  return body === part ? { body } : { body, marker: part.slice(body.length).trim() };
}

/** Parts are split at semicolons, except those inside square brackets. */
const splitParts = (content: string): string[] => content.split(/;(?![^[\]]*\])/);

const PAGE = String.raw`(?:\d+(?:ff?\.?(?![\p{L}]))?|[ivxlc]+)(?![\p{L}\p{N}])`;
const RANGE = String.raw`${PAGE}(?:\s*[-‐‑–]\s*${PAGE})?`;

function pageList(text: string, at: number): { printed: string; end: number } | undefined {
  const first = new RegExp(RANGE, "yu");
  first.lastIndex = at;
  if (!first.test(text)) return undefined;
  let end = first.lastIndex;
  for (;;) {
    const comma = /\s*,\s*/y;
    comma.lastIndex = end;
    if (!comma.test(text) || yearAt(text, comma.lastIndex)) break;
    const next = new RegExp(RANGE, "yu");
    next.lastIndex = comma.lastIndex;
    if (!next.test(text)) break;
    end = next.lastIndex;
  }
  return { printed: text.slice(at, end), end };
}

function locatorAt(text: string, at: number): { printed: string; end: number } | undefined {
  const marked = /\s*(?::\s*(?:pp?\.\s*)?|,?\s*(?<![\p{L}])pp?\.\s*)/uy;
  marked.lastIndex = at;
  if (marked.test(text)) return pageList(text, marked.lastIndex);
  const comma = /\s*,\s*/y;
  comma.lastIndex = at;
  if (!comma.test(text) || yearAt(text, comma.lastIndex)) return undefined;
  return pageList(text, comma.lastIndex);
}

const RANGE_END = /^\s*[-‐‑–—/]\s*(?:\d|present)/;

/** Year forms, each with an optional locator, filling the rest of a part. */
function yearItems(text: string, at: number): YearItem[] | undefined {
  const items: YearItem[] = [];
  for (let year: YearForm | undefined = yearAt(text, at); year; ) {
    if (RANGE_END.test(text.slice(year.end))) return undefined;
    const locator = locatorAt(text, year.end);
    items.push({ year: year.year, suffix: year.suffix, ...(locator ? { locator: locator.printed } : {}) });
    const end = locator?.end ?? year.end;
    if (/^\s*$/.test(text.slice(end))) return items;
    const comma = /\s*,\s*/y;
    comma.lastIndex = end;
    year = comma.test(text) ? yearAt(text, comma.lastIndex) : undefined;
  }
  return undefined;
}

const SERIES = /(\s*,\s*(?:(?:and\s+|&\s*))?|\s+(?:and\s+|&\s*))/;

/** The names in a series: one, two joined by `and` or `&`, a series ending so, or any of these before `et al.` */
function series(whole: string, etAl: boolean): string[] | undefined {
  const split = whole.split(SERIES);
  const names = split.filter((_, i) => i % 2 === 0).map((s) => s.trim());
  const joins = split.filter((_, i) => i % 2 === 1).map((s) => /and|&/.test(s));
  if (!names.every(isName)) return undefined;
  const ordered = joins.every((joined, i) => (i === joins.length - 1 ? joined || etAl : !joined));
  return ordered ? names : undefined;
}

const ET_AL = /,?\s+et al\.?$/;

interface Known {
  /** Folded family names and whole names in every list of the project. */
  families: Set<string>;
  wholes: Set<string>;
}

/** The words before a year in brackets, read as names. */
function namesInBrackets(text: string, known: Known): Cited | undefined {
  const etAl = ET_AL.test(text);
  const whole = words(text.replace(ET_AL, "")).join(" ");
  if (!whole) return undefined;
  let names = series(whole, etAl);
  // A corporate name that does not divide into names is read only if a list has it.
  if (!names && !(known.wholes.has(fold(whole)) && !etAl)) return undefined;
  const first = words(names?.[0] ?? whole);
  if (SENTENCE_WORDS.has(fold(first[0]!))) return undefined;
  if (names?.some((n) => MONTHS.has(fold(n)) && !known.families.has(fold(n)))) names = undefined;
  if (!names && !known.wholes.has(fold(whole))) return undefined;
  return { names, whole, etAl };
}

type Part =
  | { read: "citation"; cited: Cited; prefix?: string; items: YearItem[] }
  | { read: "years_only"; items: YearItem[] }
  | { read: "not_citation" };

const LEAD_IN = /^(see also|see|cf\.|based on)\s+/i;

function readPart(typed: string, known: Known): Part {
  const { body, marker } = withoutMarkers(typed);
  const part = readCitation(body, known);
  if (marker && part.read !== "not_citation") part.items.push({ ...part.items.pop()!, marker });
  return part;
}

function readCitation(raw: string, known: Known): Part {
  const text = raw.replace(/\s+/g, " ").trim();
  const only = yearItems(text, 0);
  if (only) return { read: "years_only", items: only };
  const lead = LEAD_IN.exec(text);
  const rest = lead ? text.slice(lead[0].length) : text;
  const year = yearForms(rest)[0];
  if (!year || year.start === 0) return { read: "not_citation" };
  const before = rest.slice(0, year.start);
  if (!/[\s,]$/.test(before)) return { read: "not_citation" };
  const cited = namesInBrackets(before.replace(/\s*,?\s*$/, ""), known);
  const items = cited ? yearItems(rest, year.start) : undefined;
  if (!cited || !items) return { read: "not_citation" };
  return { read: "citation", cited, ...(lead ? { prefix: lead[1]! } : {}), items };
}

const ERA = /(?<![\p{L}])(?:BCE|CE|BC|AD)(?![\p{L}])/gu;

/** A range of dates and no part that holds names, that is, no capitalized word. */
const isDateRange = (parts: string[]): boolean =>
  parts.some((p) => yearForms(p).some((y) => /^\d/.test(y.year) && RANGE_END.test(p.slice(y.end)) && !/(?::|(?<![\p{L}])pp?\.)\s*$/u.test(p.slice(0, y.start)))) &&
  parts.every((p) => !/(?<![\p{L}])\p{Lu}/u.test(p.replace(ERA, "")));

// ---- Narrative names ----

/** The names that stand directly before a bracket, with only spaces between. */
function namesBefore(text: string, known: Known): Cited | undefined {
  // A name phrase is short; this bounds the work in a very long paragraph.
  const tokens: string[] = text.slice(-400).trimEnd().match(/,|[^\s,]+/g) ?? [];
  // A possessive, as in `Corso's (2001)`, is no part of the last name.
  const last = tokens.pop();
  if (last !== undefined) tokens.push(last.replace(/(?<=.)['’]s$|(?<=s)['’]$/u, ""));
  let at = tokens.length - 1;
  let etAl = false;
  if (/^al\.?$/.test(tokens[at] ?? "") && tokens[at - 1] === "et") {
    etAl = true;
    at -= 2;
    if (tokens[at] === ",") at--;
  }
  // Collected backwards: each name's words, and what joins it to the next.
  const names: string[][] = [[]];
  const joins: string[] = [];
  let joinedByAnd = false;
  for (; at >= 0; at--) {
    const token = tokens[at]!;
    const bare = token.replace(/^["'“‘«„([{]+/u, "");
    if (token === "and" || token === "&") {
      if (names.at(-1)!.length === 0) break;
      joins.push(token);
      names.push([]);
      joinedByAnd = true;
    } else if (token === ",") {
      if (names.at(-1)!.length === 0 && joins.at(-1) !== undefined && !joins.at(-1)!.startsWith(",")) {
        joins.push(`, ${joins.pop()!}`);
      } else if ((joinedByAnd || etAl) && names.at(-1)!.length > 0) {
        // A sentence word before a comma is no member of a series.
        const earlier = tokens[at - 1] ?? "";
        if (SENTENCE_WORDS.has(fold(earlier))) break;
        joins.push(",");
        names.push([]);
      } else break;
    } else if (isCapitalWord(bare) || isInitials(bare) || isParticle(bare) || isConnector(bare)) {
      names.at(-1)!.unshift(bare);
      if (bare !== token) break;
    } else break;
  }
  // Drop a join that no name stands before.
  if (names.at(-1)!.length === 0) {
    names.pop();
    joins.pop();
  }
  const first = names.at(-1);
  if (!first) return undefined;
  while (first.length > 0 && (isConnector(first[0]!) || (first.length > 1 && SENTENCE_WORDS.has(fold(first[0]!))))) first.shift();
  if (first.length === 0 || (first.length === 1 && SENTENCE_WORDS.has(fold(first[0]!)))) {
    names.pop();
    joins.pop();
  }
  if (names.length === 0) return undefined;
  const ordered = names.reverse().map((n) => n.join(" "));
  if (!ordered.every(isName) && !known.wholes.has(fold(ordered.join(" ")))) return undefined;
  joins.reverse();
  const whole = ordered.reduce((all, name, i) => {
    const join = joins[i - 1]!;
    return i === 0 ? name : `${all}${join.startsWith(",") ? `${join} ` : ` ${join} `}${name}`;
  }, "");
  return { names: series(whole, etAl), whole, etAl };
}

/** Whether any name, or its last word, is a family name in some list. */
const anyKnown = (cited: Cited, known: Known): boolean =>
  [cited.whole, ...cited.whole.split(SERIES).filter((_, i) => i % 2 === 0)]
    .some((n) => known.families.has(fold(n)) || known.families.has(fold(words(n).at(-1) ?? "")));

// ---- Matching ----

const wholeNames = (entry: Authors): string[] => [entry.authors[0]!, ...(entry.alias ? [entry.alias] : [])];

const sameNames = (a: string[], b: string[]): boolean => a.length === b.length && a.every((n, i) => fold(n) === fold(b[i]!));

function matches(entry: Entry, cited: Cited, year: string, suffix: string): boolean {
  if (entry.status !== "read" || entry.year !== year || entry.suffix !== suffix) return false;
  const { names } = cited;
  if (cited.etAl) {
    if (!names) return false;
    const enough = entry.cutShort ? entry.authors.length >= names.length : entry.authors.length > names.length;
    return !entry.whole && enough && sameNames(entry.authors.slice(0, names.length), names);
  }
  if (entry.cutShort) return false;
  if (entry.whole && wholeNames(entry).some((n) => fold(n) === fold(cited.whole))) return true;
  return names !== undefined && sameNames(entry.authors, names);
}

/** Whether an entry that does not match could still be the one meant. */
function couldFit(entry: Entry, cited: Cited, year: string, suffix: string): boolean {
  const first = cited.names?.[0] ?? cited.whole;
  if (entry.status === "read") {
    return entry.whole && entry.year === year && entry.suffix === suffix && wholeNames(entry).some((n) => holdsWords(n, first));
  }
  if (!holdsWords(entry.couldBe, first)) return false;
  return /^\d/.test(year)
    ? new RegExp(`(?<![\\p{N}])${year}(?![\\p{N}])`, "u").test(entry.couldBe)
    : yearForms(entry.couldBe).some((y) => y.year === year);
}

const reference = (list: ReferenceList, entry: Entry): EntryRef => ({ file: list.file, paragraph: entry.paragraph, asFound: entry.asFound });

function link(cited: Cited, item: YearItem, own: ReferenceList | undefined, lists: ReferenceList[]):
  { candidates: Candidate[] } & ({ state: "linked"; entry: EntryRef } | { state: "unresolved"; reason: UnresolvedReason }) {
  const fits: Entry[] = own?.entries.filter((e) => matches(e, cited, item.year, item.suffix)) ?? [];
  const could = own?.entries.filter((e) => !fits.includes(e) && couldFit(e, cited, item.year, item.suffix)) ?? [];
  const candidates: Candidate[] = [
    ...fits.map((e): Candidate => ({ ...reference(own!, e), why: "matches" })),
    ...could.map((e): Candidate => ({ ...reference(own!, e), why: "could_fit" })),
    ...lists.filter((l) => l !== own).flatMap((l) => l.entries
      .filter((e) => matches(e, cited, item.year, item.suffix))
      .map((e): Candidate => ({ ...reference(l, e), why: "other_list" }))),
  ];
  if (own && fits.length === 1 && could.length === 0) return { state: "linked", entry: reference(own, fits[0]!), candidates };
  const reason: UnresolvedReason = !own ? "no_list" : fits.length > 1 ? "several_entries" : could.length > 0 ? "unread_entry" : "no_entry";
  return { state: "unresolved", reason, candidates };
}

// ---- Reading the project ----

type Reading =
  | { cited: { cited: Cited; prefix?: string; narrative: boolean; items: YearItem[] }[] }
  | { reason: UnlinkedReason; parts: PartReading[]; possibleNarrative: boolean };

function readBracket(text: string, pair: Pair, location: Location, known: Known): Reading {
  const raw = splitParts(pair.nested ? pair.own : text.slice(pair.start + 1, pair.end - 1));
  const parts = raw.map((part) => readPart(part, known));
  const yearsOnly = parts.every((p) => p.read === "years_only");
  const before = text.slice(0, pair.start);
  const narrative = yearsOnly && !pair.nested ? namesBefore(before, known) : undefined;
  const readable = narrative !== undefined && (narrative.etAl || anyKnown(narrative, known));
  const readings: PartReading[] = parts.map((p, i) => ({ text: raw[i]!.trim(), read: p.read }));
  const unlinked = (reason: UnlinkedReason): Reading => ({
    reason, parts: readings,
    possibleNarrative: reason === "no_author_form" && /(?<![\p{L}])\p{Lu}[\p{L}\p{M}'’-]*[.,]?["'”’]?\s*$/u.test(before),
  });
  if (location === "table") return unlinked("in_table");
  if (isDateRange(raw.map((p) => withoutMarkers(p).body))) return unlinked("year_range");
  if (yearsOnly) {
    if (pair.nested) return unlinked("unrecognized_form");
    if (!readable) return unlinked("no_author_form");
    return { cited: parts.map((p) => ({ cited: narrative!, narrative: true, items: (p as Extract<Part, { read: "years_only" }>).items })) };
  }
  if (!pair.nested && parts.every((p) => p.read === "citation")) {
    return {
      cited: (parts as Extract<Part, { read: "citation" }>[])
        .map((p) => ({ cited: p.cited, ...(p.prefix ? { prefix: p.prefix } : {}), narrative: false, items: p.items })),
    };
  }
  return unlinked(!pair.nested && parts.some((p) => p.read === "citation") ? "mixed_parts" : "unrecognized_form");
}

/** Fails unless every examined pair of brackets ended in exactly one state (BR-1523). */
export function checkAccount(result: AuthorDateResult, examined: number): void {
  const { counts, brackets } = result;
  const places = new Set(brackets.map((b) => JSON.stringify([b.file, b.paragraph, b.start])));
  const byReason = Object.values(counts.unlinkedByReason).reduce((a, b) => a + b, 0);
  if (counts.linked + counts.unresolved + counts.unlinked !== examined || counts.examined !== examined ||
      places.size !== examined || byReason !== counts.unlinked) {
    throw new Error(`the author-date account does not add up: ${examined} bracketed years examined, ` +
      `${counts.linked} linked, ${counts.unresolved} unresolved, ${counts.unlinked} left unlinked`);
  }
}

/** Reads the reference lists of every file in a project and accounts for every bracketed year outside them. */
export function matchAuthorDate(documents: Document[]): AuthorDateResult {
  if (new Set(documents.map((d) => d.file)).size !== documents.length) throw new Error("two documents have the same file name");
  const lists = documents.flatMap(readReferenceLists);
  const known: Known = { families: new Set(), wholes: new Set() };
  for (const entry of lists.flatMap((l) => l.entries)) {
    if (entry.status !== "read") continue;
    for (const name of entry.authors) known.families.add(fold(name));
    if (entry.whole) {
      for (const name of wholeNames(entry)) {
        known.families.add(fold(name));
        known.wholes.add(fold(name));
      }
    }
  }

  const brackets: Bracket[] = [];
  const unpaired: AuthorDateResult["unpaired"] = [];
  let examined = 0;
  for (const document of documents) {
    const own = lists.filter((l) => l.file === document.file);
    for (const [index, paragraph] of document.paragraphs.entries()) {
      const { text, location } = paragraph;
      // A list's start and its entries are not examined; notes, tables, and captions inside it are.
      if (location === "body" && own.some((l) => index >= l.start && index < l.end && (index === l.start || !l.subheadings.includes(index)))) continue;
      const serving = own.find((l) => index >= l.serves.from && index < l.serves.to);
      const found = pairs(text);
      unpaired.push(...found.unpaired.map((at) => ({ file: document.file, paragraph: index, start: at, end: at + 1, location })));
      for (const pair of found.pairs) {
        examined++;
        const place = { file: document.file, paragraph: index, start: pair.start, end: pair.end, location, text: text.slice(pair.start, pair.end) };
        const reading = readBracket(text, pair, location, known);
        if ("reason" in reading) {
          brackets.push({ ...place, state: "unlinked", ...reading });
          continue;
        }
        const items: CitationItem[] = reading.cited.flatMap((part) => part.items.map((item) => ({
          ...part.cited, ...item, narrative: part.narrative, ...(part.prefix ? { prefix: part.prefix } : {}),
          ...link(part.cited, item, serving, lists),
        })));
        brackets.push({ ...place, state: items.every((i) => i.state === "linked") ? "linked" : "unresolved", items });
      }
    }
  }

  const items = brackets.flatMap((b) => (b.state === "unlinked" ? [] : b.items));
  const count = <T>(all: T[], when: (value: T) => boolean) => all.filter(when).length;
  const result: AuthorDateResult = {
    profile: PROFILE, lists,
    files: documents.map((d) => ({ file: d.file, lists: count(lists, (l) => l.file === d.file) })),
    brackets, unpaired,
    counts: {
      examined,
      linked: count(brackets, (b) => b.state === "linked"),
      unresolved: count(brackets, (b) => b.state === "unresolved"),
      unlinked: count(brackets, (b) => b.state === "unlinked"),
      unlinkedByReason: Object.fromEntries(UNLINKED_REASONS.map((r) => [r, count(brackets, (b) => b.state === "unlinked" && b.reason === r)])) as Record<UnlinkedReason, number>,
      items: {
        linked: count(items, (i) => i.state === "linked"),
        unresolved: count(items, (i) => i.state === "unresolved"),
        unresolvedByReason: Object.fromEntries(UNRESOLVED_REASONS.map((r) => [r, count(items, (i) => i.state === "unresolved" && i.reason === r)])) as Record<UnresolvedReason, number>,
      },
    },
  };
  checkAccount(result, examined);
  return result;
}

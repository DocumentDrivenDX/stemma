// The reference-list reader: finds each file's lists and reads each entry's
// authors, year, and suffix (CONTRACT-003 H, "Reference lists"; SD-015
// BR-1521). When in doubt an entry is unread, because an entry read with too
// few authors could take another work's citations.
import type { Document } from "./document.ts";
import { isCapitalWord, isConnector, isInitials, isName, isParticle, MONTHS, SENTENCE_WORDS, words, fold, yearForms, type YearForm } from "./text.ts";

export type Layout = "after_authors" | "near_end";
export type UnreadReason = "no_year" | "authors" | "year_place" | "repeated_author" | "several_entries";
export type EntryFlag = "line_break" | "several_entries" | "continuation";

export interface Authors {
  /** Family names in order. A whole name is the only element. */
  authors: string[];
  /** A corporate author, or a single name with no comma and no initials. */
  whole: boolean;
  /** For a whole name printed as an abbreviation, the full name in brackets after it. */
  alias?: string;
  /** The entry says `et al.` or `and others`. */
  cutShort: boolean;
}

export type EntryReading =
  | (Authors & { status: "read"; year: string; suffix: string; layout: Layout })
  | { status: "unread"; why: UnreadReason };

export type Entry = EntryReading & {
  paragraph: number;
  asFound: string;
  flags: EntryFlag[];
  /** For an unread entry, the texts searched to decide whether it could be the one cited. */
  couldBe: string;
};

export interface ReferenceList {
  file: string;
  /** The paragraph taken as the start, and the first paragraph after the list. */
  start: number;
  end: number;
  title: string;
  /** The list serves the paragraphs from `from` up to `to`. */
  serves: { from: number; to: number };
  entries: Entry[];
  /** Lower-level headings inside the list, which are not entries. */
  subheadings: number[];
}

const REPEATED_AUTHOR = /^\s*(?:[—―⸺⸻]|(?:[-‐‑–_]\s?){2,})/;
const OPENING_QUOTE = /["“‘«„]|(?<=[\s,.])'/u;
const SUFFIX_NAME = /^(?:Jr|Sr|II|III|IV)\.?$/;

/** Editor marks are not names. */
const withoutEditorMarks = (text: string): string => text
  .replace(/\s*[([](?:[Ee]ds?\.?|[Ee]ditors?|Hrsg\.?)[)\]]/g, "")
  .replace(/,\s*(?:eds?|editors?|Hrsg)\b\.?(?=\s*(?:[,.(:"“‘']|\d|$))/g, "")
  .replace(/(?<=[\p{L}.])\s+eds?\.(?=\s*(?:[,(:"“‘']|\d|$))/gu, "");

const initialsOnly = (given: string): boolean => {
  const parts = words(given);
  return parts.length > 0 && parts.every((w) => /^(?:\p{Lu}\.?-?){1,3}$/u.test(w));
};

/** Given names: full names then initials, or initials alone; particles may close them. */
function isGiven(given: string): boolean {
  const parts = words(given);
  while (parts.length > 1 && isParticle(parts.at(-1)!)) parts.pop();
  if (parts.length === 0 || parts.length > 4) return false;
  if (initialsOnly(parts.join(" "))) return true;
  const firstInitial = parts.findIndex((w) => isInitials(w));
  const full = firstInitial < 0 ? parts : parts.slice(0, firstInitial);
  const rest = firstInitial < 0 ? [] : parts.slice(firstInitial);
  return full.length > 0 && full.length <= 3 && full.every(isCapitalWord) && rest.every(isInitials);
}

const isFamily = (family: string): boolean => {
  const parts = words(family);
  // `Adair J` is a name and bare initials, as some styles print them, not a family name.
  return isName(family) && parts.length <= 5 && !parts.some((w) => isInitials(w) || (parts.length > 1 && /^\p{Lu}{1,3}$/u.test(w))) &&
    !SENTENCE_WORDS.has(fold(parts[0]!));
};

/** `Given Family` or `I. Family`: the family name, and whether initials show it to be a person. */
function naturalOrder(segment: string): { family: string; initials: boolean } | undefined {
  const parts = words(segment);
  let from = parts.length - 1;
  if (from < 1 || !isCapitalWord(parts[from]!)) return undefined;
  while (from > 0 && isParticle(parts[from - 1]!)) from--;
  const given = parts.slice(0, from);
  if (given.length === 0 || !isGiven(given.join(" "))) return undefined;
  return { family: parts.slice(from).join(" "), initials: given.some(isInitials) };
}

function wholeName(text: string): boolean {
  const parts = words(text);
  if (parts.length === 0 || parts.length > 14 || parts.some(isInitials)) return false;
  if (SENTENCE_WORDS.has(fold(parts[0]!)) || !isCapitalWord(parts.at(-1)!) && !isParticle(parts[0]!)) return false;
  return parts.every((w, i) => isCapitalWord(w) || isParticle(w) || (i > 0 && (isConnector(w) || w === "and" || w === "&")));
}

const ABBREVIATED = /^(\p{Lu}[\p{Lu}&.-]*\p{Lu}\.?)\s+\(([^()]+)\)$/u;

/** One given name after initials, as in `I. Given`. */
const initialsThenGiven = (given: string): boolean => {
  const parts = words(given);
  const last = parts.at(-1) ?? "";
  return parts.length > 1 && parts.slice(0, -1).every(isInitials) && isCapitalWord(last) && !SENTENCE_WORDS.has(fold(last));
};

const CUT_SHORT = /,?\s*(?<![\p{L}])(?:et al\.?|and others)$/u;

/**
 * All of `text` read as a list of authors, or nothing. `beforeYear` says the year
 * follows this text directly, so no title can be part of it, and allows two more forms.
 */
function parseAuthors(text: string, beforeYear = false): Authors | undefined {
  let rest = text.trim();
  const cutShort = CUT_SHORT.test(rest);
  if (cutShort) rest = rest.replace(CUT_SHORT, "");
  if (/(?<![\p{L}])(?:with|et al)(?![\p{L}])/u.test(rest)) return undefined;
  const [, short, full] = ABBREVIATED.exec(rest) ?? [];
  if (short && full && words(full).length > 1 && wholeName(full)) {
    return { authors: [short], whole: true, alias: words(full).join(" "), cutShort };
  }
  if (!rest.includes(",") && !words(rest).some(isInitials)) {
    return wholeName(rest) ? { authors: [words(rest).join(" ")], whole: true, cutShort } : undefined;
  }
  const split = rest.split(/(\s*,\s*(?:(?:and\s+|&\s*))?|\s+(?:and\s+|&\s*))/);
  const segments = split.filter((_, i) => i % 2 === 0).map((s) => s.trim());
  const separators = split.filter((_, i) => i % 2 === 1);
  const joins = (separator: string | undefined) => /and|&/.test(separator ?? "");
  const [family, given] = segments;
  const givenReads = (g: string) => isGiven(g) || (beforeYear && initialsThenGiven(g) && (separators[1]?.includes(",") ?? true));
  if (!family || !given || joins(separators[0]) || !isFamily(family) || !givenReads(given)) return undefined;
  const authors = [family];
  for (let i = 2; i < segments.length; i++) {
    const segment = segments[i]!;
    if (SUFFIX_NAME.test(segment)) continue;
    const next = segments[i + 1];
    if (next !== undefined && !joins(separators[i]) && initialsOnly(next) && isFamily(segment)) {
      authors.push(segment);
      i++;
      continue;
    }
    const natural = naturalOrder(segment);
    // Two capitalized words after a comma may be a title. Only initials, `and`
    // here or later in the series, or `et al.` before the year show that they name a person.
    if (!natural || !(natural.initials || (beforeYear && cutShort) || separators.slice(i - 1).some(joins))) return undefined;
    authors.push(natural.family);
  }
  return { authors, whole: false, cutShort };
}

/** The text before a year form, read as authors. */
function authorsBefore(text: string): Authors | undefined {
  let before = withoutEditorMarks(text).replace(/[\s([,:;]+$/u, "");
  const last = words(before).at(-1) ?? "";
  if (last.endsWith(".") && !isInitials(last) && !/(?:et al|Jr|Sr)\.$/.test(before)) before = before.slice(0, -1);
  return parseAuthors(before, true);
}

const rangeFollows = (text: string, year: YearForm): boolean => /^\s*[-‐‑–—/]\s*(?:\d|present)/.test(text.slice(year.end));

function yearAfterAuthors(text: string): EntryReading | undefined {
  const year = yearForms(text)[0];
  if (!year || year.start === 0 || rangeFollows(text, year)) return undefined;
  const authors = authorsBefore(text.slice(0, year.start));
  return authors ? { status: "read", ...authors, year: year.year, suffix: year.suffix, layout: "after_authors" } : undefined;
}

/** What may not follow the authors: a joining word, in English or another language, or a second author after any punctuation. */
const ANOTHER_AUTHOR = /^[\s.,;:/…‐‑‒–—([-]*(?:(?:and|with|in collaboration|und|u|et|y|e|en|och|og|plus)(?![\p{L}‐-])|[&+|·]|\p{Lu}[\p{L}'’‐‑-]+,\s*\p{Lu}\.|(?:\p{Lu}\.[\s-]*)+\p{Lu}[\p{L}'’‐‑-]+\s*[,.;)])/iu;

/** Where the authors end in an entry whose year is not after them, and who they are. */
function leadingAuthors(text: string): { authors: Authors; end: number } | undefined {
  const quote = OPENING_QUOTE.exec(text)?.index ?? text.length;
  // A full stop that ends a word, as opposed to one that ends an initial.
  let stop = text.length;
  for (const m of text.matchAll(/[^\s,]+?\.(?=\s|$|["“‘'(])/gu)) {
    const word = m[0];
    if (isInitials(word) || /^(?:St|Jr|Sr|al)\.$/.test(word)) continue;
    stop = m.index + word.length - 1;
    break;
  }
  const limit = Math.min(quote, stop);
  const head = text.slice(0, limit);
  const done = (found: Authors | undefined, end: number) => {
    // Any sign of another author just past the end would mean one was left out.
    if (!found || ANOTHER_AUTHOR.test(text.slice(end))) return undefined;
    return { authors: found, end };
  };
  // Where the author text could end: at the limit, at a comma, or after an initial.
  const cuts = new Set<number>([limit]);
  for (const m of head.matchAll(/,/g)) cuts.add(m.index);
  for (const m of head.matchAll(/(?<![\p{L}])\p{Lu}\.(?=\s+(?![\s&]|and\s|\p{Lu}\.))/gu)) cuts.add(m.index + m[0].length);
  const readable = [...cuts].sort((a, b) => b - a);
  for (const cut of readable) {
    const found = parseAuthors(head.slice(0, cut).replace(/[\s,;:(]+$/u, ""));
    if (!found) continue;
    if (cut === limit) return done(found, cut);
    const after = head.slice(cut);
    if (after.startsWith(",")) {
      // A whole name ends at a comma only before a quoted title.
      if (found.whole && !(cut === head.trimEnd().length - 1 && quote < stop)) return undefined;
      // The comma ends the authors only if no name can follow it.
      const segment = after.slice(1).trim();
      const first = segment.split(",")[0]!.trim();
      if (/(?<![\p{L}])(?:and|with)(?![\p{L}])|&/u.test(segment) || words(first).some(isInitials) || naturalOrder(first)) return undefined;
      if (isFamily(first) && initialsOnly(segment.split(",")[1]?.trim() ?? "")) return undefined;
      return done(found, cut);
    }
    // After initials: only a space and then a title may follow.
    if (!/^\s+(?!\p{Lu}\.)[\p{L}\p{N}]/u.test(after) && !(cut + after.trimEnd().length === quote && /^\s+$/.test(after))) return undefined;
    if (!/(?<![\p{L}])\p{Lu}\.$/u.test(head.slice(0, cut))) return undefined;
    return done(found, cut);
  }
  return undefined;
}

const MONTH = [...MONTHS].join("|");
const BEFORE_END_YEAR = new RegExp(String.raw`[,:;.(\[]\s*(?:\d{1,2}\s+)?(?:(?:${MONTH})\s+(?:\d{1,2},\s*)?)?$`, "i");
const AFTER_END_YEAR = /^(?:[\s.,;:()[\]\-‐‑–—]|\d+(?:ff?(?!\p{L}))?|(?:pp?|vols?|nos?)\.|(?<![\p{L}])[ivxlc]+(?![\p{L}]))*$/iu;

function yearNearEnd(text: string): EntryReading {
  const trimmed = text
    .replace(/[[(]?\s*(?<![\p{L}])(?:last )?(?:accessed|retrieved)(?![\p{L}]).*$/isu, "")
    .replace(/(?:https?:\/\/|www\.|doi:\s*|(?<![\d.])10\.\d{4,}\/)\S+/giu, "");
  const forms = yearForms(trimmed);
  if (forms.length === 0) return { status: "unread", why: "no_year" };
  // A number in a page range, after `p.`, or after a colon that follows the year is a page.
  const years = forms.filter((y, i) => {
    const before = trimmed.slice(0, y.start);
    if (/(?<![\p{L}])pp?\.\s*$/u.test(before) || /\d\s*[-‐‑–—/]\s*$/.test(before) || rangeFollows(trimmed, y)) return false;
    return !(i > 0 && /:\s*$/.test(before) && /^\)?\s*:/.test(trimmed.slice(forms[i - 1]!.end)));
  });
  const found = leadingAuthors(withoutEditorMarks(trimmed));
  if (!found) return { status: "unread", why: "authors" };
  const year = years.at(-1);
  if (!year || !BEFORE_END_YEAR.test(trimmed.slice(0, year.start)) || !AFTER_END_YEAR.test(trimmed.slice(year.end))) {
    return { status: "unread", why: "year_place" };
  }
  return { status: "read", ...found.authors, year: year.year, suffix: year.suffix, layout: "near_end" };
}

/** Whether another entry that begins `Family, Given` starts after a line break or a sentence end. */
function holdsAnotherEntry(text: string): boolean {
  for (const m of text.matchAll(/(?:\n\s*|[.)\d]\s+)(?=\p{Lu}[^,.\n]{1,40},\s)/gu)) {
    // The full stop of an initial ends no sentence.
    if (!m[0].includes("\n") && /(?<![\p{L}])\p{Lu}\.$/u.test(text.slice(0, m.index + 1))) continue;
    const rest = text.slice(m.index + m[0].length);
    const reading = yearAfterAuthors(rest);
    if (reading?.status === "read" && !reading.whole && /^[^,]+,\s*(?:\p{Lu}\.|\p{Lu}\p{Ll})/u.test(rest)) return true;
  }
  return false;
}

/** One entry's authors, year, and suffix, in either layout. */
export function readEntry(text: string): EntryReading {
  const line = text.trim();
  if (REPEATED_AUTHOR.test(line)) return { status: "unread", why: "repeated_author" };
  if (holdsAnotherEntry(line)) return { status: "unread", why: "several_entries" };
  const flat = line.replace(/\s+/g, " ");
  return yearAfterAuthors(flat) ?? yearNearEnd(flat);
}

/** A paragraph that looks like the rest of the entry before it. */
function continues(text: string): boolean {
  const line = text.trim();
  if (REPEATED_AUTHOR.test(line)) return false;
  if (/^[^\p{L}]/u.test(line)) return true;
  const parts = words(line.split(/[,.;:]/)[0]!);
  if (!/^\p{Ll}/u.test(line) || /^(?:d['’]|al-|el-)\p{Lu}/u.test(line)) return false;
  const name = parts.findIndex((w) => !isParticle(w));
  return !(name > 0 && isCapitalWord(parts[name]!));
}

/** Whether a wrapped line holds a year or an author's initials, rather than only more of the title or an address. */
const addsToEntry = (text: string): boolean => {
  const plain = text.replace(/(?:https?:\/\/|www\.|doi:\s*)\S+/giu, "");
  return yearForms(plain).length > 0 || /(?<![\p{L}])\p{Lu}\./u.test(plain);
};

const isStart = (text: string): boolean => /^(?:references|bibliography)$/i.test(text.trim());

/** The reference lists of one file, with their entries kept as found. */
export function readReferenceLists(document: Document): ReferenceList[] {
  const { paragraphs } = document;
  const lists: ReferenceList[] = [];
  let open: { list: ReferenceList; level: number | undefined } | undefined;
  const close = (end: number) => {
    if (open) open.list.end = end;
    open = undefined;
  };
  for (const [index, paragraph] of paragraphs.entries()) {
    if (paragraph.location !== "body") continue;
    if (isStart(paragraph.text)) {
      close(index);
      const list: ReferenceList = {
        file: document.file, start: index, end: paragraphs.length, title: paragraph.text.trim(),
        serves: { from: 0, to: paragraphs.length }, entries: [], subheadings: [],
      };
      lists.push(list);
      open = { list, level: paragraph.headingLevel };
      continue;
    }
    if (!open) continue;
    const level = paragraph.headingLevel;
    if (level !== undefined) {
      if (open.level === undefined || level <= open.level) close(index);
      else open.list.subheadings.push(index);
      continue;
    }
    if (paragraph.text.trim() === "") continue;
    const reading = readEntry(paragraph.text);
    const previous = open.list.entries.at(-1);
    const flags: EntryFlag[] = [];
    if (paragraph.text.trim().includes("\n")) flags.push("line_break");
    if (reading.status === "unread" && reading.why === "several_entries") flags.push("several_entries");
    if (reading.status === "unread" && previous && continues(paragraph.text)) flags.push("continuation");
    let couldBe = paragraph.text;
    // A wrapped line that adds a name or a year is read with the line before it.
    if (flags.includes("continuation") && addsToEntry(paragraph.text)) couldBe = `${previous!.asFound} ${paragraph.text}`;
    if (reading.status === "unread" && reading.why === "repeated_author") {
      const named = open.list.entries.findLast((e) => !REPEATED_AUTHOR.test(e.asFound));
      if (named) couldBe = `${named.asFound} ${paragraph.text}`;
    }
    open.list.entries.push({ ...reading, paragraph: index, asFound: paragraph.text, flags, couldBe });
  }
  // One list serves its whole file. Of several, each serves the text between the one before it and itself.
  if (lists.length > 1) {
    let from = 0;
    for (const list of lists) {
      list.serves = { from, to: list.start };
      from = list.end;
    }
  }
  return lists;
}

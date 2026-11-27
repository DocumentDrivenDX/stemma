// meta.source, meta.resolver and id.resolves (CONTRACT-002 C; SD-007 BR-716 and
// BR-717): a source record's title, authors, year and venue against what the
// captured copy states and shows, and against saved catalogue lookups. They show
// disagreement; they do not decide which side is right.
import { type Corpus, idOf, isObject, isRetired, type JsonObject, type LoadedFile, toRoman } from "@stemma/records";
import { result } from "../findings.ts";
import { SourceTexts, type TextView } from "../matching/texts.ts";
import type { Evidence, Result } from "../report.ts";
import { byPerson, currentReview } from "../verification.ts";
import { active, listedSources, resolveCitations } from "./bibliography.ts";
import { sourceBinding } from "./changed.ts";
import { itemOf, subjectOf } from "./records.ts";

const list = (value: unknown): JsonObject[] => (Array.isArray(value) ? value.filter(isObject) : []);
const text = (value: unknown): string | undefined => (typeof value === "string" && value !== "" ? value : undefined);

/**
 * Case, diacritics, punctuation, line-end hyphens and white space are folded. A
 * letter followed by a digit is read as two words: in extracted text a note mark
 * often stands against a name, as in "Smith1".
 */
export const foldName = (value: string): string => value
  .replace(/(\p{L})[-‐]\s*\n\s*(?=\p{Ll})/gu, "$1")
  .normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
  .replace(/(?<=\p{L})(?=\p{N})/gu, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const holds = (within: string, words: string): boolean => words !== "" && ` ${within} `.includes(` ${words} `);
const mainTitle = (title: string): string => title.split(/(?<=\S)\s*[:.;]\s+/)[0]!;

/** Equal, or one is the other's main title before a colon or full stop. */
export function titlesMatch(a: string, b: string): boolean {
  const [x, y] = [foldName(a), foldName(b)];
  return x === y || x === foldName(mainTitle(b)) || foldName(mainTitle(a)) === y;
}

/**
 * A library files a body under the body it belongs to, as "Parent (Place). Body".
 * Such a heading says the same name as "Body of Parent" or "Body of the Parent",
 * and as no other: every word of both parts is needed, in these two orders.
 */
export function headingMatches(name: string, heading: string): boolean {
  const filed = /^([^,.()]+?)\s*(?:\([^()]*\))?\.\s+([^,.()]+?)\.?$/.exec(heading.trim());
  if (!filed) return false;
  const [, parent, body] = filed;
  return [`${body} of ${parent}`, `${body} of the ${parent}`].some((spoken) => foldName(spoken) === foldName(name));
}

/**
 * Whether every name the record gives is among the names stated. A body's name,
 * written whole in the record, may also be stated as a library heading.
 */
const namesWithin = (record: Described, stated: string[]): boolean => {
  const words = foldName(stated.join(" "));
  return record.authors.every((a) => holds(words, foldName(a)) || (record.bodies.includes(a) && stated.some((s) => headingMatches(a, s))));
};

/**
 * A title as a catalogue states it. A part of a collected work may be entered as
 * the collective title and then its own; both must be the record's, whole.
 */
export function catalogueTitleMatches(record: { title?: string; collection?: string }, theirs: string): boolean {
  if (record.title === undefined) return false;
  return titlesMatch(record.title, theirs)
    || (record.collection !== undefined && foldName(`${record.collection} ${record.title}`) === foldName(theirs));
}

/**
 * The volume statement of an Internet Archive item, such as "v.10 (1878-1880)".
 * Such an item is one volume of a set or serial, and its catalogue date is often
 * the set's first year, copied to every volume. Other catalogues give a volume
 * number with the work's own date, so only this one is read.
 */
function setVolume(lookup: JsonObject): { stated: string; from?: number; to?: number } | undefined {
  if (lookup.resolver !== "internet_archive" || typeof lookup.response !== "string") return undefined;
  let value: unknown;
  try {
    value = JSON.parse(lookup.response);
  } catch {
    return undefined;
  }
  const stated = isObject(value) ? text(value.volume) : undefined;
  if (!stated) return undefined;
  // Years of coverage in closing parentheses: the first and the last four-digit year there.
  const years = /\(([^()]*)\)\s*$/.exec(stated)?.[1]?.match(/(?<!\d)1[5-9]\d\d(?!\d)|(?<!\d)20\d\d(?!\d)/g) ?? [];
  return years.length > 0 ? { stated, from: Number(years[0]), to: Number(years.at(-1)) } : { stated };
}

const FIELDS = ["title", "authors", "year", "venue"] as const;
type Field = (typeof FIELDS)[number];

export interface Described {
  title?: string; authors: string[]; year?: string; venue?: string;
  /** The names among the authors that the record writes whole, as a body's is. */
  bodies: string[];
  /** The title of the collection or series the work belongs to. */
  collection?: string;
}

/** What the source record says. */
export function describe(source: JsonObject): Described {
  const title = isObject(source.title) ? text(source.title.value) : undefined;
  const names = list(source.contributions).filter((c) => c.role === "author" || c.role === "editor")
    .map((c) => (isObject(c.as_printed) ? c.as_printed : {}));
  const authors = names.flatMap((name) => text(name.family) ?? text(name.literal) ?? []);
  const bodies = names.flatMap((name) => (text(name.family) === undefined ? text(name.literal) ?? [] : []));
  const year = isObject(source.issued) ? /\d{4}/.exec(String(source.issued.edtf ?? ""))?.[0] : undefined;
  const bib = (name: string) => {
    const field = list(source.bib).find((b) => b.name === name);
    return field && isObject(field.value) ? text(field.value.value) : undefined;
  };
  const venue = bib("container-title");
  const collection = bib("collection-title");
  return {
    ...(title ? { title } : {}), authors, bodies, ...(year ? { year } : {}), ...(venue ? { venue } : {}),
    ...(collection ? { collection } : {}),
  };
}

const meta = (name: string, value: string): Evidence => ({ name, class: "metadata", value });
const location = (name: string, value: string): Evidence => ({ name, class: "location", value });

type Status = "agrees" | "differs" | "not_found";

/** The parts that show the title page: those the copy's identity names, else the first two with text. */
function titlePages(view: TextView): { indexes: number[]; text: string } {
  const identity = isObject(view.loaded.manifest.data!.identity) ? view.loaded.manifest.data!.identity : {};
  const named = Array.isArray(identity.title_pages) ? identity.title_pages.map(Number) : [];
  const parts = named.length > 0 ? view.parts.filter((p) => named.includes(p.index))
    : view.parts.filter((p) => p.streams.main !== "" || p.streams.furniture !== "").slice(0, 2);
  return { indexes: parts.map((p) => p.index), text: foldName(parts.map((p) => `${p.streams.furniture}\n${p.streams.main}`).join("\n")) };
}

/** One record against one copy: its stated identity, and its title page text. */
export function againstCopy(record: Described, view: TextView): { statuses: Map<Field, Status>; evidence: Evidence[] } {
  const identity = isObject(view.loaded.manifest.data!.identity) ? view.loaded.manifest.data!.identity : {};
  const pages = titlePages(view);
  const statuses = new Map<Field, Status>();
  const evidence: Evidence[] = [
    location("source_text", view.loaded.manifest.path),
    ...(typeof identity.basis === "string" ? [meta("identity_basis", identity.basis)] : []),
    meta("title_page_parts", `index ${pages.indexes.join(", ")}`),
  ];
  const stated = {
    title: text(identity.title), authors: (Array.isArray(identity.contributors) ? identity.contributors : []).map(String),
    year: /\d{4}/.exec(String(identity.issued ?? ""))?.[0], venue: text(identity.venue),
  };
  const judge = (field: Field, value: string, byIdentity: boolean | undefined, onPage: boolean, copySays: string | undefined) => {
    const status: Status = byIdentity === true || onPage ? "agrees" : byIdentity === false ? "differs" : "not_found";
    statuses.set(field, status);
    evidence.push(meta(`${field}_in_record`, value));
    if (status === "differs") evidence.push({ name: `${field}_the_copy_states`, class: "source_text", value: copySays! });
    evidence.push(meta(`${field}_result`, status === "agrees"
      ? [byIdentity === true ? "agrees with what the copy states" : "", onPage ? "found on the title page" : ""].filter(Boolean).join("; ")
      : status === "differs" ? "the copy states otherwise, and the title page text does not show the record's value" : "not found in what the copy states or in its title page text"));
  };
  if (record.title) {
    judge("title", record.title, stated.title === undefined ? undefined : titlesMatch(record.title, stated.title), holds(pages.text, foldName(record.title)), stated.title);
  }
  if (record.authors.length > 0) {
    const byIdentity = stated.authors.length === 0 ? undefined : namesWithin(record, stated.authors);
    judge("authors", record.authors.join("; "), byIdentity, record.authors.every((a) => holds(pages.text, foldName(a))), stated.authors.join("; "));
  }
  if (record.year) judge("year", record.year, stated.year === undefined ? undefined : stated.year === record.year,
      // A title page may print its year as a roman numeral.
      holds(pages.text, record.year) || holds(pages.text, toRoman(Number(record.year))), stated.year);
  if (record.venue) {
    judge("venue", record.venue, stated.venue === undefined ? undefined : titlesMatch(record.venue, stated.venue), holds(pages.text, foldName(record.venue)), stated.venue);
  }
  return { statuses, evidence };
}

/** Sources with a source file, and sources that would enter the bibliography. */
export function describedSources(corpus: Corpus, texts: SourceTexts): LoadedFile[] {
  const used = new Set([...resolveCitations(corpus).flatMap((r) => r.matches), ...listedSources(corpus)].map(idOf));
  return active(corpus, "source").filter((s) => used.has(idOf(s)) || texts.idsOf(idOf(s)!).length > 0);
}

/** A person's current review of the source details that covers every field left open (FR-30). */
function confirmation(corpus: Corpus, source: LoadedFile, fields: Field[]): string | undefined {
  const binding = sourceBinding(source.data!);
  const found = active(corpus, "text_review").find((r) => {
    const data = r.data!;
    const loaded = corpus.texts.get(String(data.text));
    const covered = (Array.isArray(data.fields) ? data.fields : []).map(String);
    return data.source === idOf(source) && data.scope === "source_details" && data.outcome === "agrees" && byPerson(data)
      && data.source_record_sha256 === binding && loaded !== undefined && currentReview(data, loaded) && fields.every((f) => covered.includes(f));
  });
  return found && idOf(found);
}

const confirmed = (result_: Result, review: string | undefined): Result =>
  review ? { ...result_, confirmed_by: review, open: false } : result_;

const shared = (check: string, source: LoadedFile) => ({
  check, subject: subjectOf(source), source: idOf(source)!, item: itemOf(source), locus: check,
});
const keyOf = (source: LoadedFile) => meta("key", String(source.data!.citation_key ?? idOf(source)));

export function sourceMetaResults(corpus: Corpus, texts = new SourceTexts(corpus)): Result[] {
  const check = "meta.source";
  // It compares with a captured copy, so it applies where there is one. A cited source with none is source.held's finding.
  return describedSources(corpus, texts).filter((s) => texts.idsOf(idOf(s)!).length > 0).map((source) => {
    const base = [location("source_file", source.path), keyOf(source)];
    const { views } = texts.of(idOf(source)!);
    if (views.length === 0) return result({ ...shared(check, source), outcome: "unverifiable", reason: "source_damaged", evidence: base });
    const record = describe(source.data!);
    // The copy that bears the record out best is shown: a source may have several.
    const judged = views.map((v) => againstCopy(record, v)).sort((a, b) => score(a.statuses) - score(b.statuses))[0]!;
    const evidence = [...base, ...judged.evidence];
    const differing = [...judged.statuses].filter(([, s]) => s === "differs").map(([f]) => f);
    if (differing.length > 0) return result({ ...shared(check, source), outcome: "fail", reason: "mismatch", evidence });
    if (!record.title) return result({ ...shared(check, source), outcome: "unverifiable", reason: "nothing_to_compare", evidence });
    const missing = [...judged.statuses].filter(([, s]) => s === "not_found").map(([f]) => f);
    if (missing.length === 0) return result({ ...shared(check, source), outcome: "pass", evidence });
    return confirmed(result({ ...shared(check, source), outcome: "unverifiable", reason: "not_found_in_copy", evidence: [...evidence, meta("not_found", missing.join(", "))] }),
      confirmation(corpus, source, missing));
  });
}

const score = (statuses: Map<Field, Status>) => [...statuses.values()].reduce((n, s) => n + (s === "differs" ? 100 : s === "not_found" ? 1 : 0), 0);

const lookupsOf = (corpus: Corpus, source: string): LoadedFile[] =>
  active(corpus, "resolution").filter((r) => r.data!.source === source)
    .sort((a, b) => String(b.data!.queried_at).localeCompare(String(a.data!.queried_at)) || (a.path < b.path ? -1 : 1));

const identifierKey = (value: unknown): string => (isObject(value) ? `${String(value.scheme).toLowerCase()}:${String(value.value).toLowerCase()}` : "");

/** The newest lookup for each identifier. */
const newest = (lookups: LoadedFile[]): LoadedFile[] => {
  const seen = new Map<string, LoadedFile>();
  for (const l of lookups) {
    const key = `${String(l.data!.resolver)} ${identifierKey(l.data!.identifier)}`;
    if (!seen.has(key)) seen.set(key, l);
  }
  return [...seen.values()];
};

export function resolverResults(corpus: Corpus, texts = new SourceTexts(corpus)): Result[] {
  const check = "meta.resolver";
  const copyShowsYear = (source: LoadedFile, record: Described) =>
    texts.of(idOf(source)!).views.some((view) => againstCopy(record, view).statuses.get("year") === "agrees");
  return describedSources(corpus, texts).map((source) => {
    const base = [location("source_file", source.path), keyOf(source)];
    const found = newest(lookupsOf(corpus, idOf(source)!)).filter((l) => l.data!.outcome === "found" && isObject(l.data!.found));
    if (found.length === 0) return result({ ...shared(check, source), outcome: "unverifiable", reason: "no_lookup", evidence: base });
    const record = describe(source.data!);
    const compared = new Set<Field>();
    const differing = new Set<Field>();
    // A year that a lookup of one volume of a set does not give, and that nothing here shows.
    let yearOpen = false;
    const evidence: Evidence[] = [...base];
    for (const lookup of found) {
      const says = lookup.data!.found as JsonObject;
      const catalogue = {
        title: text(says.title), authors: (Array.isArray(says.contributors) ? says.contributors : []).map(String),
        year: /\d{4}/.exec(String(says.issued ?? ""))?.[0], venue: text(says.venue),
      };
      evidence.push(location("lookup_file", lookup.path), meta("looked_up", `${String(lookup.data!.resolver)} on ${String(lookup.data!.queried_at).slice(0, 10)}`));
      const judge = (field: Field, mine: string | undefined, theirs: string, same: () => boolean) => {
        if (mine === undefined) return;
        if (theirs === "") {
          evidence.push(meta(`${field}_not_compared`, "this lookup does not state it"));
          return;
        }
        compared.add(field);
        if (!same()) {
          differing.add(field);
          evidence.push(meta(`${field}_in_record`, mine), { name: `${field}_in_lookup`, class: "source_text", value: theirs });
        }
      };
      judge("title", record.title, catalogue.title ?? "", () => catalogueTitleMatches(record, catalogue.title!));
      judge("authors", record.authors.length > 0 ? record.authors.join("; ") : undefined, catalogue.authors.join("; "),
        () => namesWithin(record, catalogue.authors));
      const set = setVolume(lookup.data!);
      // A volume cannot be dated before its set began, so only a later year can be the volume's own.
      if (set && record.year && catalogue.year && Number(record.year) > Number(catalogue.year)) {
        const dated = `the catalogue dates this item ${catalogue.year}, and it is the volume "${set.stated}" of a set`;
        if (set.to !== undefined) {
          // The volume statement gives the years the volume covers: it is dated when they end.
          if (set.from! >= Number(catalogue.year) && Number(record.year) === set.to) {
            compared.add("year");
            evidence.push(meta("year_of_volume", `${dated}; the record's year is the last year the volume statement gives`));
          } else judge("year", record.year, `${catalogue.year}; volume ${set.stated}`, () => false);
        } else if (copyShowsYear(source, record) || confirmation(corpus, source, ["year"])) {
          evidence.push(meta("year_not_compared", `${dated}, with no years for the volume; the record's year is borne out by the copy's title page or a person's review`));
        } else {
          yearOpen = true;
          evidence.push(meta("year_in_record", record.year), meta("year_not_compared", `${dated}, with no years for the volume, and the copy's title page text does not show the record's year`));
        }
      } else judge("year", record.year, catalogue.year ?? "", () => record.year === catalogue.year);
      judge("venue", record.venue, catalogue.venue ?? "", () => titlesMatch(record.venue!, catalogue.venue!));
    }
    if (differing.size > 0) return result({ ...shared(check, source), outcome: "fail", reason: "mismatch", evidence });
    evidence.push(meta("compared", [...compared].join(", ") || "nothing"));
    if (yearOpen) return result({ ...shared(check, source), outcome: "unverifiable", reason: "set_date", evidence });
    if (compared.has("title")) return result({ ...shared(check, source), outcome: "pass", evidence });
    return confirmed(result({ ...shared(check, source), outcome: "unverifiable", reason: "lookup_silent", evidence }), confirmation(corpus, source, ["title"]));
  });
}

export const identifiedSources = (corpus: Corpus, texts: SourceTexts) => describedSources(corpus, texts)
  .filter((s) => list(s.data!.identifiers).length > 0);

export function identifierResults(corpus: Corpus, texts = new SourceTexts(corpus)): Result[] {
  const check = "id.resolves";
  return identifiedSources(corpus, texts).flatMap((source) => list(source.data!.identifiers).map((identifier) => {
    const name = `${String(identifier.scheme)}:${String(identifier.value)}`;
    const base = [location("source_file", source.path), keyOf(source), meta("identifier", name)];
    const parts = { ...shared(check, source), locus: name };
    const lookup = lookupsOf(corpus, idOf(source)!).find((l) => identifierKey(l.data!.identifier) === identifierKey(identifier));
    if (!lookup || isRetired(lookup.data!)) return result({ ...parts, outcome: "unverifiable", reason: "no_lookup", evidence: base });
    const evidence = [...base, location("lookup_file", lookup.path), meta("looked_up", `${String(lookup.data!.resolver)} on ${String(lookup.data!.queried_at).slice(0, 10)}`)];
    if (lookup.data!.outcome === "not_found") return result({ ...parts, outcome: "fail", reason: "not_found", evidence });
    if (lookup.data!.outcome !== "found") return result({ ...parts, outcome: "unverifiable", reason: "lookup_error", evidence });
    const theirs = isObject(lookup.data!.found) ? text(lookup.data!.found.title) : undefined;
    const mine = describe(source.data!).title;
    if (!theirs || !mine) return result({ ...parts, outcome: "unverifiable", reason: "lookup_silent", evidence });
    if (catalogueTitleMatches(describe(source.data!), theirs)) return result({ ...parts, outcome: "pass", evidence });
    return result({ ...parts, outcome: "fail", reason: "other_work", evidence: [...evidence, meta("title_in_record", mine), { name: "title_in_lookup", class: "source_text", value: theirs }] });
  }));
}

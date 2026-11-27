// meta.source, meta.resolver and id.resolves (CONTRACT-002 C; SD-007 BR-716 and
// BR-717): a source record's title, authors, year and venue against what the
// captured copy states and shows, and against saved catalogue lookups. A
// disagreement is a problem; the checks do not decide which side is right. A
// detail that nothing here shows or contradicts is coverage: it is reported and
// asks nothing of anyone. What a model says it read is not evidence here.
import { type Corpus, fromRoman, idOf, isObject, isRetired, type JsonObject, type LoadedFile, toRoman } from "@stemma/records";
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

/** What one saved lookup says of one field of the record. */
export interface Said {
  field: Field;
  verdict: "agrees" | "differs" | "silent" | "set_date";
  mine: string;
  theirs: string;
  /** How a year that is not the catalogue's own agrees or cannot be told. */
  note?: string;
}

/** One record against one saved lookup, from the two alone. */
export function compareLookup(record: Described, lookup: JsonObject): Said[] {
  const says = lookup.found as JsonObject;
  const catalogue = {
    title: text(says.title), authors: (Array.isArray(says.contributors) ? says.contributors : []).map(String),
    year: /\d{4}/.exec(String(says.issued ?? ""))?.[0], venue: text(says.venue),
  };
  const out: Said[] = [];
  const judge = (field: Field, mine: string | undefined, theirs: string, same: () => boolean) => {
    if (mine !== undefined) out.push({ field, mine, theirs, verdict: theirs === "" ? "silent" : same() ? "agrees" : "differs" });
  };
  judge("title", record.title, catalogue.title ?? "", () => catalogueTitleMatches(record, catalogue.title!));
  judge("authors", record.authors.length > 0 ? record.authors.join("; ") : undefined, catalogue.authors.join("; "),
    () => namesWithin(record, catalogue.authors));
  const set = setVolume(lookup);
  // A volume cannot be dated before its set began, so only a later year can be the volume's own.
  if (set && record.year && catalogue.year && Number(record.year) > Number(catalogue.year)) {
    const dated = `the catalogue dates this item ${catalogue.year}, and it is the volume "${set.stated}" of a set`;
    const said = { field: "year" as const, mine: record.year, theirs: `${catalogue.year}; volume ${set.stated}` };
    if (set.to === undefined) out.push({ ...said, verdict: "set_date", note: `${dated}, with no years for the volume` });
    // The volume statement gives the years the volume covers: it is dated when they end.
    else if (set.from! >= Number(catalogue.year) && Number(record.year) === set.to) {
      out.push({ ...said, verdict: "agrees", note: `${dated}; the record's year is the last year the volume statement gives` });
    } else out.push({ ...said, verdict: "differs" });
  } else judge("year", record.year, catalogue.year ?? "", () => record.year === catalogue.year);
  judge("venue", record.venue, catalogue.venue ?? "", () => titlesMatch(record.venue!, catalogue.venue!));
  return out;
}

const foundLookups = (corpus: Corpus, source: string): LoadedFile[] =>
  newest(lookupsOf(corpus, source)).filter((l) => l.data!.outcome === "found" && isObject(l.data!.found));

const lookupName = (lookup: LoadedFile): string => {
  const identifier = isObject(lookup.data!.identifier) ? lookup.data!.identifier : {};
  return `the ${String(lookup.data!.resolver)} record of ${String(identifier.scheme)}:${String(identifier.value)} (${idOf(lookup)})`;
};

/**
 * The saved catalogue records that bear out one field: independent of the
 * recognized text. None counts if any of them gives something else.
 */
function corroboration(corpus: Corpus, source: string, record: Described, field: Field): string[] {
  const said = foundLookups(corpus, source).flatMap((lookup) => compareLookup(record, lookup.data!).filter((s) => s.field === field).map((s) => ({ ...s, lookup })));
  if (said.some((s) => s.verdict === "differs")) return [];
  return said.filter((s) => s.verdict === "agrees").map((s) => lookupName(s.lookup));
}

/** A line of the report's coverage summary. Findings that share one are listed together. */
const coverageLine = (value: string): Evidence => meta("coverage", value);

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
function titlePages(view: TextView): { indexes: number[]; text: string; raw: string } {
  const identity = isObject(view.loaded.manifest.data!.identity) ? view.loaded.manifest.data!.identity : {};
  const named = Array.isArray(identity.title_pages) ? identity.title_pages.map(Number) : [];
  const parts = named.length > 0 ? view.parts.filter((p) => named.includes(p.index))
    : view.parts.filter((p) => p.streams.main !== "" || p.streams.furniture !== "").slice(0, 2);
  const raw = parts.map((p) => `${p.streams.furniture}\n${p.streams.main}`).join("\n");
  return { indexes: parts.map((p) => p.index), text: foldName(raw), raw };
}

/**
 * A roman numeral of the year as recognition commonly misreads it: an I read as
 * i, r, l, 1, | or !. The whole token has to read as this year's numeral and no other.
 */
export function misreadRoman(text: string, year: number): string | undefined {
  const wanted = toRoman(year).toUpperCase();
  return (text.match(/(?<![\p{L}\p{N}])M[MDCLXVIirl1|!]{3,}(?![\p{L}\p{N}])/gu) ?? [])
    .find((token) => token.replace(/[irl1|!]/g, "I") === wanted);
}

/**
 * The years a title page gives where an imprint gives its year: a line that is a
 * year, or ends with one after a comma, colon or semicolon. A year inside a line,
 * as in a span of years or a library stamp, is not read as the year of the work.
 */
export function imprintYears(text: string): string[] {
  return text.split("\n").flatMap((line) => {
    const figures = /(?:^|[,:;])\s*((?:1[5-9]|20)\d\d)\s*\.?\s*$/.exec(line.trim())?.[1];
    const numeral = /^(M[DCLXVI]{3,})\s*\.?$/.exec(line.trim())?.[1];
    const roman = numeral ? fromRoman(numeral.toLowerCase()) : undefined;
    return figures ? [figures] : roman !== undefined && roman >= 1500 && roman <= 2099 ? [String(roman)] : [];
  });
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
  const judge = (field: Field, value: string, byIdentity: boolean | undefined, onPage: boolean, copySays: string | undefined, asRead?: string) => {
    const status: Status = byIdentity === true || onPage ? "agrees" : byIdentity === false || copySays !== undefined && byIdentity === undefined ? "differs" : "not_found";
    statuses.set(field, status);
    evidence.push(meta(`${field}_in_record`, value));
    if (status === "differs") evidence.push({ name: `${field}_the_copy_states`, class: "source_text", value: copySays! });
    evidence.push(meta(`${field}_result`, status === "agrees"
      ? [byIdentity === true ? "agrees with what the copy states" : "", onPage ? asRead ?? "found on the title page" : ""].filter(Boolean).join("; ")
      : status === "differs" ? "the copy states otherwise, and the title page text does not show the record's value" : "not found in what the copy states or in its title page text"));
  };
  if (record.title) {
    judge("title", record.title, stated.title === undefined ? undefined : titlesMatch(record.title, stated.title), holds(pages.text, foldName(record.title)), stated.title);
  }
  if (record.authors.length > 0) {
    const byIdentity = stated.authors.length === 0 ? undefined : namesWithin(record, stated.authors);
    // A copy that names no author states nothing against the record's.
    judge("authors", record.authors.join("; "), byIdentity, record.authors.every((a) => holds(pages.text, foldName(a))), stated.authors.join("; ") || undefined);
  }
  if (record.year) {
    // A title page may print its year as a roman numeral.
    const plain = holds(pages.text, record.year) || holds(pages.text, toRoman(Number(record.year)));
    const misread = plain ? undefined : misreadRoman(pages.raw, Number(record.year));
    const shown = plain || misread !== undefined;
    // Failing that, an imprint line giving another year contradicts the record.
    const other = !shown && stated.year === undefined ? imprintYears(pages.raw).join("; ") || undefined : stated.year;
    judge("year", record.year, stated.year === undefined ? undefined : stated.year === record.year, shown, other,
      misread === undefined ? undefined : `found on the title page, in the roman numeral recognized as "${misread}"`);
  }
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
    if (!record.title) return result({ ...shared(check, source), outcome: "unverifiable", reason: "nothing_to_compare", evidence, coverage: true });
    const unshown = [...judged.statuses].filter(([, s]) => s === "not_found").map(([f]) => f);
    const missing: Field[] = [];
    for (const field of unshown) {
      const by = corroboration(corpus, idOf(source)!, record, field);
      if (by.length === 0) missing.push(field);
      else {
        evidence.push(meta(`${field}_corroborated_by`, by.join("; ")),
          coverageLine(`the title page text does not show the ${field}; a saved catalogue record bears it out`));
      }
    }
    if (missing.length === 0) return result({ ...shared(check, source), outcome: "pass", evidence });
    const open = [...evidence, meta("not_found", missing.join(", ")),
      coverageLine(`not corroborated: neither the title page text nor a saved catalogue record shows the ${missing.join(" or the ")}`)];
    return confirmed(result({ ...shared(check, source), outcome: "unverifiable", reason: "not_found_in_copy", evidence: open, coverage: true }),
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
    const found = foundLookups(corpus, idOf(source)!);
    if (found.length === 0) {
      return result({ ...shared(check, source), outcome: "unverifiable", reason: "no_lookup", coverage: true,
        evidence: [...base, coverageLine("not compared with a catalogue: no lookup that found the work is saved")] });
    }
    const record = describe(source.data!);
    const compared = new Set<Field>();
    const differing = new Set<Field>();
    // A year that a lookup of one volume of a set does not give, and that nothing else here shows.
    let yearOpen = false;
    const evidence: Evidence[] = [...base];
    for (const lookup of found) {
      evidence.push(location("lookup_file", lookup.path), meta("looked_up", `${String(lookup.data!.resolver)} on ${String(lookup.data!.queried_at).slice(0, 10)}`));
      for (const said of compareLookup(record, lookup.data!)) {
        const { field } = said;
        if (said.verdict === "silent") evidence.push(meta(`${field}_not_compared`, "this lookup does not state it"));
        else if (said.verdict === "set_date") {
          if (copyShowsYear(source, record)) {
            evidence.push(meta("year_not_compared", `${said.note}; the record's year is on the copy's title page`));
          } else {
            yearOpen = true;
            evidence.push(meta("year_in_record", said.mine), meta("year_not_compared", `${said.note}, and the copy's title page text does not show the record's year`));
          }
        } else {
          compared.add(field);
          if (said.note) evidence.push(meta("year_of_volume", said.note));
          if (said.verdict === "differs") {
            differing.add(field);
            evidence.push(meta(`${field}_in_record`, said.mine), { name: `${field}_in_lookup`, class: "source_text", value: said.theirs });
          }
        }
      }
    }
    if (differing.size > 0) return result({ ...shared(check, source), outcome: "fail", reason: "mismatch", evidence });
    evidence.push(meta("compared", [...compared].join(", ") || "nothing"));
    const open = (reason: string, line: string, fields: Field[]) => confirmed(
      result({ ...shared(check, source), outcome: "unverifiable", reason, evidence: [...evidence, coverageLine(line)], coverage: true }),
      confirmation(corpus, source, fields));
    if (yearOpen) return open("set_date", "not corroborated: the catalogue gives only the date of the set a volume belongs to, and the title page text does not show the year", ["year"]);
    if (compared.has("title")) return result({ ...shared(check, source), outcome: "pass", evidence });
    return open("lookup_silent", "not compared with a catalogue: the saved lookups state no title", ["title"]);
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
    const uncompared = (reason: string, line: string, evidence: Evidence[]) =>
      result({ ...parts, outcome: "unverifiable", reason, evidence: [...evidence, coverageLine(line)], coverage: true });
    if (!lookup || isRetired(lookup.data!)) return uncompared("no_lookup", "identifiers with no saved lookup", base);
    const evidence = [...base, location("lookup_file", lookup.path), meta("looked_up", `${String(lookup.data!.resolver)} on ${String(lookup.data!.queried_at).slice(0, 10)}`)];
    if (lookup.data!.outcome === "not_found") return result({ ...parts, outcome: "fail", reason: "not_found", evidence });
    if (lookup.data!.outcome !== "found") return uncompared("lookup_error", "identifiers whose saved lookup could not be read", evidence);
    const theirs = isObject(lookup.data!.found) ? text(lookup.data!.found.title) : undefined;
    const mine = describe(source.data!).title;
    if (!theirs || !mine) return uncompared("lookup_silent", "identifiers with no title on one side to compare", evidence);
    if (catalogueTitleMatches(describe(source.data!), theirs)) return result({ ...parts, outcome: "pass", evidence });
    return result({ ...parts, outcome: "fail", reason: "other_work", evidence: [...evidence, meta("title_in_record", mine), { name: "title_in_lookup", class: "source_text", value: theirs }] });
  }));
}

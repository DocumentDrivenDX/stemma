// The subset of preserved native fields that becomes source record fields
// (CONTRACT-003 D, SD-003). Names follow the CSL-JSON projection. Nothing is
// guessed: a value this cannot read stays preserved and unmapped.
import { digest, isObject, type Json, type JsonObject } from "@stemma/records";
import { MONTH_MACROS } from "./legacy-biblatex.ts";
import { type LegacyFormat, looksLocal, type ParsedField } from "./legacy.ts";
import { splitOuter, texToText } from "./legacy-tex.ts";

export interface NameParts { family?: string; given?: string; particle?: string; suffix?: string; literal?: string }

export interface Mapped {
  /** Source record fields, ready to merge into a record. */
  record: JsonObject;
  /** For each native field by index, the record path that received it. */
  paths: Map<number, string>;
  losses: { index: number; class: "unrepresented" | "approximated"; note: string }[];
  /** Set when the native type has no CSL counterpart. */
  unrecognizedType: boolean;
}

const BIBLATEX_TYPES: Record<string, string> = {
  article: "article-journal", book: "book", mvbook: "book", collection: "book", mvcollection: "book", proceedings: "book",
  mvproceedings: "book", reference: "book", manual: "book", inbook: "chapter", incollection: "chapter", bookinbook: "chapter",
  suppbook: "chapter", inproceedings: "paper-conference", conference: "paper-conference", inreference: "entry",
  thesis: "thesis", phdthesis: "thesis", mastersthesis: "thesis", report: "report", techreport: "report",
  online: "webpage", electronic: "webpage", www: "webpage", dataset: "dataset", software: "software", patent: "patent",
  periodical: "periodical", unpublished: "manuscript", booklet: "pamphlet", misc: "document",
};
const RIS_TYPES: Record<string, string> = {
  JOUR: "article-journal", BOOK: "book", EDBOOK: "book", CHAP: "chapter", CONF: "paper-conference", CPAPER: "paper-conference",
  THES: "thesis", RPRT: "report", ELEC: "webpage", BLOG: "post-weblog", DATA: "dataset", COMP: "software",
  MGZN: "article-magazine", NEWS: "article-newspaper", MANSCPT: "manuscript", UNPB: "manuscript", MAP: "map", PAT: "patent",
  ENCYC: "entry-encyclopedia", DICT: "entry-dictionary", GEN: "document",
};
/** CSL 1.0.2 item types. */
const CSL_TYPES = new Set(("article article-journal article-magazine article-newspaper bill book broadcast chapter classic collection "
  + "dataset document entry entry-dictionary entry-encyclopedia event figure graphic hearing interview legal_case legislation "
  + "manuscript map motion_picture musical_score pamphlet paper-conference patent performance periodical personal_communication "
  + "post post-weblog regulation report review review-book software song speech standard thesis treaty webpage").split(" "));
const CSL_NAMES = new Set(("author chair collection-editor compiler composer container-author contributor curator director editor "
  + "editorial-director executive-producer guest host illustrator interviewer narrator organizer original-author performer producer "
  + "recipient reviewed-author script-writer series-creator translator").split(" "));
const CSL_DATES = new Set("accessed available-date event-date original-date submitted".split(" "));
const CSL_VARIABLES = new Set(("abstract annote archive archive_collection archive_location archive-place authority call-number "
  + "chapter-number citation-label citation-number collection-number collection-title container-title container-title-short "
  + "dimensions division edition event event-title event-place genre issue jurisdiction keyword language license medium note "
  + "number number-of-pages number-of-volumes original-publisher original-publisher-place original-title page part part-title "
  + "printing publisher publisher-place references reviewed-genre reviewed-title scale section source status supplement "
  + "title-short URL version volume volume-title").split(" "));
const CSL_IDENTIFIERS: Record<string, string> = { DOI: "doi", ISBN: "isbn", ISSN: "issn", PMID: "pmid", PMCID: "pmcid" };

class Builder {
  readonly record: JsonObject = {};
  readonly paths = new Map<number, string>();
  readonly losses: Mapped["losses"] = [];
  private readonly taken = new Set<string>();

  private claim(path: string, indexes: number[]): boolean {
    if (this.taken.has(path)) return false;
    this.taken.add(path);
    for (const i of indexes) this.paths.set(i, path);
    return true;
  }
  private list(name: "bib" | "dates" | "identifiers" | "contributions"): Json[] {
    return (this.record[name] ??= []) as Json[];
  }
  lose(index: number, kind: "unrepresented" | "approximated", note: string): void {
    this.losses.push({ index, class: kind, note });
  }
  free(path: string): boolean {
    return !this.taken.has(path);
  }
  title(index: number, value: string): void {
    if (value !== "" && this.claim("title", [index])) this.record.title = { value };
  }
  bib(name: string, value: string, indexes: number[]): void {
    if (value !== "" && this.claim(`bib/${name}`, indexes)) this.list("bib").push({ name, value: { value } });
  }
  identifiers(scheme: string, values: string[], indexes: number[]): void {
    const kept = values.filter((v) => v !== "");
    if (kept.length > 0 && this.claim(`identifiers/${scheme}`, indexes)) {
      for (const value of kept) this.list("identifiers").push({ scheme, value });
    }
  }
  names(role: string, names: NameParts[], indexes: number[]): void {
    if (names.length === 0 || !this.claim(`contributions/${role}`, indexes)) return;
    const list = this.list("contributions");
    for (const name of names) list.push({ lid: `n${list.length + 1}`, role, as_printed: name as JsonObject });
  }
  date(variable: string, date: JsonObject, indexes: number[]): void {
    const path = variable === "issued" ? "issued" : `dates/${variable}`;
    if (!this.claim(path, indexes)) return;
    if (variable === "issued") this.record.issued = date;
    else this.list("dates").push({ variable, date });
  }
  done(unrecognizedType: boolean): Mapped {
    return { record: this.record, paths: this.paths, losses: this.losses, unrecognizedType };
  }
}

/** The value a record holds at a `mapped_to` path (CONTRACT-003 D). */
export function mappedValue(record: JsonObject, path: string): Json | undefined {
  if (path === "title" || path === "issued") return record[path];
  const slash = path.indexOf("/");
  const [list, name] = [path.slice(0, slash), path.slice(slash + 1)];
  const items = Array.isArray(record[list]) ? (record[list] as Json[]).filter(isObject) : [];
  if (list === "contributions") {
    const names = items.filter((c) => c.role === name).map((c) => c.as_printed ?? null);
    return names.length > 0 ? names : undefined;
  }
  if (list === "identifiers") {
    const values = items.filter((c) => c.scheme === name).map((c) => c.value ?? null);
    return values.length > 0 ? values : undefined;
  }
  if (list === "dates") return items.find((d) => d.variable === name)?.date;
  return items.find((b) => b.name === name)?.value;
}

export const mappedDigest = (record: JsonObject, path: string): string => digest(mappedValue(record, path));

// ---- dates ----

const pad = (n: number, width: number) => String(n).padStart(width, "0");

function datePart(year: number, month?: number, day?: number): string | undefined {
  if (!Number.isInteger(year) || year < 0 || year > 9999) return undefined;
  if (month === undefined) return day === undefined ? pad(year, 4) : undefined;
  if (!Number.isInteger(month) || month < 1 || month > 12) return undefined;
  if (day !== undefined && (!Number.isInteger(day) || day < 1 || day > new Date(Date.UTC(2000, month, 0)).getUTCDate())) return undefined;
  return `${pad(year, 4)}-${pad(month, 2)}${day === undefined ? "" : `-${pad(day, 2)}`}`;
}

/** An ISO-style date as BibLaTeX writes it, as EDTF; `undefined` for any other form. */
function isoDate(value: string): string | undefined {
  const found = /^(\d{4})(?:-(\d\d)(?:-(\d\d))?)?([~?%]?)$/.exec(value);
  if (!found) return undefined;
  const part = datePart(Number(found[1]), found[2] ? Number(found[2]) : undefined, found[3] ? Number(found[3]) : undefined);
  return part === undefined ? undefined : part + found[4]!;
}

function biblatexDate(value: string): JsonObject {
  const ends = value.split("/");
  if (ends.length <= 2) {
    const read = ends.map((e) => (ends.length === 2 && (e === "" || e === "..") ? e : isoDate(e)));
    if (read.every((e) => e !== undefined) && read.some((e) => e !== "" && e !== "..")) return { edtf: read.join("/") };
  }
  return { literal: value };
}

/** A CSL date. `undefined` when it holds more than a PartialDate can say. */
function cslDate(value: Json): { date: JsonObject } | undefined {
  if (!isObject(value)) return undefined;
  const known = new Set(["date-parts", "circa", "raw", "literal"]);
  if (Object.keys(value).some((k) => !known.has(k))) return undefined;
  const parts = value["date-parts"];
  if (parts !== undefined) {
    if (!Array.isArray(parts) || parts.length < 1 || parts.length > 2) return undefined;
    const ends = parts.map((p) => (Array.isArray(p) && p.length >= 1 && p.length <= 3
      && p.every((n) => typeof n === "number" || (typeof n === "string" && /^\d+$/.test(n)))
      ? datePart(Number(p[0]), p[1] === undefined ? undefined : Number(p[1]), p[2] === undefined ? undefined : Number(p[2]))
      : undefined));
    if (ends.some((e) => e === undefined)) return undefined;
    const circa = value.circa !== undefined && value.circa !== false && value.circa !== 0 && value.circa !== "";
    return { date: { edtf: ends.map((e) => e + (circa ? "~" : "")).join("/") } };
  }
  const literal = typeof value.literal === "string" ? value.literal : typeof value.raw === "string" ? value.raw : undefined;
  return literal ? { date: { literal } } : undefined;
}

// ---- names ----

const COMMA = /,/y;
const SPACES = /[\s~]+/y;
// The look-behind stops a long run of space being rescanned from each of its positions.
const AND = /(?<!\s)\s+and(?=\s)\s+/iy;

/** Whether a name word is a particle: its first letter outside braces is lowercase. */
function startsLower(word: string): boolean {
  if (word.startsWith("{") && !word.startsWith("{\\")) return false;
  const letter = /\p{L}/u.exec(texToText(word)?.text ?? "")?.[0];
  return letter !== undefined && letter !== letter.toUpperCase();
}

function wholeGroup(source: string): boolean {
  if (!source.startsWith("{") || !source.endsWith("}")) return false;
  let depth = 0;
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) return i === source.length - 1;
  }
  return false;
}

/** One BibTeX name in its source form, split into parts still in TeX. */
function splitName(source: string): Record<keyof NameParts, string | undefined> | undefined {
  const empty = { family: undefined, given: undefined, particle: undefined, suffix: undefined, literal: undefined };
  if (wholeGroup(source)) return { ...empty, literal: source };
  const commas = splitOuter(source, COMMA).map((p) => p.trim());
  if (commas.every((p) => /^(family|given|prefix|suffix)\s*=/i.test(p))) {
    // BibLaTeX's extended name form.
    const parts: Record<string, string> = {};
    for (const p of commas) {
      const equals = p.indexOf("=");
      parts[p.slice(0, equals).trim().toLowerCase()] = p.slice(equals + 1).trim();
    }
    return { ...empty, family: parts.family, given: parts.given, particle: parts.prefix, suffix: parts.suffix };
  }
  if (commas.length > 3) return undefined;
  const words = (p: string) => splitOuter(p, SPACES).filter((w) => w !== "");
  const join = (list: string[]) => (list.length > 0 ? list.join(" ") : undefined);
  const first = words(commas[0]!);
  if (first.length === 0) return undefined;
  if (commas.length === 1) {
    if (first.length === 1) return { ...empty, literal: first[0] };
    let from = -1;
    let to = -1;
    for (let i = 0; i < first.length - 1; i++) {
      if (!startsLower(first[i]!)) continue;
      if (from < 0) from = i;
      to = i;
    }
    return from < 0
      ? { ...empty, given: join(first.slice(0, -1)), family: first.at(-1) }
      : { ...empty, given: join(first.slice(0, from)), particle: join(first.slice(from, to + 1)), family: join(first.slice(to + 1)) };
  }
  let particles = 0;
  while (particles < first.length - 1 && startsLower(first[particles]!)) particles++;
  return {
    ...empty,
    particle: join(first.slice(0, particles)), family: join(first.slice(particles)),
    given: commas.at(-1) || undefined, suffix: commas.length === 3 ? commas[1] || undefined : undefined,
  };
}

function biblatexNames(source: string): { names: NameParts[]; others: boolean; approximated: boolean } | undefined {
  const names: NameParts[] = [];
  let others = false;
  let approximated = false;
  for (const raw of splitOuter(source.trim(), AND)) {
    const one = raw.trim();
    if (one === "") return undefined;
    if (one === "others") {
      others = true;
      continue;
    }
    const split = splitName(one);
    if (!split) return undefined;
    const name: NameParts = {};
    for (const key of ["family", "given", "particle", "suffix", "literal"] as const) {
      const part = split[key];
      if (part === undefined) continue;
      const plain = texToText(part);
      if (!plain) return undefined;
      approximated ||= plain.approximated;
      if (plain.text !== "") name[key] = plain.text;
    }
    if (Object.keys(name).length === 0) return undefined;
    names.push(name);
  }
  return { names, others, approximated };
}

/** A name as RIS writes it: `Family, Given, Suffix`. A name with no comma is kept whole. */
function risName(value: string): NameParts | undefined {
  const parts = value.split(",").map((p) => p.trim());
  if (parts.length === 1) return parts[0] ? { literal: parts[0] } : undefined;
  if (parts.length > 3 || !parts[0]) return undefined;
  const name: NameParts = { family: parts[0] };
  if (parts[1]) name.given = parts[1];
  if (parts[2]) name.suffix = parts[2];
  return name;
}

// ---- BibLaTeX ----

const BIBLATEX_BIB: [string, string[]][] = [
  ["container-title", ["journaltitle", "journal", "booktitle"]],
  ["publisher", ["publisher", "institution", "school", "organization"]],
  ["publisher-place", ["location", "address"]],
  ["volume", ["volume"]], ["edition", ["edition"]], ["collection-title", ["series"]],
  ["number-of-volumes", ["volumes"]], ["number-of-pages", ["pagetotal"]], ["chapter-number", ["chapter"]],
  ["title-short", ["shorttitle"]], ["abstract", ["abstract"]], ["note", ["note"]], ["language", ["language"]],
  ["version", ["version"]], ["URL", ["url"]],
];
const VERBATIM = new Set(["url", "doi"]);

function mapBiblatex(type: string, fields: ParsedField[]): Mapped {
  const to = new Builder();
  const lower = type.toLowerCase();
  const csl = Object.hasOwn(BIBLATEX_TYPES, lower) ? BIBLATEX_TYPES[lower]! : undefined;
  to.record.type = csl ?? lower;

  /** The first field of each name. */
  const first = new Map<string, number>();
  fields.forEach((f, i) => {
    if (!first.has(f.name.toLowerCase())) first.set(f.name.toLowerCase(), i);
  });
  /** A field's plain text, or `undefined` after recording why there is none. */
  const plain = (name: string): { index: number; text: string } | undefined => {
    const index = first.get(name);
    if (index === undefined) return undefined;
    const field = fields[index]!;
    if (field.encoding === "raw") {
      to.lose(index, "unrepresented", "The value uses a macro with no definition.");
      return undefined;
    }
    if (VERBATIM.has(name)) return { index, text: field.value.trim() };
    const read = texToText(field.value);
    if (!read) {
      to.lose(index, "unrepresented", "The value holds TeX that is not read as text.");
      return undefined;
    }
    if (read.approximated) to.lose(index, "approximated", "TeX formatting is not kept in the record's value.");
    return { index, text: read.text };
  };

  const title = plain("title");
  if (title) to.title(title.index, title.text);
  for (const [field, role] of [["author", "author"], ["editor", "editor"], ["translator", "translator"], ["bookauthor", "container-author"]] as const) {
    const index = first.get(field);
    if (index === undefined) continue;
    // `editortype` can make an editor a compiler or another role.
    if (field === "editor" && first.has("editortype")) continue;
    const read = fields[index]!.encoding === "tex" ? biblatexNames(fields[index]!.value) : undefined;
    if (!read) {
      to.lose(index, "unrepresented", "The names are not read.");
      continue;
    }
    if (read.others) to.lose(index, "approximated", "The list is cut short with `others`, which the record does not show.");
    if (read.approximated) to.lose(index, "approximated", "TeX formatting is not kept in the record's value.");
    to.names(role, read.names, [index]);
  }

  const date = plain("date");
  if (date?.text) to.date("issued", biblatexDate(date.text), [date.index]);
  const year = to.free("issued") ? plain("year") : undefined;
  if (year?.text) {
    const monthIndex = first.get("month");
    const written = monthIndex === undefined ? undefined : fields[monthIndex]!.value.trim().toLowerCase();
    const month = written === undefined ? undefined
      : MONTH_MACROS.includes(written) ? MONTH_MACROS.indexOf(written) + 1
      : /^\d{1,2}$/.test(written) ? Number(written) : undefined;
    const full = /^\d{4}$/.test(year.text) && month !== undefined ? datePart(Number(year.text), month) : undefined;
    if (full) to.date("issued", { edtf: full }, [year.index, monthIndex!]);
    else to.date("issued", /^\d{4}$/.test(year.text) ? { edtf: year.text } : { literal: year.text }, [year.index]);
  }
  const accessed = plain("urldate");
  if (accessed?.text) to.date("accessed", biblatexDate(accessed.text), [accessed.index]);

  for (const [variable, names] of BIBLATEX_BIB) {
    for (const name of names) {
      if (!to.free(`bib/${variable}`)) break;
      const read = plain(name);
      if (read) to.bib(variable, read.text, [read.index]);
    }
  }
  const issue = plain("issue");
  if (issue) to.bib("issue", issue.text, [issue.index]);
  const number = plain("number");
  // A journal's `number` is its issue; elsewhere it numbers the work or its series.
  if (number) to.bib(lower === "article" && to.free("bib/issue") ? "issue" : "number", number.text, [number.index]);
  const pages = plain("pages");
  if (pages) to.bib("page", pages.text, [pages.index]);
  for (const scheme of ["doi", "isbn", "issn"]) {
    const read = plain(scheme);
    if (read) to.identifiers(scheme, [read.text], [read.index]);
  }
  return to.done(csl === undefined);
}

// ---- RIS ----

const RIS_BIB: [string, string[]][] = [
  ["container-title", ["T2", "JF", "JO", "JA"]],
  ["publisher", ["PB"]], ["publisher-place", ["CY"]], ["volume", ["VL"]], ["issue", ["IS"]], ["edition", ["ET"]],
  ["title-short", ["ST"]], ["abstract", ["AB", "N2"]], ["language", ["LA"]],
];

function mapRis(type: string, fields: ParsedField[]): Mapped {
  const to = new Builder();
  const code = type.trim();
  const csl = Object.hasOwn(RIS_TYPES, code) ? RIS_TYPES[code]! : undefined;
  if (code !== "") to.record.type = csl ?? code.toLowerCase();
  const tagged = new Map<string, number[]>();
  fields.forEach((f, i) => {
    const list = tagged.get(f.name);
    if (list) list.push(i);
    else tagged.set(f.name, [i]);
  });
  const all = (tag: string) => tagged.get(tag) ?? [];
  const text = (i: number) => fields[i]!.value.trim();
  /** The one non-empty value of a tag. Several values have no single home, so none is chosen. */
  const single = (tag: string): number | undefined => {
    const indexes = all(tag).filter((i) => text(i) !== "");
    if (indexes.length > 1) for (const i of indexes) to.lose(i, "unrepresented", "A repeated tag has no single value in the record.");
    return indexes.length === 1 ? indexes[0] : undefined;
  };

  for (const tag of ["TI", "T1"]) {
    const i = single(tag);
    if (i !== undefined) to.title(i, text(i));
  }
  const roles: [string, string[]][] = [["author", ["AU", "A1"]], ["editor", ["ED"]]];
  // Only in these types is the secondary author an editor.
  if (["BOOK", "CHAP", "EDBOOK"].includes(code)) roles.push(["editor", ["A2"]]);
  for (const [role, tags] of roles) {
    for (const tag of tags) {
      if (!to.free(`contributions/${role}`)) break;
      const indexes = all(tag).filter((i) => text(i) !== "");
      const names = indexes.map((i) => risName(text(i)));
      if (names.every((n) => n !== undefined)) to.names(role, names, indexes);
      else for (const i of indexes) to.lose(i, "unrepresented", "The names are not read.");
    }
  }
  for (const tag of ["PY", "Y1", "DA"]) {
    if (!to.free("issued")) break;
    const i = single(tag);
    if (i === undefined) continue;
    // Year, month, day, and free text, divided by slashes.
    const found = /^(\d{4})(?:\/(\d{1,2})?(?:\/(\d{1,2})?(?:\/(.*))?)?)?$/.exec(text(i));
    const edtf = found && !found[4] ? datePart(Number(found[1]), found[2] ? Number(found[2]) : undefined, found[3] ? Number(found[3]) : undefined) : undefined;
    to.date("issued", edtf ? { edtf } : { literal: text(i) }, [i]);
  }
  for (const [variable, tags] of RIS_BIB) {
    for (const tag of tags) {
      if (!to.free(`bib/${variable}`)) break;
      const i = single(tag);
      if (i !== undefined) to.bib(variable, text(i), [i]);
    }
  }
  const note = single("N1");
  if (note !== undefined) to.bib("note", text(note), [note]);
  const url = single("UR");
  if (url !== undefined) to.bib("URL", text(url), [url]);
  const start = single("SP");
  if (start !== undefined) {
    const end = single("EP");
    to.bib("page", end === undefined ? text(start) : `${text(start)}-${text(end)}`, end === undefined ? [start] : [start, end]);
  }
  const doi = single("DO");
  if (doi !== undefined) to.identifiers("doi", [text(doi)], [doi]);
  const serial = single("SN");
  if (serial !== undefined) {
    // SN holds either number; only its shape says which.
    const value = text(serial);
    const digits = value.replace(/[- ]/g, "");
    if (/^\d{4}-\d{3}[\dXx]$/.test(value)) to.identifiers("issn", [value], [serial]);
    else if (/^(97[89]\d{10}|\d{9}[\dXx])$/.test(digits) && /^[\d\- Xx]+$/.test(value)) to.identifiers("isbn", [value], [serial]);
    else to.lose(serial, "unrepresented", "The number's shape is neither an ISSN nor an ISBN.");
  }
  return to.done(code !== "" && csl === undefined);
}

// ---- CSL-JSON ----

function cslNames(value: Json): { names: NameParts[]; approximated: boolean } | undefined {
  if (!Array.isArray(value)) return undefined;
  let approximated = false;
  const names: NameParts[] = [];
  for (const one of value) {
    if (!isObject(one)) return undefined;
    const name: NameParts = {};
    for (const [from, part] of Object.entries(one)) {
      const into = from === "non-dropping-particle" ? "particle"
        : from === "family" || from === "given" || from === "suffix" || from === "literal" ? from : undefined;
      if (into !== undefined && typeof part === "string") name[into] = part;
      else approximated = true;
    }
    if (Object.keys(name).length === 0) return undefined;
    names.push(name);
  }
  return { names, approximated };
}

function mapCsl(type: string | undefined, fields: ParsedField[]): Mapped {
  const to = new Builder();
  if (type) to.record.type = type;
  fields.forEach((field, i) => {
    const name = field.name;
    if (name === "id" || name === "type") return;
    const value = JSON.parse(field.value) as Json;
    // A numeric variable keeps the number text of the file.
    const scalar = typeof value === "string" ? value : typeof value === "number" ? field.value : undefined;
    const lose = () => to.lose(i, "unrepresented", "The value's shape is not read.");
    if (name === "title") {
      if (typeof value === "string") to.title(i, value);
      else lose();
    } else if (CSL_NAMES.has(name)) {
      const read = cslNames(value);
      if (!read) return lose();
      if (read.approximated) to.lose(i, "approximated", "Some parts of a name are not kept in the record's value.");
      to.names(name, read.names, [i]);
    } else if (name === "issued" || CSL_DATES.has(name)) {
      const read = cslDate(value);
      if (read) to.date(name, read.date, [i]);
      else lose();
    } else if (Object.hasOwn(CSL_IDENTIFIERS, name)) {
      if (scalar !== undefined) to.identifiers(CSL_IDENTIFIERS[name]!, [scalar], [i]);
      else lose();
    } else if (CSL_VARIABLES.has(name)) {
      if (scalar !== undefined) to.bib(name, scalar, [i]);
      else lose();
    }
  });
  return to.done(type !== undefined && !CSL_TYPES.has(type));
}

export function mapEntry(format: LegacyFormat, type: string | undefined, fields: ParsedField[]): Mapped {
  // A record's own fields never hold a local path (CONTRACT-001 B), so such a value stays preserved only.
  const local = new Set(fields.flatMap((f, i) => (looksLocal(f.value) ? [i] : [])));
  // A nameless empty value stands in each one's place, so that the other indexes hold.
  const open = fields.map((f, i) => (local.has(i) ? { ...f, name: "", value: format === "csl_json" ? '""' : "" } : f));
  const mapped = format === "biblatex" ? mapBiblatex(type ?? "", open)
    : format === "ris" ? mapRis(type ?? "", open) : mapCsl(type, open);
  for (const index of local) mapped.losses.push({ index, class: "unrepresented", note: "A value that looks like a local path is not copied into the record." });
  return mapped;
}

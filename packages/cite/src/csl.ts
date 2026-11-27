// Source records projected to CSL-JSON (CONTRACT-006 G2), deterministically and
// only from what the records hold: no value is supplied, guessed or tidied here.
// A part (a chapter, a letter in a collection, an article in a volume of
// proceedings) names its container with a `part_of` relation and takes from it
// what it does not state itself.
import { type Corpus, isObject, isRetired, type Json, type JsonObject } from "@stemma/records";

export type CslItem = Record<string, unknown> & { id: string; type: string };

/** Stemma contribution roles that CSL names directly. */
const NAME_ROLES = new Set([
  "author", "editor", "translator", "recipient", "container-author", "collection-editor", "editorial-director",
  "interviewer", "illustrator", "composer", "director", "original-author", "reviewed-author",
]);
/** What a part takes from its container when it does not state it. */
const INHERITED = [
  "publisher", "publisher-place", "volume", "edition", "collection-title", "collection-number", "number-of-volumes",
];

const text = (value: Json | undefined): string | undefined =>
  isObject(value) && typeof value.value === "string" ? value.value : typeof value === "string" ? value : undefined;

/** An EDTF date or interval of years, months and days as CSL date parts. */
export function dateParts(edtf: string): { "date-parts": number[][] } | undefined {
  const one = (s: string) => {
    const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(s);
    return m ? [m[1], m[2], m[3]].filter((p): p is string => p !== undefined).map(Number) : undefined;
  };
  const ends = edtf.split("/").map(one);
  if (ends.length > 2 || ends.some((e) => e === undefined)) return undefined;
  return { "date-parts": ends as number[][] };
}

function names(record: JsonObject): Record<string, JsonObject[]> {
  const out: Record<string, JsonObject[]> = {};
  for (const c of Array.isArray(record.contributions) ? record.contributions.filter(isObject) : []) {
    const role = String(c.role);
    const printed = c.as_printed;
    if (!NAME_ROLES.has(role) || !isObject(printed)) continue;
    const parts: Record<string, string> = {};
    for (const k of ["family", "given", "literal", "suffix"]) if (typeof printed[k] === "string") parts[k] = printed[k];
    if (typeof printed.particle === "string") parts["non-dropping-particle"] = printed.particle;
    (out[role] ??= []).push(parts as JsonObject);
  }
  return out;
}

/** The record's own CSL variables: type, title, names, dates, bib fields, identifiers, extents. */
function own(record: JsonObject): Record<string, unknown> {
  const item: Record<string, unknown> = {};
  if (typeof record.type === "string") item.type = record.type;
  const title = text(record.title);
  if (title) item.title = title;
  Object.assign(item, names(record));
  if (isObject(record.issued) && typeof record.issued.edtf === "string") {
    const date = dateParts(record.issued.edtf);
    if (date) item.issued = date;
  }
  for (const d of Array.isArray(record.dates) ? record.dates.filter(isObject) : []) {
    if (typeof d.variable === "string" && isObject(d.date) && typeof d.date.edtf === "string") {
      const date = dateParts(d.date.edtf);
      if (date) item[d.variable] = date;
    }
  }
  for (const b of Array.isArray(record.bib) ? record.bib.filter(isObject) : []) {
    const value = text(b.value);
    if (typeof b.name === "string" && value !== undefined) item[b.name] = value;
  }
  for (const i of Array.isArray(record.identifiers) ? record.identifiers.filter(isObject) : []) {
    if (i.scheme === "doi" && typeof i.value === "string") item.DOI = i.value;
    if (i.scheme === "isbn" && typeof i.value === "string") item.ISBN = i.value;
  }
  const pages = (Array.isArray(record.extents) ? record.extents.filter(isObject) : []).find((e) => e.label === "page");
  if (pages && typeof pages.first === "string" && typeof pages.last === "string") item.page = `${pages.first}–${pages.last}`;
  return item;
}

export function containerOf(corpus: Corpus, record: JsonObject): JsonObject | undefined {
  const relation = (Array.isArray(record.relations) ? record.relations.filter(isObject) : []).find((r) => r.type === "part_of");
  const target = relation ? corpus.byId.get(String(relation.target))?.data : undefined;
  return target?.kind === "source" && !isRetired(target) ? target : undefined;
}

/**
 * The CSL item for a source record. A part takes its container's title as
 * `container-title`, the container's authors as `container-author` and its
 * editors as `editor`, and the container's publication details it does not
 * state itself. An article number (`number`) of a journal article that states
 * no page range stands where the page range would, so that a note's page
 * locator is not printed beside it.
 */
export function cslItem(corpus: Corpus, record: JsonObject): CslItem {
  const item = own(record) as CslItem;
  item.id = String(record.id);
  item.type ??= "book";
  const container = containerOf(corpus, record);
  if (container) {
    const theirs = own(container);
    if (typeof theirs.title === "string") item["container-title"] ??= theirs.title;
    // A corporate author of the volume (a committee, a society) is not repeated as
    // "by …" after each part's own authors; the volume's title and imprint name it.
    const people = Array.isArray(theirs.author) ? (theirs.author as JsonObject[]).filter((n) => n.literal === undefined) : [];
    if (people.length > 0 && item.type !== "personal_communication") item["container-author"] ??= people;
    if (Array.isArray(theirs.editor)) item.editor ??= theirs.editor;
    for (const name of INHERITED) if (theirs[name] !== undefined) item[name] ??= theirs[name];
    if (theirs.issued !== undefined) item.issued ??= theirs.issued;
  }
  // With no shortened title recorded, the short form uses the main title: the
  // title before a subtitle that a colon, semicolon or full stop introduces.
  if (item["title-short"] === undefined && typeof item.title === "string") {
    const main = /^(.*?\p{L}{3,})[:;.]\s+\p{Lu}/u.exec(item.title)?.[1];
    if (main) item["title-short"] = main;
  }
  if (item.type === "article-journal" && item.page === undefined && typeof item.number === "string") {
    item.page = item.number;
    delete item.number;
  }
  return item;
}

/** The source a key names: its citation key, an alias, or its record ID. */
export function sourceByKey(corpus: Corpus, key: string): JsonObject | undefined {
  const direct = corpus.byId.get(key)?.data;
  if (direct?.kind === "source" && !isRetired(direct)) return direct;
  return corpus.records.map((f) => f.data).find((d): d is JsonObject => d?.kind === "source" && !isRetired(d)
    && (d.citation_key === key || (Array.isArray(d.key_aliases) && d.key_aliases.includes(key))));
}

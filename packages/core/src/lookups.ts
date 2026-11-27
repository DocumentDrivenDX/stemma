// Catalogue lookups (FR-33): the addresses asked, and what is read from the
// responses. The caller does the fetching; these functions only read text. A
// response is data, never instructions.
import { canonical, isObject, type Json, type JsonObject, parseJson, KINDS, recordPath, RECORD_SCHEMA, sha256 } from "@stemma/records";
import { type Actor, InvalidInput } from "./operations.ts";

export const RESOLVERS = ["crossref", "internet_archive"] as const;
export type Resolver = (typeof RESOLVERS)[number];

/** Which catalogue answers for an identifier scheme. */
export const resolverFor = (scheme: string): Resolver | undefined =>
  scheme === "doi" ? "crossref" : scheme === "ia" ? "internet_archive" : undefined;

export function lookupAddress(resolver: Resolver, value: string): string {
  if (resolver === "crossref") {
    if (!/^10\.\d{4,9}\/\S+$/.test(value)) throw new InvalidInput(`${value} is not a DOI.`);
    return `https://api.crossref.org/works/${encodeURIComponent(value)}`;
  }
  if (!/^[A-Za-z0-9_.-]+$/.test(value)) throw new InvalidInput(`${value} is not an Internet Archive item identifier.`);
  return `https://archive.org/metadata/${value}/metadata`;
}

const KEPT: Record<Resolver, string[]> = {
  crossref: ["DOI", "title", "subtitle", "author", "editor", "issued", "published", "publisher", "container-title", "type", "volume", "issue", "page", "ISBN", "ISSN", "URL"],
  internet_archive: ["identifier", "title", "creator", "date", "year", "publisher", "volume", "language", "call_number", "lccn", "oclc-id", "possible-copyright-status"],
};

const strings = (value: Json | undefined): string[] =>
  (Array.isArray(value) ? value : value === undefined ? [] : [value]).filter((v): v is string => typeof v === "string" && v.trim() !== "");

function readFound(resolver: Resolver, kept: JsonObject): JsonObject {
  const first = (name: string) => strings(kept[name])[0];
  let title = first("title");
  let contributors: string[];
  let issued: string | undefined;
  let venue: string | undefined;
  if (resolver === "crossref") {
    const subtitle = first("subtitle");
    if (title && subtitle) title = `${title}: ${subtitle}`;
    const people = [kept.author, kept.editor].find(Array.isArray) as Json[] | undefined;
    contributors = (people ?? []).filter(isObject).map((p) => [p.given, p.family, p.name].filter((v) => typeof v === "string").join(" "));
    const date = [kept.issued, kept.published].find(isObject) as JsonObject | undefined;
    const parts = date && Array.isArray(date["date-parts"]) ? date["date-parts"][0] : undefined;
    issued = Array.isArray(parts) && typeof parts[0] === "number" ? String(parts[0]) : undefined;
    venue = first("container-title");
  } else {
    contributors = strings(kept.creator);
    issued = first("date") ?? first("year");
  }
  const publisher = first("publisher");
  return {
    ...(title ? { title: title.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() } : {}), contributors,
    ...(issued ? { issued } : {}), ...(publisher ? { publisher } : {}), ...(venue ? { venue } : {}),
  };
}

export interface Lookup { outcome: "found" | "not_found" | "error"; response?: string; found?: JsonObject }

/** Reads one response. Large parts a check never reads, such as reference lists, are not kept. */
export function readLookup(resolver: Resolver, status: number, body: Uint8Array): Lookup {
  if (status === 404) return { outcome: "not_found" };
  let value: Json;
  try {
    // Catalogue responses may hold decimals and nulls, which records do not; read them plainly.
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)) as Json;
  } catch {
    return { outcome: "error" };
  }
  if (!isObject(value)) return { outcome: "error" };
  const whole = resolver === "crossref" ? value.message : value.result;
  if (!isObject(whole) || strings(whole.title).length === 0) return { outcome: "not_found" };
  const kept = Object.fromEntries(KEPT[resolver].filter((k) => whole[k] !== undefined).map((k) => [k, whole[k]!]));
  const response = JSON.stringify(kept, Object.keys(flatten(kept)).sort(), 1);
  parseJson(canonical({ response }));
  return { outcome: "found", response, found: readFound(resolver, kept) };
}

/** Every key at any depth, so that the saved text has one stable key order. */
function flatten(value: Json, keys: Record<string, true> = {}): Record<string, true> {
  if (Array.isArray(value)) value.forEach((v) => flatten(v, keys));
  else if (isObject(value)) {
    for (const [k, v] of Object.entries(value)) {
      keys[k] = true;
      flatten(v, keys);
    }
  }
  return keys;
}

export function planResolution(request: {
  source: string; resolver: Resolver; scheme: string; value: string; lookup: Lookup; url: string; actor: Actor; now: Date; token: () => string;
}): { id: string; path: string; text: string } {
  const id = `${KINDS.resolution!.prefix}${request.token()}`;
  const at = request.now.toISOString().replace(/\.\d+Z$/, "Z");
  const { lookup } = request;
  return {
    id, path: recordPath("resolution", id),
    text: canonical({
      schema: RECORD_SCHEMA, id, kind: "resolution", created: { at, by: { ...request.actor } }, source: request.source,
      resolver: request.resolver, identifier: { scheme: request.scheme, value: request.value }, query: request.value, url: request.url,
      queried_at: at, outcome: lookup.outcome,
      ...(lookup.response ? { response: lookup.response, response_sha256: sha256(lookup.response) } : {}),
      ...(lookup.found ? { found: lookup.found } : {}),
    }),
  };
}

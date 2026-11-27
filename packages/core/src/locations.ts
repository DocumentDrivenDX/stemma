// Adding a location to an upstream record, or recording what one gave (FR-98;
// CONTRACT-002 B). Only the upstream record changes: no source file, passage or
// other record is written, and a location already listed is not added twice.
import { canonical, type Corpus, idOf, isLocationAddress, isLocationLabel, isObject, isRecordId, isRetired, type JsonObject, type LoadedFile } from "@stemma/records";
import { assertValid } from "./capture.ts";
import { findSource, type Written } from "./enrich.ts";
import { type Actor, InvalidInput } from "./operations.ts";

export const LOCATION_KINDS = ["publisher", "web_archive", "archive", "private"] as const;
export type LocationKind = (typeof LOCATION_KINDS)[number];

const upstreams = (corpus: Corpus) => corpus.records.filter((f) => f.state === "ok" && f.data?.kind === "upstream" && !isRetired(f.data));

/** An upstream record named by its ID, or by a source that has just one. */
export function findUpstream(corpus: Corpus, name: string): LoadedFile {
  if (isRecordId("upstream", name)) {
    const found = upstreams(corpus).find((f) => idOf(f) === name);
    if (!found) throw new InvalidInput(`No readable upstream record in effect has the ID ${name}.`);
    return found;
  }
  const source = idOf(findSource(corpus, name))!;
  const mine = upstreams(corpus).filter((f) => f.data!.source === source);
  if (mine.length === 1) return mine[0]!;
  throw new InvalidInput(mine.length === 0
    ? `The source ${name} has no upstream record, so there is no original to give a location of. Record it first (\`source capture\`, or an \`ingest\` plan).`
    : `The source ${name} has ${mine.length} upstream records, one for each original. Name the one meant: ${mine.map((f) => `${idOf(f)} (sha256 ${String(f.data!.sha256).slice(0, 12)})`).join(", ")}.`);
}

export interface LocationRequest {
  /** An upstream ID, or a source ID or citation key. */
  upstream: string;
  kind: LocationKind;
  url?: string;
  label?: string;
  note?: string;
  /** The digest of what this location gave just now, when it was compared. */
  gave?: string;
  actor: Actor;
  now: Date;
}

export interface LocationPlan {
  upstream: string;
  source: string;
  added: boolean;
  /** What the record now says this location gave, compared with the original. */
  bytes: "same" | "different" | "not_compared";
  notes: string[];
  record?: Written;
}

export function planLocation(corpus: Corpus, request: LocationRequest): LocationPlan {
  const file = findUpstream(corpus, request.upstream);
  const data = file.data!;
  if (!file.formattable) throw new InvalidInput(`${file.path} holds values that rewriting would change. Correct it first.`);
  const { kind, url, label } = request;
  if (kind === "private") {
    if (url !== undefined || label === undefined || !isLocationLabel(label)) {
      throw new InvalidInput("A private copy is recorded by a name you choose, never by a path or an address: up to 80 letters, digits, spaces and . _ ' ( ) -, starting with a letter or digit.");
    }
  } else if (label !== undefined || url === undefined || !isLocationAddress(url)) {
    throw new InvalidInput("A location that is not private is an http or https address with no user name or password in it.");
  }
  const at = request.now.toISOString().replace(/\.\d+Z$/, "Z");
  const list = (Array.isArray(data.locations) ? data.locations.filter(isObject) : []) as JsonObject[];
  const index = list.findIndex((l) => (kind === "private" ? l.label === label : l.url === url));
  const held = list[index];
  const notes: string[] = [];
  const compared = request.gave === undefined ? undefined : { at, sha256: request.gave };
  let next: JsonObject;
  if (!held) {
    next = {
      kind, ...(url !== undefined ? { url } : {}), ...(label !== undefined ? { label } : {}), added: { at, by: { ...request.actor } },
      ...(compared ? { compared } : {}), ...(request.note ? { note: request.note } : {}),
    };
  } else {
    if (held.kind !== kind) notes.push(`It is already listed with the kind ${String(held.kind)}, which was kept.`);
    if (request.note && held.note !== request.note) notes.push("It is already listed; its recorded note was kept.");
    // The same answer as before is not recorded again.
    const before = isObject(held.compared) ? held.compared.sha256 : undefined;
    next = compared && before !== compared.sha256 ? { ...held, compared } : held;
  }
  const result = isObject(next.compared) ? (next.compared.sha256 === data.sha256 ? "same" as const : "different" as const) : "not_compared" as const;
  const shared = { upstream: idOf(file)!, source: String(data.source), added: !held, bytes: result, notes };
  if (next === held) return shared;
  const locations = held ? list.map((l, i) => (i === index ? next : l)) : [...list, next];
  const text = canonical({ ...data, locations, changed: { at, by: { ...request.actor } } });
  assertValid("Upstream", "upstream", text);
  return { ...shared, record: { id: idOf(file)!, path: file.path, text } };
}

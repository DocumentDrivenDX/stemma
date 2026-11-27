// Review marks (CONTRACT-001 G; CONTRACT-002 B1): the one rule for whether a
// mark applies, what a claim rests on, the listing of what is unreviewed, and
// the marks the author asks for. A mark records what was said; it proves nothing.
import {
  canonical, compareCodePoints, type Corpus, idOf, isObject, isRetired, type Json, type JsonObject, KIND_TYPES, type LoadedFile, TYPES,
} from "@stemma/records";
import { itemOf } from "./checks/records.ts";
import { activeRecords, activeWhere, once } from "./corpus-index.ts";
import { boundaryFor } from "./excerpt.ts";
import { type Actor, InvalidInput, stampTime } from "./operations.ts";
import type { RecordWrite } from "./capture.ts";

/** A record that breaks a rule is left out of the graph export, and counts toward no claim. */
export const takesPart = (file: LoadedFile): boolean => !file.problems.some((p) => p.reason === "record_invalid");

/** Whether who wrote the record, or its mark, is recorded in a way that breaks a rule. */
const markBroken = (file: LoadedFile): boolean =>
  file.problems.some((p) => p.reason === "record_invalid" && /^\/(created|review)(\/|$)/.test(p.field));

/**
 * A record is reviewed only while its mark says so and the content is still
 * what the mark was made on. A record with no mark is not reviewed, nor is one
 * whose `created` or `review` breaks a rule.
 */
export function isReviewed(file: LoadedFile): boolean {
  const review = file.data?.review;
  return isObject(review) && review.state === "reviewed" && !markBroken(file) && review.content_sha256 === itemOf(file)!.content_sha256;
}

// Reversed, so that of two notes with one ID the first is kept, as in `byId`.
const notesById = (corpus: Corpus) => once(corpus, "notes in effect by ID", () =>
  new Map<unknown, LoadedFile>(activeRecords(corpus, "note").toReversed().map((n) => [idOf(n), n])));

/** Whether records of this kind have a review mark. */
export const carriesReview = (kind: string): boolean => Object.hasOwn(KIND_TYPES, kind) && TYPES[KIND_TYPES[kind]!]!.review !== undefined;

/** The attestations in effect for a claim, each with its evidence note when that is a note in effect. */
export function linksInEffect(corpus: Corpus, claim: string): { attestation: LoadedFile; note?: LoadedFile }[] {
  return activeWhere(corpus, "attestation", "claim", claim).map((attestation) => {
    const note = notesById(corpus).get(attestation.data!.evidence);
    return { attestation, ...(note ? { note } : {}) };
  });
}

/** The links that count toward a claim: neither end of one breaks a rule. */
export function claimLinks(corpus: Corpus, claim: string): { attestation: LoadedFile; note?: LoadedFile }[] {
  return linksInEffect(corpus, claim).filter((l) => takesPart(l.attestation))
    .map((l) => (l.note && !takesPart(l.note) ? { attestation: l.attestation } : l));
}

/**
 * Every record with a review mark that a cited claim brings with it. What a
 * manuscript reaches beyond a claim's evidence is added here. A record that
 * breaks a rule is still reached, so that it is not left off the unreviewed list.
 */
export function claimReach(corpus: Corpus, claim: LoadedFile): LoadedFile[] {
  return [claim, ...linksInEffect(corpus, idOf(claim)!).flatMap((l) => [l.attestation, ...(l.note ? [l.note] : [])])];
}

/** How much of one stored passage or manuscript origin the listing shows (an assumption). */
export const UNREVIEWED_TEXT_LIMIT = 1_000;

/** The wording and links of each kind that the listing shows. A kind not named here shows none. */
const SHOWN: Record<string, string[]> = {
  note: ["type", "source", "passages", "locator", "body"],
  claim: ["text", "role", "confidence", "reason", "own"],
  attestation: ["claim", "evidence", "stance", "basis"],
  inference: ["premises", "conclusion", "relation", "warrant"],
  construct: ["label", "ownership", "definition", "originators", "origin_source"],
  method: ["statement", "applies_to", "draws_on"],
  plan: ["plan_type", "chapter", "body", "claims", "constructs", "methods"],
  voice_profile: ["base_id", "entries", "model", "prompt_version"],
};
/** A place record can hold a restricted position, so none of its values or its passages' words are printed. */
const WITHHELD = new Set(["place", "place_name", "place_location", "place_assertion"]);

export type UnreviewedOrigin =
  | { type: "passage"; passage: string; source?: string; locator?: Json; text?: string; text_trimmed?: true; retired?: true; unreadable?: true }
  | { type: "manuscript"; import: string; document_position: string; text: string; text_trimmed?: true };

export interface UnreviewedEntry {
  record: string;
  kind: string;
  file: string;
  content_sha256: string;
  mark: "unreviewed" | "changed_since_review" | "no_mark";
  content: JsonObject;
  content_withheld?: true;
  origins: UnreviewedOrigin[];
  no_passage?: true;
}

export interface UnreviewedListing {
  items: UnreviewedEntry[];
  /** Record files that cannot be read or have no ID, so that leaving them out is not taken as review. */
  not_listed: string[];
  /** The token for the lines around each item's data in the text form. */
  boundary: string;
}

const cutText = (text: string): { text: string; text_trimmed?: true } => {
  const points = Array.from(text);
  return points.length <= UNREVIEWED_TEXT_LIMIT ? { text } : { text: points.slice(0, UNREVIEWED_TEXT_LIMIT).join(""), text_trimmed: true };
};

const strings = (value: unknown): string[] => (value === undefined ? [] : [value].flat().filter((v): v is string => typeof v === "string"));

/** The passages a piece of evidence stands on: itself, or those a note names. */
function passagesOf(corpus: Corpus, evidence: unknown): string[] {
  const data = corpus.byId.get(String(evidence))?.data;
  if (data?.kind === "note") return strings(data.passages);
  return data?.kind === "passage" || String(evidence).startsWith("psg-") ? strings(evidence) : [];
}

function passagesNamed(corpus: Corpus, data: JsonObject): string[] {
  if (data.kind === "claim") {
    return linksInEffect(corpus, String(data.id)).flatMap((l) => {
      if (l.note) return strings(l.note.data!.passages);
      // A note that is not in effect brings nothing; a passage linked directly is shown.
      return corpus.byId.get(String(l.attestation.data!.evidence))?.data?.kind === "note" ? [] : passagesOf(corpus, l.attestation.data!.evidence);
    });
  }
  if (data.kind === "attestation") return passagesOf(corpus, data.evidence);
  return [...strings(data.passages), ...strings(data.origin_passage), ...strings(data.evidence).filter((id) => id.startsWith("psg-"))];
}

function originsOf(corpus: Corpus, data: JsonObject, withheld: boolean): UnreviewedOrigin[] {
  const manuscript = withheld || !Array.isArray(data.origins) ? [] : data.origins.filter(isObject).map((o): UnreviewedOrigin => ({
    type: "manuscript", import: String(o.import), document_position: String(o.document_position), ...cutText(String(o.text)),
  }));
  return [...manuscript, ...[...new Set(passagesNamed(corpus, data))].map((id): UnreviewedOrigin => {
    const passage = corpus.byId.get(id)?.data;
    if (passage?.kind !== "passage") return { type: "passage", passage: id, unreadable: true };
    if (withheld) return { type: "passage", passage: id };
    return {
      type: "passage", passage: id, source: String(passage.source),
      ...(passage.locator === undefined ? {} : { locator: passage.locator }),
      ...(isObject(passage.quote) && typeof passage.quote.exact === "string" ? cutText(passage.quote.exact) : {}),
      ...(isRetired(passage) ? { retired: true as const } : {}),
    };
  })];
}

function contentOf(corpus: Corpus, data: JsonObject): JsonObject {
  const content: JsonObject = Object.fromEntries((SHOWN[String(data.kind)] ?? []).flatMap((f) => (data[f] === undefined ? [] : [[f, data[f]!]])));
  if (data.kind === "attestation") {
    const claim = corpus.byId.get(String(data.claim))?.data;
    const evidence = corpus.byId.get(String(data.evidence))?.data;
    if (claim?.kind === "claim" && claim.text !== undefined) content.claim_text = claim.text!;
    if (evidence?.kind === "note" && evidence.body !== undefined) content.note_body = evidence.body!;
  }
  return content;
}

/** Every record in effect, of a kind with a review mark, whose mark does not apply. Writes nothing. */
export function unreviewedListing(corpus: Corpus): UnreviewedListing {
  const items: UnreviewedEntry[] = [];
  const notListed = corpus.records
    .filter((f) => f.path.startsWith("records/") && (f.state === "unreadable" || f.state === "version_unsupported" || (f.state === "ok" && idOf(f) === undefined)))
    .map((f) => f.path);
  for (const file of corpus.records) {
    const data = file.data;
    const id = idOf(file);
    if (file.state !== "ok" || !data || id === undefined || isRetired(data) || !carriesReview(String(data.kind)) || isReviewed(file)) continue;
    const kind = String(data.kind);
    const withheld = WITHHELD.has(kind);
    const origins = originsOf(corpus, data, withheld);
    items.push({
      record: id, kind, file: file.path, content_sha256: itemOf(file)!.content_sha256,
      mark: !isObject(data.review) ? "no_mark"
        : data.review.state === "reviewed" && data.review.content_sha256 !== itemOf(file)!.content_sha256 ? "changed_since_review" : "unreviewed",
      content: withheld ? {} : contentOf(corpus, data), ...(withheld ? { content_withheld: true as const } : {}),
      origins, ...(origins.length === 0 ? { no_passage: true as const } : {}),
    });
  }
  items.sort((a, b) => compareCodePoints(a.record, b.record) || compareCodePoints(a.file, b.file));
  return { items, not_listed: notListed.sort(compareCodePoints), boundary: boundaryFor(JSON.stringify(items)) };
}

export interface ReviewedRequest { targets: string[]; actor: Actor; now: Date; token: () => string }

export interface ReviewPlan {
  writes: RecordWrite[];
  marked: { record: string; content_sha256: string }[];
  /** Left unmarked: the record is no longer what was shown. */
  stale: { record: string; code: "stale_input" }[];
  batch?: string;
}

/**
 * The marks the author asked for. A request that names something that cannot be
 * marked writes nothing; a stale digest leaves only its own record unmarked.
 */
export function planReviewed(corpus: Corpus, request: ReviewedRequest): ReviewPlan {
  const { actor } = request;
  if (actor.kind !== "person") {
    throw new InvalidInput(`A review mark records what a person said, so --actor is person:<name>; a ${actor.kind} actor cannot mark a record reviewed.`);
  }
  const named = new Map<string, string>();
  for (const target of request.targets) {
    const parts = /^([a-z]+-[0-9a-z]+)@([0-9a-f]{64})$/.exec(target);
    if (!parts) throw new InvalidInput("Each record is named as <id>@<64 hexadecimal characters>: its content digest as `unreviewed list` showed it.");
    const [, id, shown] = parts as unknown as [string, string, string];
    if (named.has(id) && named.get(id) !== shown) throw new InvalidInput(`${id} is named with two different digests.`);
    named.set(id, shown);
  }
  const holders = once(corpus, "records by ID, counted", () => {
    const counts = new Map<string, number>();
    for (const f of corpus.records) {
      const id = idOf(f);
      if (id !== undefined) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  });
  const wanted = [...named].map(([id, shown]) => {
    const file = corpus.byId.get(id);
    if (!file?.data) throw new InvalidInput(`No readable record has the ID ${id}.`);
    if (!carriesReview(String(file.data.kind))) throw new InvalidInput(`${id} is a ${String(file.data.kind)} record, which carries no review mark.`);
    if (isRetired(file.data)) throw new InvalidInput(`${id} is retired.`);
    if (holders.get(id)! > 1) throw new InvalidInput(`More than one record has the ID ${id}. See the record.valid finding.`);
    if (!file.formattable) throw new InvalidInput(`${file.path} holds values that rewriting would change. Correct it first.`);
    return { id, shown, file };
  });
  const plan: ReviewPlan = { writes: [], marked: [], stale: [], ...(wanted.length > 1 ? { batch: request.token() } : {}) };
  const decided = { at: stampTime(request.now), by: { ...actor } };
  for (const { id, shown, file } of wanted) {
    if (itemOf(file)!.content_sha256 !== shown) {
      plan.stale.push({ record: id, code: "stale_input" });
      continue;
    }
    const review = { state: "reviewed", content_sha256: shown, decided, ...(plan.batch ? { batch: plan.batch } : {}) };
    plan.writes.push({ id, path: file.path, text: canonical({ ...file.data!, review }) });
    plan.marked.push({ record: id, content_sha256: shown });
  }
  return plan;
}

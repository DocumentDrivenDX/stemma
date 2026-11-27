// The content-store port (Data Design, "Content store and large binaries") and
// what the records say should be in it.
import { compareCodePoints, type Corpus, idOf, isObject, type Json } from "@stemma/records";

export type BlobState = "ok" | "missing" | "altered" | "unreadable";

export interface BlobReader {
  /** Hashes the stored bytes. Only `ok` means the blob is the one its address names. */
  verify(digest: string): BlobState;
  /** The bytes, only when they match the digest. */
  get(digest: string): Uint8Array | undefined;
}

/** Used when no store is available: nothing can be shown to be held. */
export const NO_STORE: BlobReader = { verify: () => "missing", get: () => undefined };

export const isDigest = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);

/** Fields that name a blob, by the kind of record they appear in; `*` is any kind. */
const BLOB_FIELDS: Record<string, string[]> = {
  "*": ["value_blob_sha256", "text_blob_sha256", "entry_text_blob_sha256"],
  capture: ["sha256"], extraction: ["text_sha256"], import_batch: ["original_sha256"],
  image: ["blob_sha256"], conversion: ["input_sha256", "output_sha256"],
};

/** Every blob digest the records name, retired records included, with the files that name it. */
export function referencedBlobs(corpus: Corpus): Map<string, string[]> {
  const found = new Map<string, Set<string>>();
  const add = (digest: Json | undefined, path: string) => {
    if (isDigest(digest)) found.set(digest, (found.get(digest) ?? new Set()).add(path));
  };
  const walk = (value: Json, path: string): void => {
    if (Array.isArray(value)) value.forEach((item) => walk(item, path));
    else if (isObject(value)) {
      for (const [name, item] of Object.entries(value)) {
        if (name === "x") continue;
        if (BLOB_FIELDS["*"]!.includes(name)) add(item, path);
        else walk(item, path);
      }
    }
  };
  for (const file of corpus.records) {
    if (file.state !== "ok" || !file.data) continue;
    const kind = String(file.data.kind);
    for (const name of Object.hasOwn(BLOB_FIELDS, kind) && kind !== "*" ? BLOB_FIELDS[kind]! : []) add(file.data[name], file.path);
    walk(file.data, file.path);
  }
  return new Map([...found].sort(([a], [b]) => compareCodePoints(a, b)).map(([d, paths]) => [d, [...paths].sort(compareCodePoints)]));
}

/** Record files that could not be read, so their references are unknown. */
export const unreadRecords = (corpus: Corpus): string[] =>
  corpus.records.filter((f) => f.state !== "ok").map((f) => f.path);

export interface StoreVerification {
  referenced: number;
  intact: number;
  problems: { sha256: string; state: Exclude<BlobState, "ok">; named_by: string[] }[];
  /** Record files whose references are unknown, so the lists may be incomplete. */
  unread_records: string[];
  unreferenced?: string[];
}

/** `store verify`: referenced blobs that are missing or do not match. Nothing is changed or deleted. */
export function verifyStore(corpus: Corpus, store: BlobReader, stored?: string[]): StoreVerification {
  const referenced = referencedBlobs(corpus);
  const problems: StoreVerification["problems"] = [];
  for (const [sha256, named_by] of referenced) {
    const state = store.verify(sha256);
    if (state !== "ok") problems.push({ sha256, state, named_by });
  }
  return {
    referenced: referenced.size,
    intact: referenced.size - problems.length,
    problems,
    unread_records: unreadRecords(corpus),
    ...(stored ? { unreferenced: stored.filter((d) => !referenced.has(d)).sort(compareCodePoints) } : {}),
  };
}

export const idsAt = (corpus: Corpus, paths: string[]): string[] =>
  paths.map((p) => { const file = corpus.records.find((f) => f.path === p); return (file && idOf(file)) ?? p; });

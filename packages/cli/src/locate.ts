// Where an original can be had from (FR-98; CONTRACT-002 B and B2): `source
// locate`, and the addresses `ingest --fetch` asks in turn. Whatever a location
// is called, its bytes are the original only when their digest is.
import { createHash } from "node:crypto";
import { statSync } from "node:fs";
import { resolve } from "node:path";
import { InvalidInput, LOCATION_KINDS, type LocationKind, planLocation, printable } from "@stemma/core";
import { addressesOf, isObject, type JsonObject } from "@stemma/records";
import { cacheOriginal, FetchRefused, fetchBytes, hashFile, writeProjectFile } from "@stemma/workspace";
import { emit, openCorpus, type Options, reportRecords, requireActor, requireProject, usageError, USER_AGENT, written } from "./context.ts";

const digestOf = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/** One request for one address. A refusal, a failure and any status but 200 are all thrown as FetchRefused. */
async function ask(url: string): Promise<{ bytes: Uint8Array; sha256: string }> {
  const response = await fetchBytes(url, USER_AGENT);
  if (response.status !== 200) throw new FetchRefused(`The address answered ${response.status}.`);
  return { bytes: response.bytes, sha256: digestOf(response.bytes) };
}

/**
 * Asks an upstream's addresses in order until one gives the recorded original,
 * which is kept in the ignored cache. Each address is asked once, in one way.
 */
export async function fetchOriginal(root: string, upstream: JsonObject, label: string, say: (line: string) => void): Promise<string | undefined> {
  const wanted = String(upstream.sha256);
  const addresses = addressesOf(upstream);
  const listed = Array.isArray(upstream.locations) && upstream.locations.length > 0;
  for (const [n, { url, kind }] of addresses.entries()) {
    const where = listed ? `location ${n + 1} of ${addresses.length}, ${printable(url)}${kind ? ` (${kind})` : ""}: ` : "";
    try {
      const gave = await ask(url);
      if (gave.sha256 !== wanted) {
        say(listed ? `  ${label}: ${where}it gives different bytes from the recorded original (sha256 ${gave.sha256}). They were not used.`
          : `  ${label}: what the address gives now differs from the recorded original (sha256 ${gave.sha256}). It was not used.`);
        continue;
      }
      if (listed) say(`  ${label}: ${where}it gave the recorded original.`);
      return cacheOriginal(root, gave.bytes, wanted);
    } catch (error) {
      if (!(error instanceof FetchRefused)) throw error;
      say(`  ${label}: ${where}${error.message} Nothing was retried another way.`);
    }
  }
  if (listed && addresses.length > 0) say(`  ${label}: no listed address gave the recorded original.`);
  return undefined;
}

/** The names of the private copies an upstream lists. */
export const privateLabels = (upstream: JsonObject): string[] =>
  (Array.isArray(upstream.locations) ? upstream.locations.filter(isObject) : []).flatMap((l) => (l.kind === "private" ? [printable(String(l.label))] : []));

export async function sourceLocate(options: Options, name: string | undefined): Promise<number> {
  if (!name) throw usageError("source locate needs an upstream ID, or the ID or citation key of a source with one upstream record.");
  const actor = requireActor(options, "source locate records who added the location");
  const { url, private: label } = options;
  if ((url === undefined) === (label === undefined)) throw usageError("Give one location: --url <address> with --kind, or --private <label>.");
  const kind = label !== undefined ? "private" : options.kind;
  if (label !== undefined && options.kind !== undefined && options.kind !== "private") throw usageError("--private names a private copy, so it takes no other --kind.");
  if (!(LOCATION_KINDS as readonly string[]).includes(kind ?? "") || (url !== undefined && kind === "private")) {
    throw usageError("--url needs --kind publisher, web_archive or archive. A private copy is recorded with --private <label> and no address.");
  }
  if (options.fetch && url === undefined) throw usageError("--fetch asks an address. For a private copy, compare its file with --original <file>.");
  if (options.original !== undefined && label === undefined) throw usageError("--original compares the file of a private copy. For an address, use --fetch, which asks the address itself.");
  const root = requireProject(options);
  const request = {
    upstream: name, kind: kind as LocationKind, actor, ...(url !== undefined ? { url } : {}), ...(label !== undefined ? { label } : {}),
    ...(options.note ? { note: options.note } : {}),
  };
  // Planned once before anything is asked or read, so that a mistake makes no request.
  const first = planLocation(openCorpus(root), { ...request, now: new Date() });
  const lines: string[] = [];
  let gave: string | undefined;
  let failed = false;
  if (options.original !== undefined) {
    const path = resolve(root, options.original);
    try {
      if (!statSync(path).isFile()) throw new Error("not a file");
      gave = hashFile(path).sha256;
    } catch {
      throw new InvalidInput("The file given with --original cannot be read.");
    }
  } else if (options.fetch) {
    try {
      const answer = await ask(url!);
      gave = answer.sha256;
      const upstream = openCorpus(root).byId.get(first.upstream)!.data!;
      if (gave === upstream.sha256) cacheOriginal(root, answer.bytes, gave);
    } catch (error) {
      if (!(error instanceof FetchRefused)) throw error;
      failed = true;
      lines.push(`  not compared: ${error.message} Nothing was retried another way.`);
    }
  }
  const plan = planLocation(openCorpus(root), { ...request, now: new Date(), ...(gave !== undefined ? { gave } : {}) });
  const { record, ...result } = plan;
  if (record) writeProjectFile(root, record.path, record.text);
  const differs = gave !== undefined && plan.bytes === "different";
  const standing = plan.bytes === "same" ? "It was seen to give the recorded original."
    : plan.bytes === "different" ? `It was seen to give different bytes${gave ? ` (sha256 ${gave})` : ""}. It is not the original and is never used as it.`
    : "It was not compared, so it is a reference only.";
  const head = [
    `Upstream ${plan.upstream} of source ${plan.source}`,
    `  ${plan.added ? "added" : "already listed"}: ${request.kind} ${printable(url ?? label!)}`,
    ...plan.notes.map((n) => `  note: ${n}`),
    ...lines,
    `  ${standing}`,
    record ? "No source file was changed." : "Nothing new, so nothing was written.",
  ].join("\n");
  // Something to look at is said by the exit code; nothing is blocked.
  const code = record ? reportRecords(options, written(root, [record.path]), `${head}\n`, result) : (emit(options, result, `${head}\n`), 0);
  return failed || differs ? 1 : code;
}

// `ingest` (CONTRACT-002 B; PRD Core Pipeline, stages 1 and 2): capture what a
// plan lists, then for every upstream record find its original, convert it again
// and compare, make the lookups that are listed and missing, and check. Run
// again at any time; it adds only what is missing or out of date.
import { dirname, resolve } from "node:path";
import {
  assertValid, currentRun, InvalidInput, LIMITS, reconversions, type Resolver, RESOLVERS, resolverFor,
} from "@stemma/core";
import { canonical, type Corpus, isObject, isRetired, type JsonObject, KINDS, parseJson, RECORD_SCHEMA, recordPath } from "@stemma/records";
import {
  cacheOriginal, FetchRefused, fetchBytes, findOriginal, mediaType, type Original, randomToken, readOriginal, writeProjectFile,
} from "@stemma/workspace";
import { createHash } from "node:crypto";
import { CommandError, namedFile, openCorpus, type Options, requireActor, requireProject, tools, usageError, USER_AGENT } from "./context.ts";
import { fetchOriginal, type Other, privateLabels } from "./locate.ts";
import { restoreText } from "./restore.ts";
import { convertAndWrite, lookUp, reconvert } from "./sources.ts";

const list = (value: unknown): JsonObject[] => (Array.isArray(value) ? value.filter(isObject) : []);
const text = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);
const active = (corpus: Corpus, kind: string) => corpus.records.filter((f) => f.state === "ok" && f.data?.kind === kind && !isRetired(f.data));

function planEntries(options: Options, root: string): { entries: JsonObject[]; base: string } {
  if (!options.plan) return { entries: [], base: root };
  const path = resolve(root, options.plan);
  const bytes = namedFile(root, options.plan, LIMITS.page_map_bytes)!;
  let value;
  try {
    value = parseJson(new TextDecoder("utf-8", { fatal: true }).decode(bytes)).value;
  } catch {
    throw new InvalidInput("The plan is not readable JSON.");
  }
  if (!isObject(value) || !Array.isArray(value.captures)) throw new InvalidInput('A plan is an object with a "captures" list.');
  return { entries: list(value.captures), base: dirname(path) };
}

const asOriginal = (bytes: Uint8Array, name: string): Original => {
  const type = mediaType(bytes, name);
  if (!type) throw new InvalidInput(`What was fetched from ${name} is not a kind of file Stemma reads.`);
  return { bytes, sha256: createHash("sha256").update(bytes).digest("hex"), size: bytes.length, media_type: type };
};

/** A file that cannot be converted stops ingest. What it finished before that file is whole, and stays. */
const during = <T>(work: Promise<T>): Promise<T> => work.catch((error) => {
  if (!(error instanceof InvalidInput)) throw error;
  throw new CommandError(5, "invalid_input", `${error.message} No source file or record was written for it; what ingest wrote before it stays.`);
});

export async function ingest(options: Options, check: (options: Options) => number): Promise<number> {
  const actor = requireActor(options, "ingest records who ran it");
  const root = requireProject(options);
  const places = (options.originals ?? []).map((p) => resolve(root, p));
  const log: string[] = [];
  const say = (line: string) => {
    log.push(line);
    if (options.format === "text") process.stdout.write(`${line}\n`);
  };
  const { entries, base } = planEntries(options, root);

  say("== 1. Capture");
  for (const [n, entry] of entries.entries()) {
    const corpus = openCorpus(root);
    const source = text(entry.source);
    const record = source ? corpus.byId.get(source)?.data : undefined;
    if (!source || record?.kind !== "source") throw usageError(`Plan entry ${n + 1} names no source record in the project.`);
    const label = String(record.citation_key ?? source);
    const url = text(entry.url);
    const upstreams = active(corpus, "upstream").filter((u) => u.data!.source === source);
    if (url && upstreams.some((u) => u.data!.url === url)) continue;
    let original: Original;
    let retrieved = text(entry.retrieved_at);
    const file = text(entry.file);
    if (file) {
      original = readOriginal(resolve(base, file), LIMITS.input_bytes);
      if (!retrieved) throw usageError(`Plan entry ${label} gives a file, so it must say when it was retrieved (retrieved_at); that is never guessed.`);
    } else if (url && options.fetch) {
      try {
        const response = await fetchBytes(url, USER_AGENT);
        if (response.status !== 200) throw new FetchRefused(`The address answered ${response.status}.`);
        original = asOriginal(response.bytes, new URL(url).pathname);
        retrieved = new Date().toISOString().replace(/\.\d+Z$/, "Z");
      } catch (error) {
        if (!(error instanceof FetchRefused)) throw error;
        say(`  ${label}: ${error.message} Nothing was retried another way. Obtain the file yourself and name it in the plan.`);
        continue;
      }
    } else {
      say(`  ${label}: no file is named, and fetching was not asked for (--fetch).`);
      continue;
    }
    if (upstreams.some((u) => u.data!.sha256 === original.sha256)) continue;
    const auxiliary: JsonObject[] = [];
    let pageNumbers: string | undefined;
    for (const aux of list(entry.auxiliary)) {
      const path = text(aux.file);
      if (!path || !text(aux.url)) continue;
      const found = namedFile(base, path, LIMITS.page_map_bytes)!;
      auxiliary.push({ role: String(aux.role), url: String(aux.url), sha256: createHash("sha256").update(found).digest("hex"), size: found.length });
      if (aux.role === "page_numbers") pageNumbers = resolve(base, path);
    }
    const id = `${KINDS.upstream!.prefix}${randomToken()}`;
    const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
    const upstream = {
      schema: RECORD_SCHEMA, id, kind: "upstream", created: { at: now, by: { ...actor } }, source,
      ...(url ? { url } : {}), retrieved_at: retrieved!, retrieved_by: { ...actor }, sha256: original.sha256, size: original.size,
      media_type: original.media_type, ...(text(entry.version) ? { version: text(entry.version)! } : {}),
      ...(Array.isArray(entry.identifiers) ? { identifiers: entry.identifiers } : {}),
      ...(auxiliary.length > 0 ? { auxiliary } : {}), ...(Array.isArray(entry.lookups) ? { lookups: entry.lookups } : {}),
      ...(text(entry.note) ? { note: text(entry.note)! } : {}),
    };
    assertValid("Upstream", "upstream", canonical(upstream));
    cacheOriginal(root, original.bytes, original.sha256);
    const held = [...corpus.texts.values()].some((t) => t.manifest.data!.source === source && !isRetired(t.manifest.data!)
      && list((t.manifest.data!.original as JsonObject).files).some((f) => f.sha256 === original.sha256));
    if (!held) {
      const convert = isObject(entry.convert) ? entry.convert : {};
      const done = await during(convertAndWrite({
        root, corpus, originals: [original], named: file ?? url!, actor,
        ...(isObject(convert.identity) ? { identity: convert.identity } : {}),
        options: {
          format: "json", source, "acquired-at": retrieved!, origin: url ?? text(convert.obtained_from) ?? "supplied by the author",
          ...(text(entry.version) ? { "source-version": text(entry.version)! } : {}),
          ...(text(convert.method) ? { method: text(convert.method)! } : {}),
          ...(text(convert.recognition) ? { recognition: text(convert.recognition)! } : {}),
          ...(text(convert.name) ? { name: text(convert.name)! } : {}),
          ...(text(convert.coverage_note) ? { "coverage-note": text(convert.coverage_note)! } : {}),
          ...(text(convert.page_map) ? { "page-map": resolve(base, text(convert.page_map)!) } : original.media_type === "application/pdf" ? { "auto-pages": true } : {}),
          ...(pageNumbers ? { "page-numbers": pageNumbers } : {}),
        },
      }));
      say(`  ${label}: ${done.plan.parts} ${done.plan.paged ? "pages" : "sections"} written to ${done.plan.directory}/ (${done.converted.method}${done.plan.paged ? `, ${done.labelled} labelled` : ""})`);
    }
    writeProjectFile(root, recordPath("upstream", id), canonical(upstream));
  }

  say("== 2. Reverify against originals");
  const upstreams = active(openCorpus(root), "upstream");
  let compared = 0;
  let current = 0;
  const unavailable: string[] = [];
  for (const upstream of upstreams) {
    const data = upstream.data!;
    const corpus = openCorpus(root);
    const label = String(corpus.byId.get(String(data.source))?.data?.citation_key ?? data.source);
    const mine = [...corpus.texts].filter(([, t]) => t.manifest.data!.source === data.source && !isRetired(t.manifest.data!)
      && list((t.manifest.data!.original as JsonObject).files).some((f) => f.sha256 === data.sha256));
    // A current comparison need not be made again; --reconvert makes it all the same.
    const wanted = { sha256: String(data.sha256), size: Number(data.size) };
    let path = findOriginal(root, wanted, places);
    const others: Other[] = [];
    const absent = mine.filter(([, t]) => t.notHeld);
    if (!path && options.fetch) path = await fetchOriginal(root, data, label, say, absent.length > 0 ? others : undefined);
    else if (path && Array.isArray(data.locations)) say(`  ${label}: the recorded original is in .stemma/originals/ or a place given with --originals, so no address was asked.`);
    // The digest was matched when the file was found; it is read as that kind of original.
    const original = path ? { ...readOriginal(path, LIMITS.input_bytes), media_type: String(data.media_type), name: path } : undefined;
    // Text that is not here is written again first, so that it can then be compared like any other.
    for (const [, loaded] of absent) {
      const entry = entries.find((e) => e.source === data.source && text(e.url) === text(data.url));
      if (original) {
        say(`  ${label}: ${(await restoreText(root, loaded, original, entry, base)).said}`);
        continue;
      }
      // Bytes that are not the original may still hold the same text. Only the manifest's digests can say so.
      let restored = false;
      for (const other of others) {
        if (mediaType(other.bytes, new URL(other.url).pathname) !== data.media_type) continue;
        const done = await restoreText(root, loaded, { ...other, size: other.bytes.length, media_type: String(data.media_type), name: other.url }, entry, base, other.url);
        say(`  ${label}: ${done.said}`);
        if ((restored = done.restored)) break;
      }
      if (!restored) say(`  ${label}: the text of ${loaded.directory}/ is not held here, and its original was not available, so it was not restored.`);
    }
    const now = openCorpus(root);
    const todo = mine.map(([id]) => {
      const loaded = now.texts.get(id)!;
      return { id, loaded, standing: reconversions(now, id).find((r) => currentRun(r.data!, loaded, tools()))?.data };
    }).filter((m) => options.reconvert || !m.standing);
    current += mine.length - todo.length;
    if (!original) {
      for (const privately of privateLabels(data)) say(`  ${label}: a private copy is recorded as "${privately}", and no file with the original's digest was found. Give the copy or its folder with --originals.`);
      unavailable.push(label);
      continue;
    }
    for (const { id, loaded, standing } of todo) {
      // Already reported above.
      if (loaded.notHeld) continue;
      if (!loaded.usable) {
        say(`  ${label}: ${loaded.directory} is damaged, so it was not compared.`);
        continue;
      }
      const done = await during(reconvert(root, openCorpus(root), id, original, actor, standing));
      if (!done.reconvertible) say(`  ${label}: its text was supplied, so it cannot be made again from the original.`);
      else {
        compared++;
        say(`  ${label}: converted again; ${done.parts - done.differing.length} of ${done.parts} parts agree${done.recorded ? "" : ", as already recorded"}`);
      }
    }
  }
  say(`  ${compared} source file(s) converted again, ${current} already had a current comparison.`);
  if (unavailable.length > 0) {
    say(`  No original was available for: ${unavailable.join(", ")}. Their text was not compared with it. Give --originals <dir>, or --fetch to fetch from the recorded addresses.`);
  }

  say("== 3. Catalogue lookups");
  const refresh = options["refresh-lookups"] === true;
  let made = 0;
  let saved = 0;
  for (const upstream of upstreams) {
    for (const lookup of list(upstream.data!.lookups)) {
      const identifier = isObject(lookup.identifier) ? lookup.identifier : {};
      const [resolver, scheme, value] = [String(lookup.resolver) as Resolver, String(identifier.scheme), String(identifier.value)];
      const source = String(upstream.data!.source);
      const have = active(openCorpus(root), "resolution").some((r) => r.data!.source === source && r.data!.resolver === resolver && isObject(r.data!.identifier) && r.data!.identifier.value === value);
      if (have && !refresh) {
        saved++;
        continue;
      }
      if (!options.fetch && !refresh) {
        say(`  ${resolver} ${value}: no saved response, and the network was not asked for (--fetch).`);
        continue;
      }
      if (!RESOLVERS.includes(resolver) || resolverFor(scheme) !== resolver) {
        say(`  ${resolver} ${value}: this version does not make that lookup.`);
        continue;
      }
      try {
        await lookUp(root, source, resolver, scheme, value, actor);
        made++;
      } catch (error) {
        if (!(error instanceof FetchRefused)) throw error;
        say(`  ${resolver} ${value}: ${error.message} Nothing was retried another way.`);
      }
    }
  }
  say(`  ${made} lookup(s) made, ${saved} already saved.`);

  say("== 4. Check");
  return check(options);
}

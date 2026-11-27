// Iterative capture (FR-94; CONTRACT-002 B): capture an original, add library
// details and tags over time, list sources by tag and stage, and show how each
// came to be as it is. None of these writes a source file.
import { resolve } from "node:path";
import {
  type Detail, findSource, HAS, type Has, InvalidInput, LIMITS, listSources, planCapture, planEnrich, planTags, printable, sourceHistory,
  STAGES, type Stage,
} from "@stemma/core";
import { cacheOriginal, randomToken, readOriginal, writeProjectFile } from "@stemma/workspace";
import { emit, openCorpus, type Options, reportRecords, requireActor, requireProject, usageError, written } from "./context.ts";

export const TIME = /^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d+)?)?(Z|[+-]\d\d:\d\d)$/;

export function sourceCapture(options: Options, file: string | undefined): number {
  if (!file) throw usageError("source capture needs an original file.");
  const actor = requireActor(options, "source capture records who captured the original");
  if (!options["acquired-at"] || !TIME.test(options["acquired-at"])) {
    throw usageError("source capture records when you got the original and does not guess it: give --acquired-at, for example 2026-01-05T09:58:00Z.");
  }
  const root = requireProject(options);
  const original = readOriginal(resolve(root, file), LIMITS.input_bytes);
  const plan = planCapture(openCorpus(root), {
    original, retrieved_at: options["acquired-at"], actor, now: new Date(), token: randomToken,
    ...(options.source !== undefined ? { source: options.source } : {}), ...(options.origin ? { origin: options.origin } : {}),
    ...(options["source-version"] ? { version: options["source-version"] } : {}),
  });
  cacheOriginal(root, original.bytes, original.sha256);
  const { records, ...result } = plan;
  if (records.length === 0) {
    emit(options, { ...result, sha256: original.sha256 }, `This original is already held for source ${plan.source} (sha256 ${original.sha256}). Nothing was written. To record it for another source too, name that source with --source.\n`);
    return 0;
  }
  for (const record of records) writeProjectFile(root, record.path, record.text);
  const head = [
    `Captured the original for source ${plan.source}${plan.new_source ? " (new, a candidate)" : ""}.`,
    `  sha256 ${original.sha256} (${original.size} bytes, ${original.media_type}); a copy is in .stemma/originals/, which git ignores`,
    "It has no text yet. When you want it: source convert <original> --source " + plan.source + " --actor <kind>:<name>",
  ].join("\n");
  return reportRecords(options, written(root, records.map((r) => r.path)), `${head}\n`, { ...result, sha256: original.sha256 });
}

/** "doi:10.1/x" or "name=value", as the option takes it. */
const pair = (value: string, mark: string, option: string): Detail => {
  const at = value.indexOf(mark);
  const [field, rest] = [value.slice(0, at).trim(), value.slice(at + 1).trim()];
  if (at < 1 || !field || !rest) throw usageError(`--${option} is written <name>${mark}<value>.`);
  return { field, value: rest };
};

export function sourceEnrich(options: Options, name: string | undefined): number {
  if (!name) throw usageError("source enrich needs a source ID or citation key.");
  const actor = requireActor(options, "source enrich records who added the details");
  const identifiers = (options["add-identifier"] ?? []).map((v) => pair(v, ":", "add-identifier"));
  const details = (options.set ?? []).map((v) => pair(v, "=", "set"));
  const authors = options.author ?? [];
  if (!options.lookup && identifiers.length + details.length + authors.length === 0) {
    throw usageError("source enrich needs --add-identifier, --set, --author, or --lookup.");
  }
  const root = requireProject(options);
  const plan = planEnrich(openCorpus(root), {
    source: name, identifiers, details, authors, replace: options.replace === true, actor, now: new Date(),
    ...(options.lookup ? { lookup: options.lookup } : {}), ...(options.from ? { from: options.from } : {}),
  });
  const { record, ...result } = plan;
  if (record) writeProjectFile(root, record.path, record.text);
  const lines = [
    ...plan.added.map((d) => `  added ${d.field}: ${printable(d.value)}`),
    ...plan.replaced.map((d) => `  replaced ${d.field}: ${printable(d.previous)} -> ${printable(d.value)}`),
    ...(plan.same.length > 0 ? [`  already recorded and agreeing: ${plan.same.join(", ")}`] : []),
    ...plan.notes.map((n) => `  note: ${printable(n)}`),
    ...(plan.disagreements.length > 0 ? ["Disagreements. The recorded value was kept:",
      ...plan.disagreements.map((d) => `  ${d.field}\n    recorded: ${printable(d.recorded)}\n    offered:  ${printable(d.offered)}`),
      "To take an offered value, give it with --set, --author or --add-identifier, plus --replace and --from."] : []),
    record ? `From: ${printable(plan.from)}. No source file was changed.` : "Nothing new, so nothing was written.",
  ];
  const head = `Source ${plan.source}\n${lines.join("\n")}\n`;
  // A disagreement is something to look at, so the exit code says so; nothing is blocked.
  const code = record ? reportRecords(options, written(root, [record.path]), head, result) : (emit(options, result, head), 0);
  return plan.disagreements.length > 0 ? 1 : code;
}

export function sourceTag(options: Options, names: string[]): number {
  const add = options.add ?? [];
  const remove = options.remove ?? [];
  if (names.length === 0 || add.length + remove.length === 0) throw usageError("source tag needs one or more source IDs or citation keys, with --add <tag> or --remove <tag>.");
  const actor = requireActor(options, "source tag records who changed the tags");
  const root = requireProject(options);
  const corpus = openCorpus(root);
  const now = new Date();
  // Every request is planned before any is written, so a mistake changes nothing.
  const plans = [...new Set(names.map((name) => findSource(corpus, name).data!.id as string))]
    .map((source) => planTags(corpus, { source, add, remove, actor, now, ...(options.from ? { from: options.from } : {}) }));
  for (const { record } of plans) if (record) writeProjectFile(root, record.path, record.text);
  const lines = plans.map((p) => {
    const changed = [...p.added.map((t) => `+${t}`), ...p.removed.map((t) => `-${t}`)].join(" ");
    return `${p.source}: ${changed || "no change"}; tags now: ${p.tags.join(", ") || "none"}`;
  });
  emit(options, { sources: plans.map(({ record, ...rest }) => rest) }, `${lines.join("\n")}\n`);
  return 0;
}

export function sourceList(options: Options): number {
  const stage = options.stage;
  if (stage !== undefined && !(STAGES as readonly string[]).includes(stage)) throw usageError(`--stage is one of ${STAGES.join(", ")}.`);
  const has = options.has ?? [];
  if (has.some((h) => !(HAS as readonly string[]).includes(h))) throw usageError(`--has is one of ${HAS.join(", ")}.`);
  const sources = listSources(openCorpus(requireProject(options)), {
    ...(options.tag ? { tags: options.tag } : {}), ...(stage ? { stage: stage as Stage } : {}), has: has as Has[],
  });
  const counts = new Map<string, number>();
  for (const tag of sources.flatMap((s) => s.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  const lines = sources.map((s) => [
    `${s.citation_key ?? "(no key)"}  ${s.source}  ${s.stage}${s.has.length > 0 ? `; has ${s.has.join(", ")}` : ""}`,
    `    ${printable(s.title ?? "(no title recorded)")}${s.tags.length > 0 ? `\n    tags: ${s.tags.join(", ")}` : ""}`,
  ].join("\n"));
  const tagLine = [...counts].sort(([a], [b]) => (a < b ? -1 : 1)).map(([t, n]) => `${t} (${n})`).join(", ");
  emit(options, { sources }, `${[...lines, `${sources.length} source(s).${tagLine ? ` Tags: ${tagLine}.` : ""}`].join("\n")}\n`);
  return 0;
}

export function sourceHistoryCommand(options: Options, name: string | undefined): number {
  if (!name) throw usageError("source history needs a source ID or citation key.");
  const history = sourceHistory(openCorpus(requireProject(options)), name);
  if (history.events.length === 0) throw new InvalidInput("That source record has no dated events.");
  const lines = history.events.map((e) => `${e.at}  ${printable(e.by)}  ${printable(e.what)}  [${e.record}]${e.from ? `\n    from: ${printable(e.from)}` : ""}`);
  emit(options, history, `${[`History of ${history.source}, from the project's records. A hand edit shows only in git.`, ...lines].join("\n")}\n`);
  return 0;
}

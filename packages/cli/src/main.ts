// The stemma command line (CONTRACT-002). Findings never stop a command: exit 1
// only says that something is open.
import { Database } from "bun:sqlite";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  ActorNeeded, type Actor, type CheckReport, formatPlan, InvalidInput, prepareRecord, renderFindings, renderReport, type Result,
  runChecks, validateFiles, type BlobReader, DuplicateCopy, LIMITS, NoExtractor, NO_STORE, planAddSource, planSourceText,
  ranges, referencedBlobs, verifyStore, unreadRecords,
} from "@stemma/core";
import { canonical, type Corpus, KINDS, loadCorpus } from "@stemma/records";
import {
  AlreadyInitialized, BlobStore, findProject, initProject, inspectSourceFile, projectRelative, randomToken, readProject,
  storeLocation, storeProblem, UnsafePath, UnsafeStore, UnsupportedFile, writeProjectFile,
} from "@stemma/workspace";
import manifest from "../../../.claude-plugin/plugin.json";
import { ISOLATION_FLAGS, PINNED_BUN, runtimeProblem } from "./runtime.ts";

const VERSION: string = manifest.version;
const REPORT_PATH = ".stemma/reports/check.json";

const USAGE = `stemma ${VERSION}
The plugin runs this through its launcher: sh scripts/stemma.sh <data directory> <command> [options]

  version
  doctor
  init --project <dir>
  record add <kind> --input <file|-> [--actor <person|model|software>:<name>]
  validate [paths]
  fmt [paths]
  rules check
  check [--changed | --all]
  source add <file> --acquired-at <time> --actor <kind>:<name> [--source <id>] [--origin <text>]
             [--source-version <text>] [--unpublished yes|no] [--community-restricted yes|no] [--license <text>]
  source text <capture id> --actor <kind>:<name> [--text-layer <file>] [--page-map <file>]
             [--method text_layer|ocr|manual] [--tool <name> --tool-version <version>] [--note <text>]
  store verify [--unreferenced]

Options: --project <dir> (default: nearest ancestor holding stemma.json), --format text|json,
--store-dir <dir> (private content store; else STEMMA_STORE_DIR, else a per-user directory)
Exit codes: 0 done, nothing open; 1 done, findings open; 2 usage or not implemented;
3 project unreadable; 4 wrong runtime; 5 request not valid; 70 internal error.
`;

/** Commands CONTRACT-002 B names that this version does not have yet. */
const NOT_YET = new Set([
  "migrate", "capture", "key", "resolve", "excerpt", "unreviewed", "reviewed", "retire", "rounds",
  "review", "support", "annotate", "import", "export", "takeover", "index", "research", "setup", "log", "activity",
  "plan", "voice", "audit", "checkpoint", "authorship", "restricted", "build", "disclosure", "scan", "graph", "map",
]);

class CommandError extends Error {
  constructor(readonly exit: 2 | 3 | 4 | 5 | 70, readonly code: string, message: string, readonly paths: string[] = []) {
    super(message);
  }
}
const usage = (message: string) => new CommandError(2, "usage", `${message}\n\n${USAGE}`);

interface Options {
  project?: string; format: "text" | "json"; input?: string; actor?: string; changed?: boolean; all?: boolean;
  "store-dir"?: string; source?: string; origin?: string; "acquired-at"?: string; "source-version"?: string;
  unpublished?: string; "community-restricted"?: string; license?: string; "text-layer"?: string; "page-map"?: string;
  method?: string; tool?: string; "tool-version"?: string; note?: string; unreferenced?: boolean;
}

/** The options each of these commands takes beyond --project, --format and --store-dir. */
const COMMAND_OPTIONS: Record<string, (keyof Options)[]> = {
  "source add": ["actor", "source", "origin", "acquired-at", "source-version", "unpublished", "community-restricted", "license"],
  "source text": ["actor", "text-layer", "page-map", "method", "tool", "tool-version", "note"],
  "store verify": ["unreferenced"],
  "record add": ["actor", "input"],
  check: ["changed", "all"],
};

function emit(options: Options, json: unknown, text: string): void {
  process.stdout.write(options.format === "json" ? canonical(json) : text);
}

function requireProject(options: Options): string {
  const root = options.project ? resolve(options.project) : findProject(process.cwd());
  if (!root) throw new CommandError(3, "no_project", "No stemma.json was found here or above. Pass --project <dir>, or run init.");
  return root;
}

function openCorpus(root: string): Corpus {
  const corpus = loadCorpus(readProject(root));
  const { state, data } = corpus.settings;
  if (state === "version_unsupported") {
    throw new CommandError(3, "version_unsupported", "stemma.json was written by a newer Stemma. Update Stemma; nothing was changed.", ["stemma.json"]);
  }
  if (!data) {
    throw new CommandError(3, "project_unreadable", "stemma.json is missing or cannot be read as JSON, so nothing was checked.", ["stemma.json"]);
  }
  return corpus;
}

const sqliteVersion = (): string => {
  const database = new Database(":memory:");
  try {
    return (database.query("select sqlite_version() as v").get() as { v: string }).v;
  } finally {
    database.close();
  }
};

const tools = () => ({ stemma: VERSION, bun: Bun.version, sqlite: sqliteVersion() });

function version(options: Options): number {
  emit(options, { stemma: VERSION, bun_pinned: PINNED_BUN }, `stemma ${VERSION} (needs Bun ${PINNED_BUN})\n`);
  return 0;
}

function storeLines(store: ReturnType<typeof storeStatus> | { note: string }): string[] {
  if ("note" in store) return [`Content store: ${store.note}`];
  return [
    `Content store: ${store.path} (chosen by ${store.chosen_by}; ${store.exists ? "present" : "not created yet"})`,
    ...(store.refused ? [`WARNING: this location is refused: ${store.refused}.`] : []),
    `Stored files: ${store.blobs_present} of ${store.blobs_named} that records name are present (not hashed here; \`store verify\` does that).${store.unread_records ? ` ${store.unread_records} record file(s) cannot be read.` : ""}`,
    BACKUP_NOTICE,
  ];
}

/** git is asked only whether it ignores a content store that sits in a working tree. */
function gitVersion(): string {
  try {
    const done = Bun.spawnSync(["git", "--version"]);
    if (done.exitCode === 0) return `Besides Bun, ${done.stdout.toString().trim()} is asked only whether a content store inside a git working tree is ignored.`;
  } catch {
    // Reported below.
  }
  return "git was not found. Besides Bun it is used only for a content store inside a git working tree, which is then refused.";
}

function doctor(options: Options): number {
  const flags = Object.fromEntries(ISOLATION_FLAGS.map((f) => [f, process.execArgv.includes(f)]));
  const project = options.project ? resolve(options.project) : findProject(process.cwd());
  const info = {
    ...tools(),
    bun_pinned: PINNED_BUN,
    bun_path: process.execPath,
    bundle_path: Bun.main,
    working_directory: process.cwd(),
    project: project ?? "",
    start_flags: flags,
    platform: `${process.platform}-${process.arch}`,
    platform_status: "Development tests have run on macOS (Apple silicon) only. No release has been observed on any system; other systems and desktop apps are untested.",
    external_tools: gitVersion(),
    source_limits: LIMITS,
    store: project && existsSync(join(project, "stemma.json")) ? storeStatus(project, options) : { note: "No project, so no content store." },
  };
  const missing = ISOLATION_FLAGS.filter((f) => !flags[f]);
  const lines = [
    `stemma ${info.stemma}`,
    `Bun ${info.bun} (pinned ${PINNED_BUN}) at ${info.bun_path}`,
    `SQLite ${info.sqlite}`,
    `Command line: ${info.bundle_path}`,
    `Working directory: ${info.working_directory}`,
    `Project: ${info.project || "none found"}`,
    `Platform: ${info.platform}. ${info.platform_status}`,
    info.external_tools,
    ...storeLines(info.store),
    `Limits on added files: ${LIMITS.input_bytes / 1048576} MiB for a copy, ${LIMITS.text_bytes / 1048576} MiB and ${LIMITS.pages} pages for its text.`,
    missing.length === 0
      ? "Start flags: no run-time downloads, and no .env or bunfig.toml is loaded."
      : `WARNING: started without ${missing.join(" ")}. A .env or bunfig.toml in the working directory could run code or change settings.`,
  ];
  emit(options, info, `${lines.join("\n")}\n`);
  return 0;
}

function init(options: Options): number {
  // No default: the documented invocation's working directory is the plugin root.
  if (!options.project) throw usage("init needs --project <dir>.");
  const root = resolve(options.project);
  const made = initProject(root);
  emit(options, { project: root, ...made }, `Created a Stemma project in ${root}\n${made.written.map((f) => `  wrote ${f}`).join("\n")}\n`);
  return 0;
}

/** Record results for chosen files, with the exit code they imply. */
function reportRecords(options: Options, results: Result[], head: string, extra: object): number {
  const open = results.filter((r) => r.open);
  const body = open.length === 0 ? "No record problems found.\n" : `${open.length} record problem(s). Nothing is blocked.${renderFindings(results).join("\n")}\n`;
  emit(options, { ...extra, results }, `${head}${body}`);
  return open.length > 0 ? 1 : 0;
}

function actorOf(options: Options): Actor | undefined {
  const named = /^(person|model|software):(.+)$/.exec(options.actor ?? "");
  if (options.actor !== undefined && !named) throw usage("--actor is person:<name>, model:<name> or software:<name>.");
  return named ? { kind: named[1] as Actor["kind"], name: named[2]! } : undefined;
}

const unsafeStore = (path: string, why: string) =>
  new CommandError(5, "unsafe_store", `The content store cannot be ${path}: ${why}. Nothing was stored or read there.`, [path]);

/** The store for this project, refused when it is in a place that could publish copies. */
function openStore(root: string, corpus: Corpus, options: Options): { store: BlobStore; path: string; chosen_by: string } {
  const location = storeLocation(root, corpus.settings.data?.project_id, options["store-dir"]);
  const why = storeProblem(root, location.path);
  if (why) throw unsafeStore(location.path, why);
  return { store: new BlobStore(location.path), ...location };
}

const BACKUP_NOTICE = "The content store is private, apart from the repository, and Stemma never copies it anywhere: backing it up is your task.";
const MODEL_NOTICE = "Stemma holds back no source: any source in this project may be sent to a hosted model.";

function sourceAdd(options: Options, file: string | undefined): number {
  if (!file) throw usage("source add needs a file.");
  if (/^[a-z][a-z0-9+.-]+:\/\//i.test(file)) {
    throw new CommandError(2, "not_implemented", "Adding from a web address is not implemented in this version. Nothing was fetched. Add a file instead.");
  }
  const actor = actorOf(options);
  if (!actor) throw usage("source add records who added the copy: give --actor.");
  if (!options["acquired-at"]) {
    throw usage("source add records when you got the copy and does not guess it: give --acquired-at, for example 2026-01-05T09:58:00Z.");
  }
  const flag = (name: "unpublished" | "community-restricted") => {
    const value = options[name];
    if (value !== undefined && value !== "yes" && value !== "no") throw usage(`--${name} is yes or no.`);
    return value === undefined ? undefined : value === "yes";
  };
  const rights = { unpublished: flag("unpublished"), community_restricted: flag("community-restricted"), license: options.license };
  const root = requireProject(options);
  const corpus = openCorpus(root);
  const { store, path } = openStore(root, corpus, options);
  const from = resolve(root, file);
  const found = inspectSourceFile(from, LIMITS.input_bytes);
  const plan = planAddSource(corpus, {
    ...found, acquired_at: options["acquired-at"], rights: Object.fromEntries(Object.entries(rights).filter(([, v]) => v !== undefined)),
    ...(options.source === undefined ? {} : { source: options.source }),
    ...(options.origin === undefined ? {} : { origin: options.origin }),
    ...(options["source-version"] === undefined ? {} : { source_version: options["source-version"] }),
    actor, now: new Date(), token: randomToken,
  });
  const existing = new Set(readProject(root).records.map((f) => f.path));
  if (plan.state === "add" && existing.has(plan.capture.path)) throw new InvalidInput(`${plan.capture.path} already exists.`);
  // The record is written only after the blob is in the store (BR-201).
  const stored = store.put({ file: from }, found.sha256);
  for (const record of plan.records) writeProjectFile(root, record.path, record.text);
  const capture = plan.state === "add" ? plan.capture.id : plan.capture;
  const wrote = new Set(plan.records.map((r) => r.path));
  const results = validateFiles(openCorpus(root), wrote);
  const head = [
    plan.state === "add" ? `Stored the copy and recorded it as ${capture}.` : `This source already has this copy (${capture}); no second record was written.`,
    `  source: ${plan.source}${plan.state === "add" && plan.new_source ? " (new, a candidate; it has no citation key yet)" : ""}`,
    `  sha256: ${found.sha256} (${found.size} bytes, ${found.media_type})`,
    `  store: ${path} (${stored === "present" ? "already held these bytes" : stored === "restored" ? "a damaged blob was replaced by matching bytes" : "stored and verified"})`,
    ...(plan.state === "add" ? [
      `  origin: ${options.origin ?? "unknown"}`,
      `  acquired at: ${options["acquired-at"]}`,
      `  version: ${options["source-version"] ?? "unknown"}`,
      `  added by: ${actor.kind} ${actor.name} (a record of what was said, not proof)`,
    ] : []),
    ...plan.records.map((r) => `  wrote ${r.path}`),
    BACKUP_NOTICE, MODEL_NOTICE,
    `Next: attach its text with \`source text ${capture}\`.`,
  ].join("\n");
  return reportRecords(options, results, `${head}\n`, {
    source: plan.source, capture, state: plan.state, store: path, blob: stored, ...found, notices: [BACKUP_NOTICE, MODEL_NOTICE],
  });
}

/** A file the author names for this command; read whole, within a size limit. */
function named(root: string, file: string | undefined, limit: number): Uint8Array | undefined {
  if (file === undefined) return undefined;
  const path = resolve(root, file);
  try {
    const stat = statSync(path);
    if (stat.isFile() && stat.size <= limit) return new Uint8Array(readFileSync(path));
  } catch {
    // Reported below.
  }
  throw new InvalidInput(`${file} cannot be read, is not a regular file, or is over the size limit.`);
}

function sourceText(options: Options, capture: string | undefined): number {
  if (!capture) throw usage("source text needs a capture ID.");
  const actor = actorOf(options);
  if (!actor) throw usage("source text records who attached the text: give --actor.");
  const { method, tool } = options;
  if (method !== undefined && !["text_layer", "ocr", "manual"].includes(method)) throw usage("--method is text_layer, ocr or manual.");
  if ((tool === undefined) !== (options["tool-version"] === undefined)) throw usage("Give --tool and --tool-version together.");
  const root = requireProject(options);
  const corpus = openCorpus(root);
  const held = corpus.byId.get(capture)?.data;
  if (held?.kind !== "capture" || typeof held.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(held.sha256)) {
    throw new InvalidInput(`No usable capture record has the ID ${capture}.`);
  }
  const { store, path } = openStore(root, corpus, options);
  const copy = store.get(held.sha256);
  if (!copy) {
    throw new CommandError(5, "copy_not_held", `The stored copy ${held.sha256} is missing from ${path} or does not match its digest, so no text can be tied to it. Restore it, or add the same file again.`, [path]);
  }
  const layer = named(root, options["text-layer"], LIMITS.text_bytes);
  const pageMap = named(root, options["page-map"], LIMITS.page_map_bytes);
  const plan = planSourceText(corpus, {
    capture, copy, ...(layer ? { layer } : {}), ...(pageMap ? { pageMap } : {}),
    ...(method ? { method: method as "ocr" } : {}),
    ...(tool ? { tool: { name: tool, version: options["tool-version"]! } } : {}),
    ...(options.note ? { note: options.note } : {}),
    stemma: VERSION, actor, now: new Date(), token: randomToken,
  });
  if (readProject(root).records.some((f) => f.path === plan.record.path)) throw new InvalidInput(`${plan.record.path} already exists.`);
  store.put({ bytes: plan.text }, plan.text_sha256);
  writeProjectFile(root, plan.record.path, plan.record.text);
  const pages = plan.pages === 0 ? ["  pages: none (plain text without page breaks)"] : [
    `  pages: ${plan.pages}, split at the form feeds in the text`,
    `  without a printed label (file page indexes, from 0): ${plan.unmapped.length === 0 ? "none" : ranges(plan.unmapped)}. No label is worked out from a page's position.`,
  ];
  const supplied = plan.method === "born_text" ? [] : [
    "Stemma did not make this text and did not compare it with the copy, page by page or at all: that it is the copy's text, with the pages in step, rests on what you supplied.",
  ];
  const head = [
    `Saved the text as ${plan.record.id}.`,
    `  method: ${plan.method}, quality unassessed`,
    `  sha256: ${plan.text_sha256} (${plan.text.length} bytes)`,
    ...pages, `  wrote ${plan.record.path}`, ...supplied,
  ].join("\n");
  return reportRecords(options, validateFiles(openCorpus(root), new Set([plan.record.path])), `${head}\n`, {
    extraction: plan.record.id, text_sha256: plan.text_sha256, pages: plan.pages, unmapped: plan.unmapped, method: plan.method,
  });
}

function storeVerify(options: Options): number {
  const root = requireProject(options);
  const corpus = openCorpus(root);
  const { store, path, chosen_by } = openStore(root, corpus, options);
  const found = verifyStore(corpus, store, options.unreferenced ? store.list() : undefined);
  const bad = found.problems.length > 0 || found.unread_records.length > 0;
  const lines = [
    `Content store: ${path} (chosen by ${chosen_by}${existsSync(path) ? "" : "; this directory does not exist"})`,
    `${found.referenced} blob(s) named by records: ${found.intact} present and matching, ${found.problems.length} not.`,
    ...found.problems.map((p) => `  ${p.state.toUpperCase()} ${p.sha256}\n${p.named_by.map((f) => `      named by ${f}`).join("\n")}`),
    ...(found.problems.length > 0 ? [
      "Why it matters: checks that need these files report that they could not check.",
      "What to do: restore them from your backup of the store, or add the same files again.",
    ] : []),
    ...(found.unread_records.length > 0 ? [
      "These record files cannot be read, so what they name is unknown and the lists may be incomplete:",
      ...found.unread_records.map((p) => `  ${p}`),
    ] : []),
    ...(found.unreferenced ? [
      `${found.unreferenced.length} blob(s) in the store that no record of this project names:`,
      ...found.unreferenced.map((d) => `  ${d}`),
      "Stemma deletes no blob. A store shared with another project holds blobs that project names.",
    ] : []),
    BACKUP_NOTICE,
  ];
  emit(options, { store: path, chosen_by, ...found }, `${lines.join("\n")}\n`);
  return bad ? 1 : 0;
}

/** What doctor says about the content store. It creates nothing and hashes nothing. */
function storeStatus(root: string, options: Options) {
  const corpus = loadCorpus(readProject(root));
  if (!corpus.settings.data) return { note: "stemma.json cannot be read, so the content store is unknown." };
  let location;
  try {
    location = storeLocation(root, corpus.settings.data.project_id, options["store-dir"]);
  } catch (error) {
    return { note: error instanceof Error ? error.message : "The content store location is unknown." };
  }
  const refused = storeProblem(root, location.path);
  const named = [...referencedBlobs(corpus).keys()];
  const store = new BlobStore(location.path);
  return {
    ...location, exists: existsSync(location.path), ...(refused ? { refused } : {}),
    blobs_named: named.length, blobs_present: refused ? 0 : named.filter((d) => store.has(d)).length,
    unread_records: unreadRecords(corpus).length,
  };
}

function recordAdd(options: Options, kind: string | undefined): number {
  if (!kind || !Object.hasOwn(KINDS, kind)) throw usage(`record add needs a record kind: ${Object.keys(KINDS).join(", ")}.`);
  if (!options.input) throw usage("record add needs --input <file> or --input - for standard input.");
  const root = requireProject(options);
  openCorpus(root);
  let input: string;
  try {
    input = readFileSync(options.input === "-" ? 0 : resolve(root, options.input), "utf8");
  } catch {
    throw new InvalidInput("The input file cannot be read.");
  }
  const actor = actorOf(options);
  const { id, path, text } = prepareRecord({ kind, input, ...(actor ? { actor } : {}), now: new Date(), token: randomToken });
  if (readProject(root).records.some((f) => f.path === path)) throw new InvalidInput(`${path} already exists; record add does not overwrite.`);
  writeProjectFile(root, path, text);
  return reportRecords(options, validateFiles(openCorpus(root), new Set([path])), `Added ${id}\n  ${path}\n`, { added: { id, path } });
}

/** The stemma.json and record paths a validate or fmt request covers. */
function targets(root: string, corpus: Corpus, named: string[]): Set<string> {
  const all = [corpus.settings, ...corpus.records].map((f) => f.path).concat(corpus.rules ? [corpus.rules.path] : []);
  if (named.length === 0) return new Set(all);
  return new Set(named.flatMap((name) => {
    const rel = projectRelative(root, name);
    const found = all.filter((p) => rel === "" || p === rel || p.startsWith(`${rel}/`));
    if (found.length === 0) throw new CommandError(5, "unknown_path", `No project record file is at ${name}.`, [name]);
    return found;
  }));
}

function validate(options: Options, named: string[]): number {
  const root = requireProject(options);
  const corpus = openCorpus(root);
  return reportRecords(options, validateFiles(corpus, targets(root, corpus, named)), "", {});
}

function fmt(options: Options, named: string[]): number {
  const root = requireProject(options);
  const corpus = openCorpus(root);
  const wanted = targets(root, corpus, named);
  const plan = formatPlan(corpus, wanted);
  for (const { path, text } of plan) writeProjectFile(root, path, text);
  const changed = plan.map((f) => f.path);
  const head = `Rewrote ${changed.length} file(s) in canonical form.\n${changed.map((p) => `  ${p}\n`).join("")}`;
  return reportRecords(options, validateFiles(openCorpus(root), wanted), head, { changed });
}

function rulesCheck(options: Options): number {
  const root = requireProject(options);
  return reportRecords(options, validateFiles(openCorpus(root), new Set(["rules.md"])), "", {});
}

function check(options: Options): number {
  if (options.changed && options.all) throw usage("Use --changed or --all, not both.");
  const started = new Date();
  const root = requireProject(options);
  const corpus = openCorpus(root);
  // The store is opened only when a record names something in it.
  const opened = referencedBlobs(corpus).size > 0 ? openStore(root, corpus, options) : undefined;
  const blobs: BlobReader = opened?.store ?? NO_STORE;
  const { body, errors } = runChecks(corpus, tools(), blobs);
  const report: CheckReport = {
    schema: "stemma.check-report/0",
    body,
    run: { started: started.toISOString(), duration_ms: Date.now() - started.getTime(), platform: `${process.platform}-${process.arch}` },
  };
  try {
    writeProjectFile(root, REPORT_PATH, canonical(report));
  } catch {
    throw new CommandError(70, "report_not_written", "The report could not be written, so this run does not count.", [REPORT_PATH]);
  }
  const widened = options.all ? "" : "The whole project is checked each time.\n";
  const absent = opened && body.results.some((r) => r.check === "source.held" && /_(missing|altered)$/.test(r.reason_code ?? ""))
    ? `Content store looked in: ${opened.path} (chosen by ${opened.chosen_by}). It is private and not part of the repository; where its files are absent or changed, nothing about them was checked.\n` : "";
  emit(options, report, `${renderReport(body)}\n${absent}${widened}Full report: ${join(root, REPORT_PATH)}\n`);
  if (errors.length > 0) {
    process.stderr.write(`A check failed to run. This is a Stemma defect and no result may be read as a pass.\n${errors.join("\n")}\n`);
    return 70;
  }
  return body.label === "checked_clean" ? 0 : 1;
}

function dispatch(positionals: string[], options: Options): number {
  const [command, ...rest] = positionals;
  const only = (count: number) => {
    if (rest.length > count) throw usage(`Too many arguments for ${command}.`);
  };
  switch (command) {
    case "version": only(0); return version(options);
    case "doctor": only(0); return doctor(options);
    case "init": only(0); return init(options);
    case "validate": return validate(options, rest);
    case "fmt": return fmt(options, rest);
    case "check": only(0); return check(options);
    case "source":
      if (rest[0] === "add") {
        only(2);
        return sourceAdd(options, rest[1]);
      }
      if (rest[0] === "text") {
        only(2);
        return sourceText(options, rest[1]);
      }
      if (["admit", "reject", "confirm"].includes(rest[0] ?? "")) {
        throw new CommandError(2, "not_implemented", `\`source ${rest[0]}\` is not implemented in this version. Nothing was done.`);
      }
      throw usage("The source commands available now are `source add` and `source text`.");
    case "store":
      if (rest[0] !== "verify") throw usage("The only store command is `store verify`.");
      only(1);
      return storeVerify(options);
    case "record":
      if (["show", "search", "trace"].includes(rest[0] ?? "")) {
        throw new CommandError(2, "not_implemented", `\`record ${rest[0]}\` is not implemented in this version. Nothing was done.`);
      }
      if (rest[0] !== "add") throw usage("The record command available now is `record add`.");
      only(2);
      return recordAdd(options, rest[1]);
    case "rules":
      if (rest[0] !== "check") throw usage("The only rules command is `rules check`.");
      only(1);
      return rulesCheck(options);
    default:
      if (command && NOT_YET.has(command)) {
        throw new CommandError(2, "not_implemented", `\`${command}\` is not implemented in this version. Nothing was done.`);
      }
      throw usage(command ? `Unknown command: ${command}` : "No command given.");
  }
}

export function main(argv: string[]): number {
  let json = argv.includes("--format=json") || argv[argv.indexOf("--format") + 1] === "json";
  try {
    const wrong = runtimeProblem(Bun.version, process.execArgv);
    if (wrong) throw new CommandError(4, "wrong_runtime", wrong);
    let parsed;
    try {
      parsed = parseArgs({
        args: argv, allowPositionals: true, strict: true,
        options: {
          project: { type: "string" }, format: { type: "string" }, input: { type: "string" }, actor: { type: "string" },
          changed: { type: "boolean" }, all: { type: "boolean" }, help: { type: "boolean" },
          "store-dir": { type: "string" }, source: { type: "string" }, origin: { type: "string" }, "acquired-at": { type: "string" },
          "source-version": { type: "string" }, unpublished: { type: "string" }, "community-restricted": { type: "string" },
          license: { type: "string" }, "text-layer": { type: "string" }, "page-map": { type: "string" }, method: { type: "string" },
          tool: { type: "string" }, "tool-version": { type: "string" }, note: { type: "string" }, unreferenced: { type: "boolean" },
        },
      });
    } catch (error) {
      throw usage(error instanceof Error ? error.message : "Bad arguments.");
    }
    const { format = "text", help, ...rest } = parsed.values;
    if (format !== "text" && format !== "json") throw usage("--format is text or json.");
    json = format === "json";
    if (help) {
      process.stdout.write(USAGE);
      return 0;
    }
    // An option a command does not take is a mistake, not something to drop silently.
    const [first = "", second = ""] = parsed.positionals;
    const taken = COMMAND_OPTIONS[`${first} ${second}`] ?? COMMAND_OPTIONS[first];
    const extra = taken && Object.keys(rest).find((name) => !["project", "store-dir", ...taken].includes(name));
    if (extra) throw usage(`--${extra} is not an option of this command.`);
    return dispatch(parsed.positionals, { ...rest, format } as Options);
  } catch (error) {
    const known = error instanceof CommandError ? error
      : error instanceof InvalidInput ? new CommandError(5, "invalid_input", `${error.message} Nothing was written.`)
      : error instanceof UnsupportedFile ? new CommandError(5, "unsupported_file", error.message)
      : error instanceof UnsafeStore ? new CommandError(5, "unsafe_store", error.message)
      : error instanceof DuplicateCopy ? new CommandError(5, "already_held", `These exact bytes are already held: ${error.holders.map((h) => `source ${h.source} (capture ${h.capture})`).join(", ")}. Nothing was written and nothing was merged. To restore a missing blob, add the file with --source naming that source; to attach the same file to another source, name that one with --source.`, error.holders.map((h) => h.source))
      : error instanceof NoExtractor ? new CommandError(2, "not_implemented", "This version cannot read text out of a PDF; no extraction library has been chosen. Supply the copy's text layer with --text-layer <file>, with a form feed after each page. Nothing was saved.")
      : error instanceof ActorNeeded ? usage("The input has no `created` stamp, so say who is adding it with --actor.")
      : error instanceof UnsafePath ? new CommandError(5, "unsafe_path", "That path leaves the project or is not a plain file. Nothing was written there.", [error.message])
      : error instanceof AlreadyInitialized ? new CommandError(5, "already_initialized", "This directory already holds stemma.json; init changed nothing.")
      : new CommandError(70, "internal_error", `Internal error; no result may be read as a pass. ${error instanceof Error ? error.message : ""}`);
    if (json) process.stdout.write(canonical({ error: { code: known.code, message: known.message, paths: known.paths } }));
    else process.stderr.write(`${known.message}\n`);
    return known.exit;
  }
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));

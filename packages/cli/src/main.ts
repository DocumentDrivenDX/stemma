// The stemma command line (CONTRACT-002). Findings never stop a command: exit 1
// only says that something is open.
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  ActorNeeded, type Actor, type CheckReport, formatPlan, InvalidInput, prepareRecord, renderFindings, renderReport, type Result,
  runChecks, validateFiles,
} from "@stemma/core";
import { canonical, type Corpus, KINDS, loadCorpus } from "@stemma/records";
import { AlreadyInitialized, findProject, initProject, projectRelative, randomToken, readProject, UnsafePath, writeProjectFile } from "@stemma/workspace";
import manifest from "../../../.claude-plugin/plugin.json";
import { ISOLATION_FLAGS, PINNED_BUN, runtimeProblem } from "./runtime.ts";

const VERSION: string = manifest.version;
const REPORT_PATH = ".stemma/reports/check.json";

const USAGE = `stemma ${VERSION}
Run as: bun ${ISOLATION_FLAGS.join(" ")} <plugin root>/dist/stemma.js <command> [options]

  version
  doctor
  init --project <dir>
  record add <kind> --input <file|-> [--actor <person|model|software>:<name>]
  validate [paths]
  fmt [paths]
  rules check
  check [--changed | --all]

Options: --project <dir> (default: nearest ancestor holding stemma.json), --format text|json
Exit codes: 0 done, nothing open; 1 done, findings open; 2 usage or not implemented;
3 project unreadable; 4 wrong runtime; 5 request not valid; 70 internal error.
`;

/** Commands CONTRACT-002 B names that this version does not have yet. */
const NOT_YET = new Set([
  "migrate", "store", "source", "capture", "key", "resolve", "excerpt", "unreviewed", "reviewed", "retire", "rounds",
  "review", "support", "annotate", "import", "export", "takeover", "index", "research", "setup", "log", "activity",
  "plan", "voice", "audit", "checkpoint", "authorship", "restricted", "build", "disclosure", "scan", "graph", "map",
]);

class CommandError extends Error {
  constructor(readonly exit: 2 | 3 | 4 | 5 | 70, readonly code: string, message: string, readonly paths: string[] = []) {
    super(message);
  }
}
const usage = (message: string) => new CommandError(2, "usage", `${message}\n\n${USAGE}`);

interface Options { project?: string; format: "text" | "json"; input?: string; actor?: string; changed?: boolean; all?: boolean }

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
    external_tools: "This version uses no tool other than Bun.",
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
  const named = /^(person|model|software):(.+)$/.exec(options.actor ?? "");
  if (options.actor !== undefined && !named) throw usage("--actor is person:<name>, model:<name> or software:<name>.");
  const actor = named ? { kind: named[1] as Actor["kind"], name: named[2]! } : undefined;
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
  const { body, errors } = runChecks(openCorpus(root), tools());
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
  const widened = options.all ? "" : "No change baseline is kept yet, so the whole project was checked.\n";
  emit(options, report, `${renderReport(body)}\n${widened}Full report: ${join(root, REPORT_PATH)}\n`);
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
    return dispatch(parsed.positionals, { ...rest, format } as Options);
  } catch (error) {
    const known = error instanceof CommandError ? error
      : error instanceof InvalidInput ? new CommandError(5, "invalid_input", `${error.message} Nothing was written.`)
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

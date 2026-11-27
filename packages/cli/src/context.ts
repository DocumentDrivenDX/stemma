// What every command shares: options, errors, output, and the tool versions.
import { Database } from "bun:sqlite";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { type Actor, InvalidInput, renderFindings, type Result, validateFiles } from "@stemma/core";
import { CONVERTER_VERSION, PDFJS_VERSION } from "@stemma/extract";
import { canonical, type Corpus, loadCorpus } from "@stemma/records";
import { findProject, readProject } from "@stemma/workspace";
import manifest from "../../../.claude-plugin/plugin.json";

export const VERSION: string = manifest.version;
export const USER_AGENT = `stemma/${VERSION}`;

export class CommandError extends Error {
  constructor(readonly exit: 2 | 3 | 4 | 5 | 70, readonly code: string, message: string, readonly paths: string[] = []) {
    super(message);
  }
}

export interface Options {
  project?: string; format: "text" | "json"; input?: string; actor?: string; changed?: boolean; all?: boolean;
  source?: string; origin?: string; "acquired-at"?: string; "source-version"?: string; "held-at"?: string; description?: string;
  image?: string[]; "text-layer"?: string; transcription?: string; method?: string; recognition?: string; tool?: string;
  "tool-version"?: string; "page-map"?: string; "auto-pages"?: boolean; "page-numbers"?: string; identity?: string;
  "coverage-note"?: string; note?: string; name?: string; out?: string; original?: string; with?: string; against?: string;
  independent?: boolean; scope?: string; pages?: string; passage?: string; fields?: string; outcome?: string; flag?: string[];
  "original-sha256"?: string; address?: string; via?: string; identifier?: string; plan?: string; originals?: string[];
  fetch?: boolean; reconvert?: boolean; "refresh-lookups"?: boolean; reason?: string; "replaced-by"?: string;
  finding?: string; effect?: string; "add-identifier"?: string[]; set?: string[]; author?: string[]; lookup?: string;
  replace?: boolean; from?: string; add?: string[]; remove?: string[]; tag?: string[]; stage?: string; has?: string[];
  audience?: string; page?: boolean; chapter?: string;
  check?: boolean; pdf?: boolean;
}

export const sqliteVersion = (): string => {
  const database = new Database(":memory:");
  try {
    return (database.query("select sqlite_version() as v").get() as { v: string }).v;
  } finally {
    database.close();
  }
};

/** Every tool that can change a result, as reports record them. */
export const tools = (): Record<string, string> => ({
  stemma: VERSION, bun: Bun.version, sqlite: sqliteVersion(), "stemma-convert": CONVERTER_VERSION, "pdfjs-dist": PDFJS_VERSION,
});

export function emit(options: Options, json: unknown, text: string): void {
  process.stdout.write(options.format === "json" ? canonical(json) : text);
}

export function requireProject(options: Options): string {
  const root = options.project ? resolve(options.project) : findProject(process.cwd());
  if (!root) throw new CommandError(3, "no_project", "No stemma.json was found here or above. Pass --project <dir>, or run init.");
  return root;
}

export function openCorpus(root: string): Corpus {
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

export const usageError = (message: string) => new CommandError(2, "usage", `${message}\nRun with --help to see every command.`);

export function actorOf(options: Options): Actor | undefined {
  const named = /^(person|model|software):(.+)$/.exec(options.actor ?? "");
  if (options.actor !== undefined && !named) throw usageError("--actor is person:<name>, model:<name> or software:<name>.");
  return named ? { kind: named[1] as Actor["kind"], name: named[2]! } : undefined;
}

export function requireActor(options: Options, why: string): Actor {
  const actor = actorOf(options);
  if (!actor) throw usageError(`${why}: give --actor <person|model|software>:<name>.`);
  return actor;
}

/** A file the author names for this command; read whole, within a size limit. */
export function namedFile(base: string, file: string | undefined, limit: number): Uint8Array | undefined {
  if (file === undefined) return undefined;
  const path = resolve(base, file);
  try {
    const stat = statSync(path);
    if (stat.isFile() && stat.size <= limit) return new Uint8Array(readFileSync(path));
  } catch {
    // Reported below.
  }
  throw new InvalidInput(`${file} cannot be read, is not a regular file, or is over the size limit.`);
}

/** Record results for chosen files, with the exit code they imply. */
export function reportRecords(options: Options, results: Result[], head: string, extra: object): number {
  const open = results.filter((r) => r.open);
  const body = open.length === 0 ? "No record problems found.\n" : `${open.length} record problem(s). Nothing is blocked.${renderFindings(results).join("\n")}\n`;
  emit(options, { ...extra, results }, `${head}${body}`);
  return open.length > 0 ? 1 : 0;
}

/** Validates what a command just wrote. */
export const written = (root: string, paths: string[]): Result[] => validateFiles(openCorpus(root), new Set(paths));

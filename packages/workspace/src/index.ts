// Filesystem adapter for one project directory. It never follows a symbolic
// link out of the project, and replaces files through a temporary file.
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  appendFileSync, closeSync, existsSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, realpathSync,
  renameSync, rmSync, writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { canonical, PROJECT_FORMAT, PROJECT_SCHEMA, type ProjectContent, type SourceFile } from "@stemma/records";

export * from "./fetch.ts";
export * from "./inputs.ts";
export * from "./originals.ts";
export * from "./outputs.ts";
export * from "./staged.ts";

export function findProject(start: string): string | undefined {
  for (let dir = resolve(start); ; dir = dirname(dir)) {
    if (existsSync(join(dir, "stemma.json"))) return dir;
    if (dirname(dir) === dir) return undefined;
  }
}

function sourceFile(root: string, path: string): SourceFile {
  const full = join(root, path);
  try {
    if (!lstatSync(full).isFile()) return { path };
    return { path, bytes: new Uint8Array(readFileSync(full)) };
  } catch {
    return { path };
  }
}

/** Every non-hidden file below `directory`; links and special files are listed without content. */
function listFiles(root: string, directory: string): SourceFile[] {
  let stat;
  try {
    stat = lstatSync(join(root, directory));
  } catch {
    return [];
  }
  if (!stat.isDirectory()) return [{ path: directory }];
  let names: string[];
  try {
    names = readdirSync(join(root, directory));
  } catch {
    return [{ path: directory }];
  }
  return names.filter((name) => !name.startsWith(".")).flatMap((name) => {
    const path = `${directory}/${name}`;
    const entry = lstatSync(join(root, path));
    return entry.isDirectory() ? listFiles(root, path) : [sourceFile(root, path)];
  });
}

/** The start of a file is enough to tell: git also takes a NUL byte there to mean binary. */
function isBinary(path: string): boolean {
  let handle: number | undefined;
  try {
    if (!lstatSync(path).isFile()) return false;
    handle = openSync(path, "r");
    const head = Buffer.alloc(8000);
    const length = readSync(handle, head, 0, head.length, 0);
    const start = head.toString("latin1", 0, 5);
    return head.subarray(0, length).includes(0) || start === "%PDF-" || start.startsWith("PK\u0003\u0004");
  } catch {
    return false;
  } finally {
    if (handle !== undefined) closeSync(handle);
  }
}

const UNTRACKED_DIRECTORIES = new Set(["build", "node_modules"]);

function walk(root: string, directory = ""): string[] {
  let entries;
  try {
    entries = readdirSync(join(root, directory), { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.filter((e) => !e.name.startsWith(".")).flatMap((e) => {
    const path = directory ? `${directory}/${e.name}` : e.name;
    if (e.isDirectory()) return UNTRACKED_DIRECTORIES.has(e.name) ? [] : walk(root, path);
    return e.isFile() ? [path] : [];
  });
}

/**
 * The files git tracks or would add under the project. Without git, every file
 * outside hidden and build directories.
 */
function repositoryFiles(root: string): string[] {
  const git = spawnSync("git", ["-C", root, "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  return git.status === 0 ? [...new Set(git.stdout.split("\0").filter(Boolean))] : walk(root);
}

const kind = (path: string): "directory" | "file" | "other" | "missing" => {
  try {
    const stat = lstatSync(path);
    return stat.isDirectory() ? "directory" : stat.isFile() ? "file" : "other";
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === "ENOENT" || code === "ENOTDIR" ? "missing" : "other";
  }
};

/**
 * The assembled report in `report/` (CONTRACT-005 L): report.json and the
 * template it names. Nothing is read through a link, or from outside `report/`,
 * since an export puts this text into a page the author may pass on.
 */
function readReport(root: string): ProjectContent["report"] {
  const path = "report/report.json";
  const directory = kind(join(root, "report"));
  // A link in place of the directory is looked through only to say that a report is there.
  if (directory === "missing" || !existsSync(join(root, path))) return undefined;
  if (directory !== "directory") return { spec: { path }, problem: "report is not a plain directory, so nothing in it is read." };
  const spec = sourceFile(root, path);
  if (!spec.bytes) return { spec };
  let name: unknown;
  try {
    name = (JSON.parse(new TextDecoder().decode(spec.bytes)) as { manuscript?: unknown } | null)?.manuscript;
  } catch {
    return { spec };
  }
  if (typeof name !== "string" || name === "") return { spec };
  const parts = name.split("/");
  if (name.includes("\\") || name.includes("\0") || /^[A-Za-z]:/.test(name) || parts.some((p) => p === "" || p === "." || p === "..")) {
    return { spec, problem: "The template that report.json names is not a file path inside report/, so it is not read." };
  }
  const inside = parts.slice(0, -1).every((_, i) => kind(join(root, "report", ...parts.slice(0, i + 1))) === "directory");
  const template = `report/${name}`;
  return { spec, template: inside ? sourceFile(root, template) : { path: template } };
}

export function readProject(root: string): ProjectContent {
  const content: ProjectContent = {
    settings: sourceFile(root, "stemma.json"),
    records: listFiles(root, "records"),
    sources: listFiles(root, "sources"),
    manuscript: listFiles(root, "manuscript"),
    research: listFiles(root, "research"),
    // Those under records/ and sources/ are already reported as misplaced.
    binaries: () => repositoryFiles(root).filter((path) => !/^(records|sources)\//.test(path) && isBinary(join(root, path))).sort(),
  };
  if (existsSync(join(root, "rules.md"))) content.rules = sourceFile(root, "rules.md");
  const report = readReport(root);
  if (report) content.report = report;
  return content;
}

export class UnsafePath extends Error {}

const inside = (root: string, path: string): boolean => {
  const rel = relative(root, path);
  return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`));
};

/** The project-relative form of a path the caller named. */
export function projectRelative(root: string, path: string): string {
  const full = resolve(root, path);
  const real = existsSync(full) ? realpathSync(full) : full;
  const base = inside(root, full) ? root : realpathSync(root);
  const target = inside(root, full) ? full : real;
  if (!inside(base, target)) throw new UnsafePath(path);
  return relative(base, target).split(sep).join("/");
}

export function safeTarget(root: string, path: string): string {
  const full = resolve(root, path);
  if (!inside(root, full)) throw new UnsafePath(path);
  // The deepest existing parent must really be inside the project.
  let parent = dirname(full);
  while (!existsSync(parent)) parent = dirname(parent);
  if (!inside(realpathSync(root), realpathSync(parent))) throw new UnsafePath(path);
  try {
    if (!lstatSync(full).isFile()) throw new UnsafePath(path);
  } catch (error) {
    if (error instanceof UnsafePath) throw error;
  }
  return full;
}

export function writeProjectFile(root: string, path: string, text: string): void {
  const full = safeTarget(root, path);
  mkdirSync(dirname(full), { recursive: true });
  const temporary = `${full}.${randomBytes(6).toString("hex")}.tmp`;
  try {
    writeFileSync(temporary, text, { flag: "wx" });
    renameSync(temporary, full);
  } finally {
    rmSync(temporary, { force: true });
  }
}

const BASE32 = "0123456789abcdefghjkmnpqrstvwxyz";

/** 20 random lowercase Crockford base32 characters (CONTRACT-001 C). */
export const randomToken = (): string => Array.from(randomBytes(20), (byte) => BASE32[byte % 32]).join("");

const RULES = `# Standing rules

Write each rule under a level-two heading with a number that is never reused,
for example "RULE-001 Spell the town as the charter does".
`;

const ATTRIBUTES = ["stemma.json", "rules.md", "records/**", "manuscript/**", "sources/**", "research/**/*.md"].map((p) => `${p} text eol=lf`);
/** Originals in these formats stay out of git even when they are put in the project folder. */
const ORIGINAL_FORMATS = ["pdf", "doc", "docx", "odt", "rtf", "pages", "epub", "mobi", "ppt", "pptx", "key", "xls", "xlsx", "numbers", "zip"];
const anyCase = (extension: string) => [...extension].map((c) => `[${c}${c.toUpperCase()}]`).join("");
const IGNORED = [".stemma/", "build/", ...ORIGINAL_FORMATS.map((e) => `*.${anyCase(e)}`)];

function addLines(root: string, path: string, lines: string[]): boolean {
  const full = safeTarget(root, path);
  const present = existsSync(full) ? readFileSync(full, "utf8") : "";
  const have = new Set(present.split(/\r?\n/));
  const missing = lines.filter((line) => !have.has(line));
  if (missing.length === 0) return false;
  appendFileSync(full, `${present && !present.endsWith("\n") ? "\n" : ""}${missing.join("\n")}\n`);
  return true;
}

/**
 * Writes a new source directory: every part first, then the manifest, so that a
 * source file is seen only once it is whole. An existing directory is never
 * overwritten.
 */
export function writeSourceDirectory(root: string, directory: string, files: { path: string; text: string }[]): void {
  if (existsSync(join(root, directory))) throw new UnsafePath(`${directory} already exists`);
  const manifest = `${directory}/source.md`;
  for (const file of files.filter((f) => f.path !== manifest)) writeProjectFile(root, file.path, file.text);
  const last = files.find((f) => f.path === manifest);
  if (last) writeProjectFile(root, last.path, last.text);
}

export class AlreadyInitialized extends Error {}

/** Creates a project. It overwrites nothing; existing files are kept. */
export function initProject(root: string): { project_id: string; written: string[] } {
  if (existsSync(join(root, "stemma.json"))) throw new AlreadyInitialized(root);
  mkdirSync(join(root, "records"), { recursive: true });
  mkdirSync(join(root, "manuscript"), { recursive: true });
  const project_id = randomToken();
  const written: string[] = [];
  if (!existsSync(join(root, "rules.md"))) {
    writeProjectFile(root, "rules.md", RULES);
    written.push("rules.md");
  }
  if (addLines(root, ".gitattributes", ATTRIBUTES)) written.push(".gitattributes");
  if (addLines(root, ".gitignore", IGNORED)) written.push(".gitignore");
  writeProjectFile(root, "stemma.json", canonical({ schema: PROJECT_SCHEMA, project_id, format: PROJECT_FORMAT }));
  written.push("stemma.json");
  return { project_id, written };
}

// Filesystem adapter for one project directory. It never follows a symbolic
// link out of the project, and replaces files through a temporary file.
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { canonical, PROJECT_FORMAT, PROJECT_SCHEMA, type ProjectContent, type SourceFile } from "@stemma/records";

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

export function readProject(root: string): ProjectContent {
  const content: ProjectContent = {
    settings: sourceFile(root, "stemma.json"),
    records: listFiles(root, "records"),
    manuscript: listFiles(root, "manuscript"),
  };
  if (existsSync(join(root, "rules.md"))) content.rules = sourceFile(root, "rules.md");
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

function safeTarget(root: string, path: string): string {
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

const ATTRIBUTES = ["stemma.json", "rules.md", "records/**", "manuscript/**"].map((p) => `${p} text eol=lf`);
const IGNORED = [".stemma/", "build/"];

function addLines(root: string, path: string, lines: string[]): boolean {
  const full = safeTarget(root, path);
  const present = existsSync(full) ? readFileSync(full, "utf8") : "";
  const have = new Set(present.split(/\r?\n/));
  const missing = lines.filter((line) => !have.has(line));
  if (missing.length === 0) return false;
  appendFileSync(full, `${present && !present.endsWith("\n") ? "\n" : ""}${missing.join("\n")}\n`);
  return true;
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

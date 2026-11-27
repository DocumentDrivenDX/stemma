// Where generated files may be written (CONTRACT-005 C): never where git would
// take them in, and never among the files the project is made of.
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export class RefusedOutput extends Error {}

/** The path with every existing part followed to where it really is. */
function realOf(path: string): string {
  let head = resolve(path);
  const rest: string[] = [];
  while (!existsSync(head) && dirname(head) !== head) {
    rest.unshift(basename(head));
    head = dirname(head);
  }
  return join(realpathSync(head), ...rest);
}

const within = (base: string, path: string): boolean => {
  const rel = relative(base, path);
  return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`));
};

/** Directories whose files are the project itself. */
const PROJECT_CONTENT = ["records", "sources", "manuscript", "research"];

/**
 * Throws unless every named file may be generated in `directory`. In a git work
 * tree, git must ignore each file, which it never does for a tracked one. With no
 * repository, a directory inside the project must be under `build/`, which is
 * what `init` makes git ignore.
 */
export function checkOutputDirectory(root: string, directory: string, names: string[]): void {
  const refuse = (why: string): never => {
    throw new RefusedOutput(why);
  };
  const project = realpathSync(root);
  if (existsSync(directory) && !statSync(directory).isDirectory()) refuse("It is not a directory.");
  const target = realOf(directory);
  if (within(target, project)) refuse("It holds the project itself.");
  if (PROJECT_CONTENT.some((name) => within(join(project, name), target))) refuse("It is among the files the project is made of.");
  let existing = target;
  while (!existsSync(existing)) existing = dirname(existing);
  const git = (args: string[]) => spawnSync("git", ["-C", existing, ...args], { encoding: "utf8" });
  const tree = git(["rev-parse", "--is-inside-work-tree"]);
  let repository: string | undefined;
  for (let at = existing; repository === undefined && dirname(at) !== at; at = dirname(at)) if (existsSync(join(at, ".git"))) repository = at;
  if (repository !== undefined) {
    if (tree.status !== 0) refuse("It is in a git repository, and git cannot say whether it would take these files in.");
    if (tree.stdout.trim() !== "true") refuse("It is inside git's own directory.");
    for (const name of names) {
      if (git(["check-ignore", "--quiet", "--", join(target, name)]).status !== 0) {
        refuse(`git would take ${name} in. Choose a directory git ignores, such as one under build/, or leave --out out.`);
      }
    }
  } else if (within(project, target) && !within(join(project, "build"), target)) {
    refuse("The project is not in a git repository, so inside it only build/ is used for generated files.");
  }
}

/** Writes generated files, each through a temporary file, which replaces a link rather than following it. */
export function writeOutputFiles(directory: string, files: { name: string; text: string }[]): void {
  mkdirSync(directory, { recursive: true });
  for (const { name, text } of files) {
    const full = join(directory, name);
    const temporary = `${full}.${randomBytes(6).toString("hex")}.tmp`;
    try {
      writeFileSync(temporary, text, { flag: "wx" });
      renameSync(temporary, full);
    } finally {
      rmSync(temporary, { force: true });
    }
  }
}

/** A plain file in a generated directory, or undefined. */
export function readOutputFile(directory: string, name: string): Uint8Array | undefined {
  try {
    const path = join(directory, name);
    return lstatSync(path).isFile() ? new Uint8Array(readFileSync(path)) : undefined;
  } catch {
    return undefined;
  }
}

/** Whether anything, a link or a directory included, has this name. */
export const outputExists = (directory: string, name: string): boolean => lstatSync(join(directory, name), { throwIfNoEntry: false }) !== undefined;

export const removeOutputFile = (directory: string, name: string): void => rmSync(join(directory, name), { force: true });

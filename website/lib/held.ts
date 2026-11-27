// What a published copy of a worked example holds, worked out from the
// example's own .gitignore. A tree on one machine may hold more, such as text
// fetched again; a copy made here leaves it out, so that a recorded run or a
// count is the same on every machine, with or without Git. A test compares the
// copy with the files Git tracks.
import { cpSync, existsSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** Left out whatever the example says: the system's folder files. */
const ALWAYS = [".DS_Store"];

const rules = (example: string): string[] => {
  const file = join(example, ".gitignore");
  return existsSync(file) ? readFileSync(file, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")) : [];
};

/** The folders of source text that the example's .gitignore leaves out, such as `sources/pgbouncer/sections`. */
export const textNotCommitted = (example: string): string[] =>
  rules(example).filter((r) => r.startsWith("sources/")).map((r) => r.replace(/\/$/, ""));

function matches(rule: string, path: string, directory: boolean): boolean {
  if (rule.startsWith("!")) throw new Error(`.gitignore: a rule that brings files back is not read here: ${rule}`);
  if (rule.endsWith("/") && !directory) return false;
  const pattern = rule.replace(/\/$/, "");
  // A rule with a slash is a path from the example's folder; another is a name at any depth.
  return new Bun.Glob(pattern).match(pattern.includes("/") ? path : path.split("/").pop()!);
}

/**
 * Copies an example as it is published. With `withText`, the text of the sources
 * that is not committed comes too, from a tree that holds it; nothing else that
 * is ignored does.
 */
export function copyExample(from: string, to: string, { withText = false } = {}): void {
  const text = new Set(textNotCommitted(from));
  const ignored = [...rules(from), ...ALWAYS].filter((r) => !(withText && text.has(r.replace(/\/$/, ""))));
  cpSync(from, to, {
    recursive: true,
    filter: (source) => {
      const path = relative(from, source).split(sep).join("/");
      if (path === "") return true;
      const directory = statSync(source).isDirectory();
      return !ignored.some((rule) => matches(rule, path, directory));
    },
  });
}

/** The manifest of one source's text. */
export function manifest(example: string, key: string): any {
  const text = readFileSync(join(example, "sources", key, "source.md"), "utf8");
  return JSON.parse(text.slice(4, text.indexOf("\n---\n", 4)));
}

/** The citation keys whose text the example does not commit, from its .gitignore. */
export const keysNotCommitted = (example: string): string[] =>
  textNotCommitted(example).map((folder) => folder.split("/")[1]!).sort();

/** The keys, of those not committed, whose text this tree lacks a part of. */
export const textMissingHere = (example: string): string[] =>
  keysNotCommitted(example).filter((key) =>
    manifest(example, key).pages.some((p: { file: string }) => !existsSync(join(example, "sources", key, p.file))));

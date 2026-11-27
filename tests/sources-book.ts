// Shared by the sources-*.test.ts files: the built command line, and an invented
// project and book to run it against.
import { beforeAll, expect } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { CheckReport, Result } from "@stemma/core";
import { ISOLATION_FLAGS } from "../packages/cli/src/runtime.ts";
import { builtCli, temporary } from "./helpers.ts";
import { makePdf } from "./pdf.ts";

let cli = "";
/** Each test file that runs the command line calls this once, at its top level. */
export function bundleCli(): void {
  beforeAll(async () => {
    cli = await builtCli(join(temporary(), "dist"));
  });
}

export function run(args: string[]) {
  const done = Bun.spawnSync([process.execPath, ...ISOLATION_FLAGS, cli, ...args], { cwd: dirname(dirname(cli)), env: { PATH: process.env.PATH ?? "", HOME: temporary() } });
  return { code: done.exitCode, out: done.stdout.toString(), err: done.stderr.toString() };
}

export const AUTHOR = ["--actor", "person:author"];
export const ACQUIRED = ["--acquired-at", "2026-01-05T09:00:00Z"];

export class Book {
  readonly base = temporary();
  readonly project = join(this.base, "book");
  constructor() {
    expect(run(["init", "--project", this.project]).code).toBe(0);
  }
  run(...args: string[]) {
    return run([...args, "--project", this.project]);
  }
  json(...args: string[]) {
    const done = this.run(...args, "--format", "json");
    return { ...done, json: JSON.parse(done.out) };
  }
  file(name: string, content: string | Uint8Array): string {
    const path = join(this.base, name);
    writeFileSync(path, content);
    return path;
  }
  add(kind: string, fields: Record<string, unknown>): string {
    const made = this.json("record", "add", kind, "--input", this.file("record.json", JSON.stringify(fields)), ...AUTHOR);
    expect(made.json.added).toBeDefined();
    return made.json.added.id;
  }
  source(key: string, more: Record<string, unknown> = {}) {
    return this.add("source", { citation_key: key, title: { value: "The Invented Reef" }, ...more });
  }
  convert(file: string, source: string, ...more: string[]) {
    const done = this.json("source", "convert", file, "--source", source, ...AUTHOR, ...ACQUIRED, ...more);
    return { ...done, text: done.json.text as string, directory: done.json.directory as string };
  }
  check(): CheckReport {
    const done = this.json("check");
    expect([0, 1]).toContain(done.code);
    return done.json;
  }
  read(path: string) {
    return readFileSync(join(this.project, path), "utf8");
  }
  write(path: string, text: string) {
    writeFileSync(join(this.project, path), text);
  }
  files(): string[] {
    return [...new Bun.Glob("**/*").scanSync({ cwd: this.project, dot: true, onlyFiles: true })].sort();
  }
}

export const of = (report: CheckReport, check: string): Result[] => report.body.results.filter((r) => r.check === check);
export const verdicts = (report: CheckReport, check: string) => of(report, check).map((r) => `${r.outcome}${r.reason_code ? ` ${r.reason_code}` : ""}`).sort();
export const evidence = (r: Result, name: string) => r.evidence.filter((e) => e.name === name).map((e) => e.value);

export const PAGES = [
  ["THE INVENTED REEF", "by A. N. Author", "London, 1850"],
  ["1", "The reef was old and the water deep."],
  ["2", "We counted 37 islets on the rim."],
  ["3", "The lagoon was shallow."],
  ["4", "Nothing else is known."],
];
export const reefPdf = () => makePdf({ pages: PAGES });

/** A captured, labelled, five-page invented book. */
export function reef(more: Record<string, unknown> = {}) {
  const book = new Book();
  const source = book.source("author1850", { contributions: [{ lid: "a", role: "author", as_printed: { family: "Author", given: "A. N." } }], issued: { edtf: "1850" }, ...more });
  const original = book.file("reef.pdf", reefPdf());
  const made = book.convert(original, source, "--auto-pages", "--origin", "my own scan");
  expect(made.code).toBeLessThan(2);
  return { book, source, original, text: made.text, directory: made.directory };
}

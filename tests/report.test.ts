// The worked example's research report is built by `stemma build report` from the
// project's passage and source records. The committed output must be what the
// command gives now, from a copy that holds nothing but the committed files.
import { beforeAll, describe, expect, test } from "bun:test";
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { bundle } from "../scripts/build.ts";
import { ISOLATION_FLAGS } from "../packages/cli/src/runtime.ts";
import { ROOT, temporary } from "./helpers.ts";

const EXAMPLE = join(ROOT, "examples/coral-reefs");
const REPORT = join(EXAMPLE, "report");
let cli = "";
let copy = "";
const run = (...args: string[]) => Bun.spawnSync([process.execPath, ...ISOLATION_FLAGS, cli, ...args, "--project", copy],
  { cwd: dirname(cli), env: { PATH: process.env.PATH ?? "", HOME: temporary() } });

beforeAll(async () => {
  const work = temporary();
  cli = await bundle(join(work, "plugin/dist"));
  copy = join(work, "coral-reefs");
  cpSync(EXAMPLE, copy, { recursive: true, filter: (path) => !/^(\.stemma|build|report\/build|report\/report\.pdf)(\/|$)/.test(relative(EXAMPLE, path)) });
}, 120_000);

describe("the worked example's research report", () => {
  test("report.md, report.typ and verification.md are what build report gives now", () => {
    const done = run("build", "report", "report", "--check");
    expect(done.stderr.toString()).toBe("");
    expect(done.stdout.toString()).toContain("are current: 75 notes");
    expect(done.exitCode).toBe(0);
  }, 60_000);

  test("a changed note is found stale, and a rebuild restores the committed bytes", () => {
    const path = join(copy, "report/report.md");
    const committed = readFileSync(path, "utf8");
    writeFileSync(path, committed.replace("[^1]: “", "[^1]: ‘"));
    expect(run("build", "report", "report", "--check").exitCode).toBe(1);
    expect(run("build", "report", "report").exitCode).toBe(0);
    expect(readFileSync(path, "utf8")).toBe(committed);
  }, 120_000);

  test("the publication itself says nothing about the tool", () => {
    const text = readFileSync(join(REPORT, "report.md"), "utf8");
    for (const word of ["Stemma", "passage record", "text layer", "verification", "psg-", "txt-", "pers. comm."]) expect(text, word).not.toContain(word);
  });

  test("every note gives each quotation verbatim from its passage, then its citation", () => {
    const text = readFileSync(join(REPORT, "report.md"), "utf8");
    const notes = text.split("\n").filter((l) => /^\[\^\d+\]: /.test(l));
    expect(notes.length).toBe(75);
    for (const note of notes) expect(note, note.slice(0, 40)).toMatch(/^\[\^\d+\]: “/);
  });
});

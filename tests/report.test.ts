// The worked example's research report is generated from records that point into
// the example's committed source files. The committed output must be what the
// build gives now, and every quotation must still be found where its record says.
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./helpers.ts";

const REPORT = join(ROOT, "examples/coral-reefs/report");
const build = (...args: string[]) => Bun.spawnSync(["python3", "-I", "-B", join(REPORT, "tools/build.py"), ...args], { cwd: ROOT });

describe("the worked example's research report", () => {
  test("report.md, report.typ and verification.md are current with the committed records and source files", () => {
    const done = build("--check");
    expect(done.stderr.toString()).toBe("");
    expect(done.exitCode).toBe(0);
  });

  test("every passage record names a text and source record of the example project", () => {
    const sources = new Map<string, string>();
    for (const name of readdirSync(join(ROOT, "examples/coral-reefs/sources"))) {
      const text = readFileSync(join(ROOT, "examples/coral-reefs/sources", name, "source.md"), "utf8");
      const manifest = JSON.parse(text.slice(4, text.indexOf("\n---\n", 4)));
      sources.set(manifest.id, manifest.source);
    }
    const files = readdirSync(join(REPORT, "records/passages"));
    expect(files.length).toBeGreaterThan(100);
    for (const file of files) {
      const passage = JSON.parse(readFileSync(join(REPORT, "records/passages", file), "utf8"));
      expect(sources.get(passage.text), file).toBe(passage.source);
      expect(readdirSync(join(ROOT, "examples/coral-reefs/records/sources"))).toContain(`${passage.source}.json`);
    }
  });

  test("the publication itself says nothing about the tool", () => {
    const text = readFileSync(join(REPORT, "report.md"), "utf8");
    for (const word of ["Stemma", "passage record", "text layer", "verification", "psg-", "txt-"]) expect(text, word).not.toContain(word);
  });
});

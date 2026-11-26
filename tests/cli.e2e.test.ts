// The built command line, run as CONTRACT-002 A documents it: working directory
// is the plugin root, paths are absolute.
import { beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { CheckReport, Result } from "@stemma/core";
import { canonical } from "@stemma/records";
import { bundle } from "../scripts/build.ts";
import { ISOLATION_FLAGS } from "../packages/cli/src/runtime.ts";
import { fixture, temporary } from "./helpers.ts";

let cli = "";
beforeAll(async () => {
  cli = await bundle(join(temporary(), "dist"));
});

function stemma(args: string[], flags: readonly string[] = ISOLATION_FLAGS, stdin?: string) {
  const done = Bun.spawnSync([process.execPath, ...flags, cli, ...args], {
    cwd: dirname(dirname(cli)), ...(stdin === undefined ? {} : { stdin: new TextEncoder().encode(stdin) }),
  });
  return { code: done.exitCode, out: done.stdout.toString(), err: done.stderr.toString() };
}

function check(project: string) {
  const run = stemma(["check", "--all", "--project", project, "--format", "json"]);
  return { code: run.code, report: JSON.parse(run.out) as CheckReport };
}

const open = (results: Result[]) =>
  results.filter((r) => r.open).map((r) => `${r.check} ${r.outcome} ${r.reason_code} ${r.subject}`);

describe("seeded and clean fixtures", () => {
  test("every seeded error is reported, and nothing else", () => {
    const { code, report } = check(fixture("seeded"));
    expect(code).toBe(1);
    expect(report.body.label).toBe("open_findings");
    expect(open(report.body.results).sort()).toEqual([
      "bib.uncited fail not_cited src-fixture0orphan001",
      "cite.key fail key_unknown cit-fixture0ghost0001",
      "coordinate.stray fail coordinate_text rules.md",
      "record.valid fail record_invalid src-fixture0invalid01",
      "record.valid fail record_noncanonical src-fixture0compact01",
      "record.valid fail reference_dangling stemma.json",
      "record.valid fail rule_id_duplicate rules.md",
      "record.valid fail unknown_field src-fixture0invalid01",
      "record.valid unverifiable record_unreadable records/agents/agt-fixture0broken001.json",
    ]);
  });

  test("US-022-AC1 an unknown citation key fails, showing the key and where it is", () => {
    const { report } = check(fixture("seeded"));
    const finding = report.body.results.find((r) => r.check === "cite.key" && r.open)!;
    expect(finding.evidence).toContainEqual({ name: "key", class: "manuscript", value: "ghost2020" });
    expect(finding.evidence).toContainEqual({ name: "citation_file", class: "location", value: "records/citations/cit-fixture0ghost0001.json" });
  });

  test("US-022-AC2 a listed source cited nowhere fails and is named", () => {
    const { report } = check(fixture("seeded"));
    const finding = report.body.results.find((r) => r.check === "bib.uncited" && r.open)!;
    expect(finding.evidence).toContainEqual({ name: "key", class: "metadata", value: "orphan1990" });
  });

  test("US-022-AC3 manuscript text this version cannot read is unverifiable, never a pass", () => {
    const { code, report } = check(fixture("manuscript"));
    const bib = report.body.results.filter((r) => r.check === "bib.uncited");
    expect(bib.map((r) => [r.outcome, r.reason_code])).toEqual([["unverifiable", "manuscript_not_read"]]);
    expect(report.body.results.filter((r) => r.check === "cite.key")).toEqual([]);
    expect(report.body.not_run).toContainEqual({ check: "cite.key", reason: "not_implemented" });
    expect(code).toBe(1);
  });

  test("a clean project is checked clean and exits 0", () => {
    const project = fixture("clean");
    const { code, report } = check(project);
    expect([code, report.body.label, report.body.summary.open]).toEqual([0, "checked_clean", 0]);
    expect(readFileSync(join(project, ".stemma/reports/check.json"), "utf8")).toBe(canonical(report));
  });

  test("US-030-AC1 report bodies are byte-identical across runs and project locations", () => {
    for (const name of ["seeded", "cited", "clean", "manuscript"]) {
      const first = fixture(name);
      const bodies = [check(first), check(first), check(fixture(name, join(temporary(), "a place with spaces é")))]
        .map((r) => canonical(r.report.body));
      expect(bodies[1]).toBe(bodies[0]!);
      expect(bodies[2]).toBe(bodies[0]!);
      expect(bodies[0]).not.toContain(first);
    }
  });

  test("US-085-AC6 CRLF and LF checkouts give the same results", () => {
    const lf = fixture("cited");
    const crlf = fixture("cited");
    for (const path of new Bun.Glob("{stemma.json,rules.md,records/**/*.json}").scanSync(crlf)) {
      writeFileSync(join(crlf, path), readFileSync(join(crlf, path), "utf8").replaceAll("\n", "\r\n"));
    }
    const [a, b] = [check(lf).report.body, check(crlf).report.body];
    expect(b.results).toEqual(a.results);
    expect(b.inputs).toEqual(a.inputs);
  });

  test("the text report explains in plain language", () => {
    const run = stemma(["check", "--project", fixture("seeded")]);
    expect(run.code).toBe(1);
    for (const part of ["OPEN FINDINGS", "Nothing is blocked", "Why it matters:", "What to do:", "ghost2020", "NOT CHECKED"]) {
      expect(run.out).toContain(part);
    }
    expect(run.out).not.toContain("12.34567");
  });
});

describe("building a project from the command line", () => {
  const add = (project: string, kind: string, record: object) =>
    stemma(["record", "add", kind, "--input", "-", "--actor", "person:author", "--project", project, "--format", "json"], ISOLATION_FLAGS, JSON.stringify(record));

  test("US-013-AC1 and AC3 one new record file per source; a plain-text edit is what is read", () => {
    const project = join(temporary(), "book");
    expect(stemma(["init", "--project", project]).code).toBe(0);
    expect(check(project).report.body.label).toBe("checked_clean");
    const added = add(project, "source", { citation_key: "hartwell1998", issued: { edtf: "1998" } });
    expect(added.code).toBe(0);
    const { id, path } = JSON.parse(added.out).added as { id: string; path: string };
    expect(readdirSync(join(project, "records/sources"))).toEqual([`${id}.json`]);
    const text = readFileSync(join(project, path), "utf8");
    expect(text).toBe(canonical(JSON.parse(text)));
    expect(JSON.parse(text)).toMatchObject({ admission: "candidate", intake: "parsed", created: { by: { kind: "person", name: "author" } } });

    const cite = add(project, "citation", { key: "hartwell1999", sentence: { text: "  An invented\n sentence. " } });
    expect(cite.code).toBe(0); // an unknown key is a finding of check, not a refusal
    expect(check(project).report.body.results.find((r) => r.check === "cite.key")!.outcome).toBe("fail");
    writeFileSync(join(project, path), text.replace("hartwell1998", "hartwell1999"));
    expect(check(project).report.body.results.find((r) => r.check === "cite.key")!.outcome).toBe("pass");
  });

  test("an invalid record is still written, with its findings", () => {
    const project = fixture("clean");
    const run = add(project, "source", { citation_key: "bad key" });
    expect(run.code).toBe(1);
    expect(existsSync(join(project, JSON.parse(run.out).added.path))).toBe(true);
    expect(JSON.parse(run.out).results.map((r: Result) => r.reason_code)).toContain("record_invalid");
  });

  test("record add refuses to overwrite or to write input it would change", () => {
    const project = fixture("clean");
    for (const record of [{ id: "src-fixture0harbour01" }, { id: "../../escape" }, { subtype: 1.5 }]) {
      const run = add(project, "source", record);
      expect([run.code, JSON.parse(run.out).error.code]).toEqual([5, "invalid_input"]);
    }
  });

  test("fmt rewrites to canonical form without changing values, and leaves unreadable files alone", () => {
    const project = fixture("seeded");
    const compact = join(project, "records/sources/src-fixture0compact01.json");
    const broken = join(project, "records/agents/agt-fixture0broken001.json");
    const [before, untouched] = [readFileSync(compact, "utf8"), readFileSync(broken, "utf8")];
    const run = stemma(["fmt", "--project", project]);
    expect(run.code).toBe(1);
    const after = readFileSync(compact, "utf8");
    expect(after).not.toBe(before);
    expect(JSON.parse(after)).toEqual(JSON.parse(before));
    expect(readFileSync(broken, "utf8")).toBe(untouched);
    expect(check(project).report.body.results.filter((r) => r.reason_code === "record_noncanonical")).toEqual([]);
    expect(stemma(["validate", compact, "--project", project]).code).toBe(0);
    expect(stemma(["rules", "check", "--project", project]).code).toBe(1);
  });
});

describe("exit codes (CONTRACT-002 I)", () => {
  test("US-081-AC4 nothing open, open findings, and a runtime that cannot run are distinct", () => {
    const clean = fixture("clean");
    expect(stemma(["check", "--project", clean]).code).toBe(0);
    expect(stemma(["check", "--project", fixture("seeded")]).code).toBe(1);
    const wrong = stemma(["check", "--project", clean], []);
    expect(wrong.code).toBe(4);
    expect(wrong.err).toContain("Nothing was checked");
  });

  test("2 for usage errors and unimplemented commands", () => {
    expect(stemma(["frobnicate"]).code).toBe(2);
    expect(stemma(["init"]).code).toBe(2);
    expect(stemma(["check", "--nope"]).code).toBe(2);
    const run = stemma(["build", "draft", "--format", "json"]);
    expect([run.code, JSON.parse(run.out).error.code]).toEqual([2, "not_implemented"]);
  });

  test("3 when there is no readable project", () => {
    const dir = temporary();
    expect(stemma(["check", "--project", dir]).code).toBe(3);
    writeFileSync(join(dir, "stemma.json"), "{");
    expect(stemma(["check", "--project", dir]).code).toBe(3);
    writeFileSync(join(dir, "stemma.json"), '{"schema": "stemma.project/1", "format": 1}');
    expect(stemma(["fmt", "--project", dir]).code).toBe(3);
  });

  test("5 for requests that are not valid", () => {
    const project = fixture("clean");
    expect(stemma(["init", "--project", project]).code).toBe(5);
    expect(stemma(["fmt", "/etc/hosts", "--project", project]).code).toBe(5);
  });

  test("70 when the report cannot be written; nothing is written through a link out of the project", () => {
    const project = fixture("clean");
    const outside = temporary();
    symlinkSync(outside, join(project, ".stemma"));
    expect(stemma(["check", "--project", project]).code).toBe(70);
    expect(readdirSync(outside)).toEqual([]);
  });

  test("a linked record file is not followed", () => {
    const project = fixture("clean");
    const outside = join(temporary(), "outside.json");
    writeFileSync(outside, "{}");
    mkdirSync(join(project, "records/agents"));
    symlinkSync(outside, join(project, "records/agents/agt-linked000000.json"));
    const finding = check(project).report.body.results.find((r) => r.open && r.check === "record.valid")!;
    expect([finding.outcome, finding.reason_code]).toEqual(["unverifiable", "record_unreadable"]);
    stemma(["fmt", "--project", project]);
    expect(readFileSync(outside, "utf8")).toBe("{}");
  });

  test("version and doctor report the pinned runtime and how it was started", () => {
    expect(JSON.parse(stemma(["version", "--format", "json"]).out)).toEqual({ bun_pinned: "1.4.5", stemma: "0.0.1" });
    const doctor = JSON.parse(stemma(["doctor", "--format", "json"]).out);
    expect(Object.values(doctor.start_flags)).toEqual([true, true, true]);
    expect(stemma(["doctor"], ["--no-install"]).out).toContain("WARNING");
  });
});

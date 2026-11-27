// The evidence ledger that `build report` writes (CONTRACT-006 J, US-124), run
// as the bundled command on a copy of the worked example.
import { beforeAll, describe, expect, test } from "bun:test";
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { bundle } from "../scripts/build.ts";
import { ISOLATION_FLAGS } from "../packages/cli/src/runtime.ts";
import { totalsOf, type Unit } from "../packages/publish/src/evidence.ts";
import { ROOT, temporary } from "./helpers.ts";

const EXAMPLE = join(ROOT, "examples/coral-reefs");
let copy = "";
let cli = "";

const run = (args: string[], input?: string) => Bun.spawnSync([process.execPath, ...ISOLATION_FLAGS, cli, ...args, "--project", copy],
  { cwd: dirname(cli), env: { PATH: process.env.PATH ?? "", HOME: temporary() }, ...(input === undefined ? {} : { stdin: Buffer.from(input) }) });
const done = (args: string[], input?: string) => {
  const result = run(args, input);
  expect(result.stderr.toString(), args.join(" ")).toBe("");
  return result.stdout.toString();
};
const read = (path: string) => readFileSync(join(copy, path), "utf8");
const ledger = () => JSON.parse(read("report/evidence.json")) as {
  subjects: { path: string; sha256: string }[]; units: Unit[]; totals: unknown; covers: string; not_covered: string[];
  authorship: { version: string | null; marks_applied: number; marks_of_other_versions: number };
  checks: { label: string; open: number; unreviewed: number; dismissed: number; open_by_check: Record<string, number>; dismissals: { check: string; annotations: string[] }[]; not_implemented: string[] };
  quotations: { id: string; compared: string; passages: string[] }[];
};
const build = () => {
  done(["build", "report", "report"]);
  return ledger();
};
const mark = (text: string, authorship: string, actor: string, version = "draft") => done(["record", "add", "authorship_mark", "--input", "-", "--actor", actor],
  JSON.stringify({ text, authorship, version }));
/** Names the copy's report version, or takes the name away. */
const nameVersion = (version: unknown) => {
  const spec = JSON.parse(read("report/report.json")) as Record<string, unknown>;
  writeFileSync(join(copy, "report/report.json"), `${JSON.stringify({ ...spec, version }, null, 1)}\n`);
};

/** The second sentence of the worked example's abstract, which holds no quotation and no note. */
const SENTENCE = "This report argues that the shape of an atoll was never the evidence on which the theory stood, and that Darwin said so.";
const sha = (text: string) => new Bun.CryptoHasher("sha256").update(text).digest("hex");
const unitOf = (units: Unit[], text: string) => units.find((u) => u.sha256 === sha(text))!;

beforeAll(async () => {
  const work = temporary();
  cli = await bundle(join(work, "plugin/dist"));
  copy = join(work, "coral-reefs");
  cpSync(EXAMPLE, copy, { recursive: true, filter: (path) => !/^(\.stemma|build|report\/build|report\/report\.pdf)(\/|$)/.test(relative(EXAMPLE, path)) });
}, 120_000);

describe("the evidence ledger", () => {
  test("US-124-AC1, AC6, AC7: labels every sentence, recounts to its totals, names the checks and limits, and holds no sentence text", () => {
    const made = JSON.parse(readFileSync(join(EXAMPLE, "report/evidence.json"), "utf8")) as ReturnType<typeof ledger>;
    expect(made.totals).toEqual(totalsOf(made.units) as unknown);
    expect(new Set(made.units.map((u) => u.id)).size).toBe(made.units.length);
    for (const unit of made.units) {
      expect(["quotation", "cited", "uncited"]).toContain(unit.labels.basis);
      expect(unit.labels.support).toBe(unit.labels.basis === "uncited" ? "not_applicable" : "not_judged");
      expect(unit.labels.wording).toBe("unrecorded");
    }
    for (const subject of made.subjects) expect(subject.sha256).toBe(sha(readFileSync(join(EXAMPLE, "report", subject.path), "utf8")));
    // AC1: all three kinds of basis occur, in the body and in comments.
    for (const basis of ["quotation", "cited", "uncited"]) expect(made.units.some((u) => u.labels.basis === basis), basis).toBe(true);
    for (const place of ["body", "comment"]) expect(made.units.some((u) => u.place === place), place).toBe(true);
    for (const unit of made.units) {
      if (unit.labels.basis === "uncited") expect(unit.quotations).toEqual([]);
      else expect(unit.quotations.length).toBeGreaterThan(0);
    }
    // AC7: the checks with their counts, and what is not covered.
    expect(made.checks).toMatchObject({ label: "checked_clean", open: 0, open_by_check: {}, dismissals: [], not_implemented: [] });
    expect(made.checks.unreviewed).toBeGreaterThanOrEqual(0);
    expect(made.not_covered).toContain("whether any source supports any sentence");
    const bytes = readFileSync(join(EXAMPLE, "report/evidence.json"), "utf8");
    for (const words of ["Darwin said so", "doubly rich millionaire"]) expect(bytes).not.toContain(words);
  });

  test("US-124-AC2, AC3, AC8: a writer is recorded only by a mark that holds the sentence, and marks that disagree record none", () => {
    nameVersion("draft");
    build();
    mark(SENTENCE, "human_written", "person:author");
    expect(run(["build", "report", "report", "--check"]).stdout.toString()).toContain("Out of date: report/evidence.json");
    let units = build().units;
    expect(unitOf(units, SENTENCE).labels).toMatchObject({ wording: "human_written", declared_by: "person" });
    expect(units.filter((u) => u.labels.wording !== "unrecorded")).toHaveLength(1);

    mark(SENTENCE, "ai_drafted", "model:some-model");
    units = build().units;
    expect(unitOf(units, SENTENCE).labels).toMatchObject({ wording: "unrecorded", declared_by: "mixed" });
    expect(done(["validate"])).not.toContain("aum-");
  }, 120_000);

  test("US-124-AC9: a mark applies only to the version it names, and none when the report names no version", () => {
    nameVersion("second");
    let made = build();
    expect(made.authorship).toEqual({ version: "second", marks_applied: 0, marks_of_other_versions: 2 });
    expect(made.units.every((u) => u.labels.wording === "unrecorded" && u.labels.declared_by === "none")).toBe(true);

    // A mark of the new version applies without disturbing the earlier version's marks.
    mark(SENTENCE, "edited", "person:author", "second");
    made = build();
    expect(unitOf(made.units, SENTENCE).labels).toMatchObject({ wording: "edited", declared_by: "person" });
    expect(made.authorship).toMatchObject({ marks_applied: 1, marks_of_other_versions: 2 });

    nameVersion(undefined);
    expect(done(["build", "report", "report"])).toContain("names no version, so no authorship mark applies");
    expect(ledger().authorship).toEqual({ version: null, marks_applied: 0, marks_of_other_versions: 3 });
    expect(ledger().units.every((u) => u.labels.wording === "unrecorded")).toBe(true);

    nameVersion(" ");
    const blank = run(["build", "report", "report"]);
    expect(blank.exitCode).toBe(5);
    nameVersion("second");
  }, 180_000);

  test("US-124-AC2: a paragraph mark covers each of its sentences, and an edited sentence loses its mark", () => {
    const template = read("report/report.src");
    const first = "The first invented sentence stands here.";
    const next = "A second invented sentence follows it.";
    nameVersion("paragraph");
    writeFileSync(join(copy, "report/report.src"), template.replace(SENTENCE, `${first} ${next}`));
    mark(`${first} ${next}`, "ai_drafted", "person:author", "paragraph");
    let units = build().units;
    for (const sentence of [first, next]) expect(unitOf(units, sentence).labels.wording).toBe("ai_drafted");
    expect(units.filter((u) => u.labels.wording !== "unrecorded")).toHaveLength(2);

    const edited = "A second invented sentence now follows it.";
    writeFileSync(join(copy, "report/report.src"), template.replace(SENTENCE, `${first} ${edited}`));
    units = build().units;
    expect(unitOf(units, edited).labels.wording).toBe("unrecorded");
    expect(unitOf(units, first).labels.wording).toBe("ai_drafted");
    writeFileSync(join(copy, "report/report.src"), template);
    nameVersion("second");
  }, 120_000);

  test("US-124-AC7: a dismissed result stays listed beside the label, without its reason", () => {
    done(["record", "add", "claim", "--input", "-", "--actor", "person:author"], JSON.stringify({ text: "An invented claim.", role: "claim" }));
    expect(build().checks).toMatchObject({ label: "open_findings", dismissals: [] });
    const report = JSON.parse(run(["check", "--format", "json"]).stdout.toString()) as { body: { results: { open: boolean; finding_key: string }[] } };
    const open = report.body.results.filter((r) => r.open);
    for (const finding of open) {
      done(["annotate", "--finding", finding.finding_key, "--effect", "dismiss", "--reason", "an invented reason to dismiss it", "--actor", "person:author"]);
    }
    const { checks } = build();
    // A claim also brings checks this version cannot run, so the label stays open.
    expect(checks).toMatchObject({ label: "open_findings", open: 0, dismissed: open.length });
    expect(checks.not_implemented.length).toBeGreaterThan(0);
    expect(checks.dismissals).toHaveLength(open.length);
    for (const d of checks.dismissals) expect(d.annotations[0]).toMatch(/^ann-/);
    expect(checks.unreviewed).toBeGreaterThan(0);
    expect(read("report/evidence.json")).not.toContain("invented reason");
  }, 120_000);

  test("US-124-AC4: words typed between quotation marks are told apart from copied quotations", () => {
    const template = read("report/report.src");
    writeFileSync(join(copy, "report/report.src"), template.replace(SENTENCE, 'A critic called it "a wholly typed phrase" at the time.'));
    const units = build().units;
    expect(units.filter((u) => u.labels.typed_quotation === "yes")).toHaveLength(1);
    expect(unitOf(units, 'A critic called it "a wholly typed phrase" at the time.').labels).toMatchObject({ basis: "uncited", typed_quotation: "yes" });
    writeFileSync(join(copy, "report/report.src"), template);
  }, 120_000);

  test("US-124-AC5, AC6: a quotation reads as compared only when a person agreed, and a flag outranks that", () => {
    const quotation = build().quotations.find((q) => q.id === "L-borings")!;
    expect(quotation.compared).toBe("none_recorded");
    const passage = JSON.parse(read(`records/passages/${quotation.passages[0]}.json`)) as { text: string; anchor: { index: number }[] };
    const review = (outcome: string, actor: string, extra: string[] = []) => done(["review", "add", passage.text, "--scope", "passage",
      "--passage", quotation.passages[0]!, "--pages", String(passage.anchor[0]!.index), "--against", "page image", "--outcome", outcome, "--actor", actor, ...extra]);
    const compared = () => build().quotations.find((q) => q.id === "L-borings")!.compared;

    review("agrees", "person:author");
    expect(compared()).toBe("person");
    expect(ledger().units.filter((u) => u.quotations.includes("L-borings")).map((u) => u.labels.support)).toContain("not_judged");
    review("flagged", "model:some-model", ["--flag", `${passage.anchor[0]!.index}|a reading|another|a doubt`]);
    expect(compared()).toBe("flagged");
  }, 120_000);
});

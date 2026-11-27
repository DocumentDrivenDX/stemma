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
  subjects: { path: string; sha256: string }[]; units: Unit[]; totals: unknown;
  quotations: { id: string; compared: string; passages: string[] }[];
};
const build = () => {
  done(["build", "report", "report"]);
  return ledger();
};
const mark = (text: string, authorship: string, actor: string) => done(["record", "add", "authorship_mark", "--input", "-", "--actor", actor],
  JSON.stringify({ text, authorship, version: "draft" }));

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
  test("labels every sentence, recounts to its totals, and holds no sentence text", () => {
    const made = JSON.parse(readFileSync(join(EXAMPLE, "report/evidence.json"), "utf8")) as ReturnType<typeof ledger>;
    expect(made.totals).toEqual(totalsOf(made.units) as unknown);
    expect(new Set(made.units.map((u) => u.id)).size).toBe(made.units.length);
    for (const unit of made.units) {
      expect(["quotation", "cited", "uncited"]).toContain(unit.labels.basis);
      expect(unit.labels.support).toBe(unit.labels.basis === "uncited" ? "not_applicable" : "not_judged");
      expect(unit.labels.wording).toBe("unrecorded");
    }
    for (const subject of made.subjects) expect(subject.sha256).toBe(sha(readFileSync(join(EXAMPLE, "report", subject.path), "utf8")));
    const bytes = readFileSync(join(EXAMPLE, "report/evidence.json"), "utf8");
    for (const words of ["Darwin said so", "doubly rich millionaire"]) expect(bytes).not.toContain(words);
  });

  test("a writer is recorded only by a mark that holds the sentence, and marks that disagree record none", () => {
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

  test("words typed between quotation marks are told apart from copied quotations", () => {
    const template = read("report/report.src");
    writeFileSync(join(copy, "report/report.src"), template.replace(SENTENCE, 'A critic called it "a wholly typed phrase" at the time.'));
    const units = build().units;
    expect(units.filter((u) => u.labels.typed_quotation === "yes")).toHaveLength(1);
    expect(unitOf(units, 'A critic called it "a wholly typed phrase" at the time.').labels).toMatchObject({ basis: "uncited", typed_quotation: "yes" });
    writeFileSync(join(copy, "report/report.src"), template);
  }, 120_000);

  test("a quotation reads as compared only when a person agreed, and a flag outranks that", () => {
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

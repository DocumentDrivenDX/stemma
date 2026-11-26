import { describe, expect, test } from "bun:test";
import { ActorNeeded, findCoordinates, groupResults, guarded, InvalidInput, label, prepareRecord, PROBLEMS, renderReport, runChecks, TEMPLATES } from "@stemma/core";
import { canonical, loadCorpus } from "@stemma/records";
import { readProject } from "@stemma/workspace";
import { fixture } from "./helpers.ts";

const run = (name: string) => runChecks(loadCorpus(readProject(fixture(name))), { stemma: "test" }).body;

describe("explanations", () => {
  test("US-026-AC1 every template says what is wrong, why it matters, and what to do", () => {
    for (const template of Object.values(TEMPLATES)) {
      expect(template.message.length).toBeGreaterThan(20);
      expect(template.why.length).toBeGreaterThan(20);
      expect(template.suggestions.length).toBeGreaterThan(0);
    }
    expect(Object.values(PROBLEMS).every((text) => text.length > 0)).toBe(true);
  });

  test("US-026-AC1 results are pass, fail, or unverifiable, with evidence and explanation", () => {
    const { results } = run("seeded");
    expect(new Set(results.map((r) => r.outcome))).toEqual(new Set(["pass", "fail", "unverifiable"]));
    for (const result of results) {
      expect(result.evidence.length).toBeGreaterThan(0);
      if (result.outcome !== "pass") expect([result.why.length > 0, result.suggestions.length > 0, result.open]).toEqual([true, true, true]);
    }
  });

  test("US-026-AC6 findings with one cause are shown once with every affected item", () => {
    const one = run("seeded").results.find((r) => r.check === "cite.key" && r.open)!;
    const five = Array.from({ length: 5 }, (_, i) => ({ ...one, subject: `cit-copy${i}` }));
    expect(groupResults(five)).toHaveLength(1);
  });

  test("untrusted text cannot add lines or terminal control sequences to the text report", () => {
    const body = run("seeded");
    const finding = body.results.find((r) => r.check === "cite.key" && r.open)!;
    finding.evidence = [{ name: "key", class: "manuscript", value: "a\u001b[2J\nCHECKED CLEAN" }];
    expect(renderReport(body)).toContain("a?[2J?CHECKED CLEAN");
  });

  test("a check that throws is unverifiable with check_error, never a pass", () => {
    const errors: string[] = [];
    const results = guarded("cite.key", run("clean") as never, () => { throw new Error("boom"); }, errors);
    expect(results.map((r) => [r.outcome, r.reason_code, r.open])).toEqual([["unverifiable", "check_error", true]]);
    expect(errors).toHaveLength(1);
  });
});

describe("label", () => {
  test("a not_implemented check counts as open; input_absent does not", () => {
    expect(label([], [{ check: "source.held", reason: "input_absent" }])).toBe("checked_clean");
    expect(label([], [{ check: "source.held", reason: "not_implemented" }])).toBe("open_findings");
  });

  test("a cited source keeps the label open while source.held is not implemented", () => {
    const body = run("cited");
    expect(body.results.filter((r) => r.open)).toEqual([]);
    expect(body.label).toBe("open_findings");
    expect(body.not_run.filter((n) => n.reason === "not_implemented").map((n) => n.check)).toEqual(["meta.resolver", "number.present", "source.held"]);
  });

  test("record kinds whose extra rules are not checked keep the label open", () => {
    const content = readProject(fixture("clean"));
    const claim = { schema: "stemma.record/0", id: "clm-aaaaaaaa", kind: "claim", created: { at: "2026-01-05T09:58:00Z", by: { kind: "person", name: "a" } } };
    content.records.push({ path: "records/claims/clm-aaaaaaaa.json", bytes: new TextEncoder().encode(canonical(claim)) });
    const { body } = runChecks(loadCorpus(content), {});
    expect(body.not_run).toContainEqual({ check: "record.valid", reason: "not_implemented" });
    expect(body.label).toBe("open_findings");
  });
});

describe("coordinate.stray forms", () => {
  test.each([
    "at 12.34567, -45.67891 on the survey",
    "12.345,45.678",
    "12°34′56″N 45°6′7″W",
    "12.5° S, 45.25° E",
    '12°34\'56\\"N, 45°6\'7\\"E',
    "see geo:12.5,-45.25 here",
  ])("recognizes %s", (line) => {
    expect(findCoordinates(line)).toHaveLength(1);
  });

  test.each([
    "pages 12.34, 45.67",
    "version 1.234.5, 2.345.6",
    "values 912.345, 845.678",
    "a temperature of 12° North of here",
    '"at": "2026-01-05T09:58:00.123Z"',
  ])("does not flag %s", (line) => {
    expect(findCoordinates(line)).toEqual([]);
  });

  test("the finding gives the position and never the value", () => {
    const finding = run("seeded").results.filter((r) => r.check === "coordinate.stray" && r.open);
    expect(finding).toHaveLength(1);
    expect(JSON.stringify(finding)).not.toContain("12.34567");
    expect(finding[0]!.message).toContain("coordinate");
    expect(finding[0]!.why).toContain("can disclose a restricted site's position");
  });
});

describe("operations a user interface would call", () => {
  const request = { kind: "source", input: '{"citation_key": "a2001"}', now: new Date("2026-01-05T09:58:00.500Z"), token: () => "aaaaaaaa" };

  test("record preparation fills only defined defaults and is pure", () => {
    const made = prepareRecord({ ...request, actor: { kind: "person", name: "author" } });
    expect(made.path).toBe("records/sources/src-aaaaaaaa.json");
    expect(JSON.parse(made.text)).toEqual({
      schema: "stemma.record/0", id: "src-aaaaaaaa", kind: "source", citation_key: "a2001", admission: "candidate", intake: "parsed",
      created: { at: "2026-01-05T09:58:00Z", by: { kind: "person", name: "author" } },
    });
  });

  test("it asks who is adding a record and refuses input it would change", () => {
    expect(() => prepareRecord(request)).toThrow(ActorNeeded);
    expect(() => prepareRecord({ ...request, input: "[1]" })).toThrow(InvalidInput);
    expect(() => prepareRecord({ ...request, input: '{"subtype": 1.5}' })).toThrow(InvalidInput);
  });
});

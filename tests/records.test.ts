import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { canonical, checkRuleHeadings, JsonUnreadable, loadCorpus, parseJson, type SourceFile, sha256 } from "@stemma/records";
import { generate, OUTPUT_PATH } from "../scripts/generate-schema.ts";

const bytes = (text: string) => new TextEncoder().encode(text);
const at = { at: "2026-01-05T09:58:00Z", by: { kind: "person", name: "author" } };
const source = (id: string, key: string, more: object = {}) => ({
  schema: "stemma.record/0", id, kind: "source", created: at, citation_key: key, intake: "parsed", admission: "candidate", ...more,
});
const file = (record: { id: string; [key: string]: unknown }, text = canonical(record)): SourceFile => ({ path: `records/sources/${record.id}.json`, bytes: bytes(text) });
const settings = (more: object = {}): SourceFile => ({
  path: "stemma.json", bytes: bytes(canonical({ schema: "stemma.project/0", project_id: "p", format: 0, ...more })),
});
const load = (records: SourceFile[], project = settings()) => loadCorpus({ settings: project, records, sources: [], manuscript: [] });
const codes = (corpus: ReturnType<typeof load>) => corpus.records.flatMap((f) => f.problems.map((p) => p.code));

describe("canonical form", () => {
  test("sorts keys by code point, keeps array order, and is stable", () => {
    const text = canonical({ b: [2, 1], a: {}, "\u{10000}": [], "￿": "x\r\ny", "10": 1, "9": 2 });
    expect(text).toBe('{\n  "10": 1,\n  "9": 2,\n  "a": {},\n  "b": [\n    2,\n    1\n  ],\n  "￿": "x\\ny",\n  "\u{10000}": []\n}\n');
    expect(canonical(parseJson(text).value)).toBe(text);
  });

  test("keeps exact line endings in preserved legacy values and applies no Unicode normalization", () => {
    const record = { legacy: [{ entry_text: "a\r\nb" }], title: "é" };
    expect(canonical(record)).toContain('"a\\r\\nb"');
    expect(canonical(record)).toContain("é");
  });

  test("treats __proto__ as an ordinary key", () => {
    expect(canonical(parseJson('{"__proto__": 1}').value)).toBe('{\n  "__proto__": 1\n}\n');
  });

  test.each([
    ['{"a": 1, "a": 2}', "duplicate_key"],
    ['{"a": "\\ud800"}', "lone_surrogate"],
    ['{"a": 1', "syntax"],
    ["<<<<<<< ours\n{}", "syntax"],
    [`${"[".repeat(500)}${"]".repeat(500)}`, "too_deep"],
  ])("rejects %p as %s", (text, problem) => {
    expect(() => parseJson(text)).toThrow(new JsonUnreadable(problem as "syntax"));
  });

  test("reports null and non-integer numbers, which rewriting would change", () => {
    expect(parseJson('{"a": null, "b": 1.5}').forbidden.map((f) => f.problem)).toEqual(["null_value", "number_not_integer"]);
  });
});

describe("record rules", () => {
  test("the schema table matches the UMF schema", () => {
    expect(readFileSync(OUTPUT_PATH, "utf8")).toBe(generate());
  });

  test("a canonical source has no problems", () => {
    expect(codes(load([file(source("src-aaaaaaaa", "a2001"))]))).toEqual([]);
  });

  test("shape: missing, mistyped, disallowed, and unknown fields; x is allowed", () => {
    const bad = source("src-aaaaaaaa", "a2001", { admission: "maybe", title: "plain", tittle: "x", x: { "me.note": 1 }, intake: undefined });
    expect(codes(load([file(bad)])).sort()).toEqual(["missing_field", "not_an_object", "unknown_field", "value_not_allowed"]);
  });

  test("citation keys are unique without ASCII case, except a replacement's alias", () => {
    const a = file(source("src-aaaaaaaa", "Smith1990"));
    const b = file(source("src-bbbbbbbb", "smith1990"));
    expect(codes(load([a, b]))).toEqual(["duplicate_citation_key", "duplicate_citation_key"]);
    const old = source("src-aaaaaaaa", "smith1990", { retired: { stamp: at, reason: "replaced", replaced_by: "src-bbbbbbbb" } });
    const next = source("src-bbbbbbbb", "smith1991", { key_aliases: ["smith1990"] });
    expect(codes(load([file(old), file(next)]))).toEqual([]);
  });

  test("references must exist and be of an allowed kind", () => {
    const agent = source("src-aaaaaaaa", "a2001", { contributions: [{ lid: "a", role: "author", agent: "src-aaaaaaaa" }] });
    expect(codes(load([file(agent)]))).toEqual(["reference_wrong_kind"]);
    expect(load([], settings({ bibliography_include: ["src-zzzzzzzz"] })).settings.problems.map((p) => p.code)).toEqual(["reference_missing"]);
  });

  test("a file must sit under its own ID and kind directory", () => {
    const record = source("src-aaaaaaaa", "a2001");
    expect(codes(load([{ path: "records/agents/src-aaaaaaaa.json", bytes: bytes(canonical(record)) }]))).toEqual(["wrong_location"]);
  });

  test("a citation's sentence digest must match its normalized text", () => {
    const record = { schema: "stemma.record/0", id: "cit-aaaaaaaa", kind: "citation", created: at, key: "a", intake: "parsed", sentence: { text: "One.", sha256: sha256("Two.") } };
    expect(codes(load([{ path: "records/citations/cit-aaaaaaaa.json", bytes: bytes(canonical(record)) }]))).toEqual(["sentence_digest_mismatch"]);
  });

  test("a newer record version is not interpreted", () => {
    expect(load([file({ ...source("src-aaaaaaaa", "a"), schema: "stemma.record/1" })]).records[0]!.state).toBe("version_unsupported");
  });

  test("rules.md headings", () => {
    const text = "## RULE-001 A\n```\n## not a rule\n```\n## Notes\n## RULE-001 B\n";
    expect(checkRuleHeadings(text).map((p) => [p.code, p.line])).toEqual([["rule_heading_invalid", 5], ["rule_id_duplicate", 6]]);
  });
});

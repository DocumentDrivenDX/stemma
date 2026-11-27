// Note and claim rules and review marks (FR-20, FR-21, FR-23; CONTRACT-002 B1
// and C). The records are invented.
import { describe, expect, test } from "bun:test";
import { PROBLEMS, runChecks } from "@stemma/core";
import { canonical, loadCorpus, type ProjectContent, recordPath } from "@stemma/records";

type Value = Record<string, unknown>;
const AT = "2026-01-05T09:00:00Z";
const model = { kind: "model", name: "a-model" };
const unreviewed = { state: "unreviewed" };
const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

const base = (id: string, kind: string): Value => ({ schema: "stemma.record/0", id, kind, created: { at: AT, by: model } });
const source: Value = { ...base("src-aaaaaaaa", "source"), citation_key: "one", type: "book", intake: "raw", admission: "candidate", title: { value: "One book" } };
const note = (id: string, more: Value = {}): Value => ({ ...base(id, "note"), type: "comment", source: source.id, body: "A remark", review: unreviewed, ...more });
const claim = (id: string, more: Value = {}): Value => ({ ...base(id, "claim"), text: "A claim", role: "claim", confidence: "low", reason: "Because.", review: unreviewed, ...more });
const link = (id: string, claimId: string, evidence: string, more: Value = {}): Value =>
  ({ ...base(id, "attestation"), claim: claimId, evidence, stance: "supports", review: unreviewed, ...more });

const project = (records: Value[], more: Partial<ProjectContent> = {}): ProjectContent => ({
  settings: { path: "stemma.json", bytes: bytes(canonical({ schema: "stemma.project/0", project_id: "noteclaims", format: 0 })) },
  records: records.map((r) => ({ path: recordPath(String(r.kind), String(r.id)), bytes: bytes(canonical(r)) })),
  sources: [], manuscript: [], research: [], ...more,
});
const check = (content: ProjectContent) => runChecks(loadCorpus(content), {}).body;
const of = (content: ProjectContent, name: string, subject?: string) =>
  check(content).results.filter((r) => r.check === name && (subject === undefined || r.subject === subject));
const evidence = (result: { evidence: { name: string; value: string }[] }, name: string) => result.evidence.filter((e) => e.name === name).map((e) => e.value);

describe("record.valid for notes, claims and attestations", () => {
  test("an extract or paraphrase note names a passage; a comment need not", () => {
    for (const [type, passages] of [["extract", undefined], ["paraphrase", []]] as const) {
      const bad = note("nte-aaaaaaaa", { type, ...(passages ? { passages } : {}) });
      const found = of(project([source, bad]), "record.valid", "nte-aaaaaaaa");
      expect(found.map((r) => [r.outcome, r.reason_code, r.open])).toEqual([["fail", "record_invalid", true]]);
      expect(evidence(found[0]!, "problem")).toEqual([PROBLEMS.note_without_passage]);
      expect(evidence(found[0]!, "field")).toEqual(["/passages"]);
    }
    expect(of(project([source, note("nte-bbbbbbbb")]), "record.valid", "nte-bbbbbbbb").map((r) => r.outcome)).toEqual(["pass"]);
  });

  test("every rule this version knows for these kinds is checked, so they alone leave record.valid complete", () => {
    const records = [source, note("nte-aaaaaaaa"), claim("clm-aaaaaaaa"), link("att-aaaaaaaa", "clm-aaaaaaaa", "nte-aaaaaaaa")];
    expect(check(project(records)).not_run.map((n) => n.check)).not.toContain("record.valid");
    const missing = claim("clm-bbbbbbbb");
    delete missing.review;
    expect(of(project([missing]), "record.valid", "clm-bbbbbbbb").map((r) => [r.outcome, evidence(r, "field")[0]])).toEqual([["fail", "/review"]]);
  });
});

// Note and claim rules and review marks (FR-20, FR-21, FR-23; CONTRACT-002 B1
// and C). The records are invented.
import { describe, expect, test } from "bun:test";
import { InvalidInput, prepareRecord, PROBLEMS, recordStates, runChecks } from "@stemma/core";
import { canonical, digest, loadCorpus, type ProjectContent, recordPath } from "@stemma/records";

type Value = Record<string, unknown>;
const AT = "2026-01-05T09:00:00Z";
const person = { kind: "person", name: "An Author" };
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

/** CONTRACT-001 E: a mark on the record as it is now. */
const reviewed = (record: Value): Value => {
  const { review: _r, created: _c, ...content } = record;
  return { ...record, review: { state: "reviewed", content_sha256: digest(content), decided: { at: AT, by: person } } };
};
const citation = (id: string, claims: string[]): Value => ({ ...base(id, "citation"), key: "one", claims, intake: "parsed" });

describe("one review rule", () => {
  const marked = reviewed(claim("clm-marked00"));
  const edited = { ...reviewed(claim("clm-edited00")), text: "Edited since the mark" };
  const said = claim("clm-nodigest", { review: { state: "reviewed" } });
  const evidenceNote = note("nte-reached0");
  const retiredNote = note("nte-retired0", { retired: { stamp: { at: AT, by: person }, reason: "gone" } });
  const records = [
    source, marked, edited, said, evidenceNote, retiredNote, note("nte-unreached"),
    link("att-reached0", "clm-marked00", "nte-reached0"), link("att-retired0", "clm-marked00", "nte-retired0"),
    citation("cit-aaaaaaaa", ["clm-marked00", "clm-edited00", "clm-nodigest"]),
  ];

  test("the report lists an edited reviewed claim, and a cited claim's attestations and evidence notes", () => {
    const listed = check(project(records)).unreviewed.filter((u) => u.reason === "unreviewed");
    expect(listed.map((u) => [u.record, u.kind, u.locations])).toEqual([
      ["att-reached0", "attestation", ["cit-aaaaaaaa"]], ["att-retired0", "attestation", ["cit-aaaaaaaa"]],
      ["clm-edited00", "claim", ["cit-aaaaaaaa"]], ["clm-nodigest", "claim", ["cit-aaaaaaaa"]], ["nte-reached0", "note", ["cit-aaaaaaaa"]],
    ]);
    expect(check(project(records)).summary.unreviewed).toBe(check(project(records)).unreviewed.length);
  });

  test("the export states agree with the report, and also mark what nothing cites", () => {
    const corpus = loadCorpus(project(records));
    const states = recordStates(corpus).records;
    const has = (id: string) => states.get(id)?.includes("unreviewed") ?? false;
    for (const item of check(project(records)).unreviewed) expect(has(item.record), item.record).toBe(true);
    expect([has("clm-marked00"), has("nte-unreached"), has("nte-retired0")]).toEqual([false, true, false]);
  });
});

describe("claim.complete", () => {
  const ID = "clm-aaaaaaaa";
  const good = [source, claim(ID), note("nte-aaaaaaaa"), link("att-aaaaaaaa", ID, "nte-aaaaaaaa", { stance: "contradicts" })];
  const one = (content: ProjectContent) => {
    const found = of(content, "claim.complete");
    expect(found).toHaveLength(1);
    return found[0]!;
  };
  const without = (records: Value[], id: string) => records.filter((r) => r.id !== id);
  const swap = (records: Value[], changed: Value) => records.map((r) => (r.id === changed.id ? changed : r));
  const gone = { retired: { stamp: { at: AT, by: person }, reason: "gone" } };

  test("a claim with confidence, a reason and a note passes, whatever the note's stance and review", () => {
    const body = check(project(good));
    expect(one(project(good))).toMatchObject({ outcome: "pass", subject: ID, open: false });
    expect(body.not_run.map((n) => n.check)).not.toContain("claim.complete");
  });

  test("each missing part is named, the thesis included", () => {
    const cases: [Value[], string][] = [
      [without(good, "att-aaaaaaaa"), "note"],
      [without(good, "nte-aaaaaaaa"), "note"],
      [swap(good, note("nte-aaaaaaaa", gone)), "note"],
      [swap(good, link("att-aaaaaaaa", ID, "nte-aaaaaaaa", gone)), "note"],
      [[source, claim(ID, { confidence: undefined, role: "thesis" }), ...good.slice(2)], "confidence"],
      [swap(good, claim(ID, { confidence: "certain" })), "confidence"],
      [swap(good, claim(ID, { reason: "  " })), "reason"],
      [[source, claim(ID, { confidence: "", reason: "" })], "note, confidence, reason"],
    ];
    for (const [records, missing] of cases) {
      const content = project(records.map((r) => JSON.parse(JSON.stringify(r)) as Value));
      const found = one(content);
      expect([found.outcome, found.reason_code, found.open, evidence(found, "missing")[0]]).toEqual(["fail", "claim_incomplete", true, missing]);
      expect([found.message, found.why, ...found.suggestions].join(" ")).not.toMatch(/review|approv|verif/i);
    }
  });

  test("a passage linked directly is not a note, and the evidence says why the link does not count", () => {
    const passage = { ...base("psg-aaaaaaaa", "passage"), source: source.id };
    const found = one(project([source, claim(ID), passage, link("att-aaaaaaaa", ID, "psg-aaaaaaaa")]));
    expect(evidence(found, "attestation_without_a_note")).toEqual(["records/attestations/att-aaaaaaaa.json: its evidence is a passage, not a note"]);
  });

  test("a retired claim gives no result", () => {
    expect(of(project([claim(ID, gone)]), "claim.complete")).toEqual([]);
  });

  test("with no note reached, an unreadable related record leaves it unverifiable, and other missing parts are still named", () => {
    for (const path of ["records/attestations/att-broken00.json", "records/notes/nte-aaaaaaaa.json"]) {
      const records = path.includes("notes") ? [source, claim(ID, { reason: "" }), good[3]!] : [source, claim(ID, { reason: "" })];
      const content = project(records);
      content.records.push({ path, bytes: bytes("{ not json") });
      const found = one(content);
      expect([found.outcome, found.reason_code, found.open]).toEqual(["unverifiable", "record_unreadable", true]);
      expect(evidence(found, "cannot_be_read")).toEqual([path]);
      expect(evidence(found, "missing")).toEqual(["reason"]);
    }
    // Something unreadable that cannot lead to a note changes nothing, and nor does one beside a note.
    const unrelated = project([source, claim(ID)]);
    unrelated.records.push({ path: "records/notes/nte-broken00.json", bytes: bytes("{") });
    expect(one(unrelated).reason_code).toBe("claim_incomplete");
    const beside = project(good);
    beside.records.push({ path: "records/attestations/att-broken00.json", bytes: bytes("{") });
    expect(one(beside).outcome).toBe("pass");
  });

  test("it runs with manuscript files present, and gives the claim its state in the export", () => {
    const content = project([claim(ID)], { manuscript: [{ path: "manuscript/a.md", bytes: bytes("Words.\n") }] });
    expect(one(content).outcome).toBe("fail");
    const states = recordStates(loadCorpus(content));
    expect(states.checks).toContain("claim.complete");
    expect(states.records.get(ID)).toContain("open_finding");
  });
});

describe("record add and the review mark", () => {
  const request = (fields: Value, actor?: { kind: "person" | "model" | "software"; name: string }, kind = "claim") =>
    JSON.parse(prepareRecord({ kind, input: JSON.stringify(fields), ...(actor ? { actor } : {}), now: new Date(AT), token: () => "aaaaaaaa" }).text) as Value;
  const fields = { text: "A claim", role: "claim" };

  test("a kind with a review mark starts unreviewed; others get none", () => {
    for (const actor of [person, model] as const) {
      expect(request(fields, actor as never).review).toEqual({ state: "unreviewed" });
    }
    expect(request({ type: "comment", source: "src-aaaaaaaa", body: "A remark" }, model as never, "note").review).toEqual({ state: "unreviewed" });
    expect(request({ citation_key: "one" }, model as never, "source").review).toBeUndefined();
  });

  test("a person's reviewed record gets the digest of its content and a dated decision, and the mark applies", () => {
    const made = request({ ...fields, review: { state: "reviewed" } }, person as never);
    expect(made.review).toEqual(reviewed(made).review);
    expect(states(made)).not.toContain("unreviewed");
    // With the person named only in `created`.
    const typed = request({ ...fields, created: { at: AT, by: person }, review: { state: "reviewed" } });
    expect(typed.review).toEqual(reviewed(typed).review);
  });

  test("a model or software actor cannot add a record as reviewed, however the input names people", () => {
    const mark = { state: "reviewed" };
    const asPerson = { at: AT, by: person };
    for (const [input, actor] of [
      [{ ...fields, review: mark }, model], [{ ...fields, review: mark }, { kind: "software", name: "s" }],
      [{ ...fields, review: mark, created: asPerson }, model], [{ ...fields, review: mark, created: { at: AT, by: model } }, person],
      [{ ...fields, review: { ...mark, decided: { at: AT, by: model } } }, person],
      [{ ...fields, review: mark, created: { at: AT } }, undefined],
    ] as const) {
      expect(() => request(input as Value, actor as never)).toThrow(InvalidInput);
    }
  });
});

const states = (record: Value) => recordStates(loadCorpus(project([record]))).records.get(String(record.id)) ?? [];

// The graph projection (CONTRACT-005 B, E for the author, F and J).
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createStaticClient, loadStore } from "@documentdrivendx/arras-ui/static";
import { planAnnotation, runChecks } from "@stemma/core";
import { ARRAS_VERSION, checkName, dataIdentity, type Export, exportBlockers, exportGraph, exportStaleness, ExportMappingError, fillPage, InvalidRecords, MANIFEST, propertyName, SEARCHED_TYPES } from "@stemma/graph";
import { canonical, type Corpus, digest, KIND_TYPES, loadCorpus, type ProjectContent, REFERENCES, searchFold } from "@stemma/records";
import { readProject, randomToken } from "@stemma/workspace";
import { everyShape, fixtureId, recordFile } from "./graph-fixture.ts";
import { fixture, ROOT } from "./helpers.ts";

const VERSION = "9.9.9-test";
const AT = "2026-01-05T09:00:00Z";
const by = { kind: "person", name: "A Person" };
const base = (id: string, kind: string) => ({ schema: "stemma.record/0", id, kind, created: { at: AT, by } });
const text = (value: string): Uint8Array => new TextEncoder().encode(value);
const project = (records: object[], more: Partial<ProjectContent> = {}): ProjectContent => ({
  settings: { path: "stemma.json", bytes: text(canonical({ schema: "stemma.project/0", project_id: "graphtests", format: 0 })) },
  records: records.map((r) => recordFile(r as Record<string, unknown>)), sources: [], manuscript: [], research: [], ...more,
});

const file = (out: Export, name: string) => out.files.find((f) => f.name === name)!.text;
const load = (out: Export) => loadStore(file(out, "stemma.umf.json"), file(out, "stemma.graph.json"));
type Graph = { records: { type?: string; key?: string; properties?: Record<string, unknown>; relationship?: string; source?: string; target?: string }[] };
const graphOf = (out: Export): Graph => JSON.parse(file(out, "stemma.graph.json"));
const entity = (out: Export, key: string) => graphOf(out).records.find((r) => r.key === key)?.properties;
const counted = (out: Export, type: string, reason: string) => out.manifest.omissions.find((o) => o.type === type && o.reason === reason)?.count ?? 0;
const make = (corpus: Corpus) => exportGraph(corpus, { version: VERSION });

const reefs = () => loadCorpus(readProject(join(ROOT, "examples/coral-reefs")));

describe("the export of the worked example", () => {
  test("arras loads it, with every record that is not retired and every file's digest in the manifest", async () => {
    const corpus = reefs();
    const out = make(corpus);
    const store = await load(out);
    const live = corpus.records.filter((f) => f.data && f.data.retired === undefined);
    for (const record of live) expect(store.get(KIND_TYPES[String(record.data!.kind)]!, String(record.data!.id))).toBeDefined();
    expect([...store.entities.values()].reduce((n, l) => n + l.length, 0)).toBe(out.manifest.counts.entities);
    const names = out.files.map((f) => f.name).filter((n) => n !== MANIFEST);
    expect(Object.keys(out.manifest.files)).toEqual(names);
    for (const name of names) expect(out.manifest.files[name]).toBe(new Bun.CryptoHasher("sha256").update(file(out, name)).digest("hex"));
    expect(out.manifest.arras).toBe(JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).devDependencies["@documentdrivendx/arras-ui"]);
    expect(out.manifest.arras).toBe(ARRAS_VERSION);
    expect(counted(out, "SourceText", "page_text")).toBe(corpus.partFiles.length);
    expect(counted(out, "Annotation", "retired")).toBe(1);
  });

  test("the same files give the same bytes, in whatever directory, with no machine path in them", () => {
    const one = make(reefs());
    const copy = fixture("clean");
    expect(make(loadCorpus(readProject(copy))).files).toEqual(make(loadCorpus(readProject(copy))).files);
    expect(make(reefs()).files).toEqual(one.files);
    for (const f of one.files) expect(f.text).not.toContain(ROOT);
  });
});

describe("a project with every kind, field and link the schema allows", () => {
  const corpus = loadCorpus(everyShape());
  const out = make(corpus);

  test("arras loads it", async () => {
    expect(exportBlockers(corpus)).toEqual([]);
    const store = await load(out);
    expect(store.module.entityTypes.length).toBe(Object.keys(KIND_TYPES).length + 3);
    // Searched types come first: arras searches the first 20 that declare a search.
    expect(store.module.entityTypes.slice(0, 20).map((t) => t.local)).toEqual(SEARCHED_TYPES);
    expect(store.module.entityTypes.filter((t) => (store.resolved.types.get(t.local)!.search.length > 0)).map((t) => t.local)).toEqual(SEARCHED_TYPES);
    for (const view of store.resolved.types.values()) {
      for (const field of view.fields) expect(["text", "prose", "tags", "number", "boolean"]).toContain(field.format);
    }
  });

  test("each reference field gives a relationship for each pair of types it allows", () => {
    const relationships = new Set(out.projection.relationships.map((r) => `${r.sourceType} ${r.path.join(".")} ${r.targetType}`));
    for (const [path, allowed] of Object.entries(REFERENCES)) {
      const [kind, ...fields] = path.split(".");
      // Legacy values and a retired record's replacement are in no export.
      if (kind === "project" || fields[0] === "legacy" || fields[0] === "retired") continue;
      const entry = fields[0] === "contributions" ? "Contribution" : kind === "source" && fields[0] === "relations" ? "SourceRelation" : kind === "construct" && fields[0] === "relations" ? "ConstructRelation" : undefined;
      for (const target of allowed) {
        const name = `${entry ?? KIND_TYPES[kind!]} ${(entry ? fields.slice(1) : fields).join(".")} ${KIND_TYPES[target]}`;
        expect([name, relationships.has(name)]).toEqual([name, true]);
      }
    }
    expect(out.projection.relationships.map((r) => r.name)).toContain("attestationEvidenceNote");
    const owned = graphOf(out).records.filter((r) => r.relationship === "sourceContributionsContribution");
    expect(owned[0]!.target).toMatch(/^src-fixture\d+\.e0$/);
  });

  test("reserved names are renamed and a name arras refuses stops the export", () => {
    expect([propertyName(["kind"]), propertyName(["type"]), propertyName(["version"])]).toEqual(["recordKind", "recordType", "recordVersion"]);
    expect([propertyName(["created", "at"]), propertyName(["created", "by", "kind"])]).toEqual(["recordCreatedAt", "createdByKind"]);
    expect(() => checkName("type")).toThrow(ExportMappingError);
    expect(() => checkName("a".repeat(65))).toThrow(ExportMappingError);
  });

  test("a support record says it is a recorded model judgment", () => {
    const record = entity(out, fixtureId("support_record"))!;
    expect(record.stemmaNotice).toContain("A recorded model judgment, not verification.");
    expect(record.heading).toStartWith("Model judgment:");
    const module = JSON.parse(file(out, "stemma.umf.json"));
    const type = module.modules[0].elements.find((e: { id: string }) => e.id === "SupportRecord");
    expect(type.extensions["arras.view"].label).toBe("Support record (model judgment)");
    expect(out.manifest.states.not_computed).toEqual(["support_missing", "support_stale", "support_unsupported"]);
  });
});

describe("what an export leaves out", () => {
  const SECRET = "SEEDED-LEFT-OUT";
  const source = {
    ...base("src-leftoutsource01", "source"), citation_key: "leftout", type: "book", intake: "raw", admission: "candidate",
    title: { value: "Kept title" }, x: { "a.b": `${SECRET}-extension` }, invented: `${SECRET}-unknown`,
    legacy: [{ import: "imp-leftoutimport1", ordinal: 0, entry_text: `${SECRET}-entry`, fields: [{ native_path: `${SECRET}-native`, value: `${SECRET}-value`, encoding: "text" }] }],
    bib: [{ name: "note", value: { value: "/Users/someone/SEEDED-LEFT-OUT-path.pdf" } }],
    rights: { permission_note: "file:///home/someone/SEEDED-LEFT-OUT.pdf" },
  };
  const batch = {
    ...base("imp-leftoutimport1", "import_batch"), format: "biblatex", codec: { name: "c", version: "1" }, original_name: `${SECRET}-name.bib`,
    original_sha256: "a".repeat(64), size: 1, entry_count: 1, blocks: [{ kind: "comment", text: `${SECRET}-block`, ordinal: 0 }],
  };
  const retired = { ...base("nte-leftoutnote001", "note"), type: "comment", source: source.id, body: `${SECRET}-retired`, review: { state: "unreviewed" }, retired: { stamp: { at: AT, by }, reason: `${SECRET}-reason` } };
  const claim = { ...base("clm-leftoutclaim01", "claim"), text: "A claim", role: "claim", review: { state: "unreviewed" } };
  const attestation = { ...base("att-leftoutatt0001", "attestation"), claim: claim.id, evidence: retired.id, stance: "supports", review: { state: "unreviewed" } };
  const corpus = loadCorpus(project([source, batch, retired, claim, attestation]));

  test("retired records, legacy values, extensions, unknown fields, file names and local paths are absent and counted", () => {
    const out = make(corpus);
    for (const f of out.files) expect([f.name, f.text.includes(SECRET)]).toEqual([f.name, false]);
    expect(counted(out, "Note", "retired")).toBe(1);
    expect(counted(out, "Source", "legacy")).toBe(1);
    expect(counted(out, "Source", "extension")).toBe(1);
    expect(counted(out, "Source", "unrecognized_field")).toBe(1);
    expect(counted(out, "Source", "local_path")).toBe(2);
    expect(counted(out, "ImportBatch", "local_path")).toBe(1);
    expect(counted(out, "ImportBatch", "legacy")).toBe(1);
    expect(out.manifest.dropped_links).toContainEqual({ relationship: "attestation.evidence", reason: "target_retired", count: 1 });
    expect(out.manifest.dropped_links).toContainEqual({ relationship: "note.source", reason: "from_retired_record", count: 1 });
    expect(entity(out, attestation.id)!.stemmaStates).toContain("retired_link");
  });

  test("a coordinate field named x stays", () => {
    const out = make(loadCorpus(everyShape()));
    expect(entity(out, fixtureId("passage"))!.regionX).toBe("passage.region.x value");
  });
});

describe("restricted places (CONTRACT-001 H)", () => {
  const at = (value: string) => ({ lon: value, lat: value });
  const location = (id: string, sensitivity: object, geometry: object) => ({
    ...base(id, "place_location"), place: "plc-restrictplace1", certainty: "certain", method: "surveyed", evidence: ["src-restrictsource"], review: { state: "unreviewed" },
    sensitivity: { class: "restricted", decided: { at: AT, by }, ...sensitivity }, geometry,
  });
  const place = { ...base("plc-restrictplace1", "place"), label: "A place" };
  const source = { ...base("src-restrictsource", "source"), citation_key: "r", type: "book", intake: "raw", admission: "candidate" };
  const point = { type: "Point", positions: [at("11.111111")] };
  const leak = location("loc-restrictpoint01", { release: "area" }, point);
  const withheld = location("loc-restrictpoint02", { release: "withhold" }, { type: "Polygon", positions: [at("22.222222")] });
  const exact = location("loc-restrictpoint03", { release: "exact" }, { type: "Polygon", positions: [at("33.333333")] });
  const area = location("loc-restrictpoint04", { release: "area" }, { type: "Polygon", positions: [at("44")] });
  const open = { ...location("loc-restrictpoint05", {}, { type: "Point", positions: [at("55.5")] }), sensitivity: { class: "public", release: "exact", decided: { at: AT, by } } };
  const digestOf = "c".repeat(64);
  const note = { ...base("ann-restrictnote001", "annotation"), effect: "explain", check: "record.valid", finding_key: "k", reason: "r", written: { at: AT, by }, item: { record: leak.id, content_sha256: digestOf } };
  const reviewed = { ...leak, review: { state: "reviewed", content_sha256: digestOf } };
  const out = make(loadCorpus(project([place, source, reviewed, withheld, exact, area, open, note])));

  test("only an author-released area or a public location keeps geometry, and the export warns", () => {
    for (const f of out.files) {
      for (const value of ["11.111111", "22.222222", "33.333333", digestOf]) expect([f.name, value, f.text.includes(value)]).toEqual([f.name, value, false]);
    }
    for (const id of [leak.id, withheld.id, exact.id]) expect(Object.keys(entity(out, id)!).filter((k) => k.startsWith("geometry"))).toEqual([]);
    expect(JSON.stringify(entity(out, area.id))).toContain("lon: 44");
    expect(JSON.stringify(entity(out, open.id))).toContain("lon: 55.5");
    expect(out.manifest.warnings).toEqual([expect.objectContaining({ code: "restricted_in_project", records: [leak.id, withheld.id, exact.id] })]);
    expect(counted(out, "PlaceLocation", "restricted_geometry")).toBe(3);
    expect(counted(out, "PlaceLocation", "restricted_digest")).toBe(1);
    expect(counted(out, "Annotation", "restricted_digest")).toBe(1);
  });

  test("coordinates are in no search index", () => {
    for (const record of graphOf(out).records) expect(String(record.properties?.searchText ?? "")).not.toMatch(/55\.5|11\.111/);
  });
});

describe("search text", () => {
  const agent = { ...base("agt-foldedagent001", "agent"), name: { family: "Ḥusayn", given: "Ṭāhā" } };
  const source = {
    ...base("src-foldedsource01", "source"), citation_key: "taha", type: "book", intake: "raw", admission: "candidate",
    title: { value: "Ὀδύσσεια", variants: [{ kind: "original", value: "مُحَمَّد" }] },
    contributions: [{ lid: "a", role: "author", agent: agent.id }],
  };

  test.each(["husayn", "Ḥusayn", "taha husayn", "οδυσσεια", "محمد", "مُحَمَّد"])(
    "the folded query %s finds the source by its author and titles", async (query) => {
      const client = createStaticClient(await load(make(loadCorpus(project([agent, source])))));
      const answer = await client.moduleQuery("stemma", "query($text: String!) { _search(text: $text, types: [\"Source\"]) { hits { key } } }", { text: searchFold(query) });
      expect((answer.data as { _search: { hits: { key: string }[] } })._search.hits.map((h) => h.key)).toEqual([source.id]);
    });

  test("the record keeps its own spelling", () => {
    expect(entity(make(loadCorpus(project([agent, source]))), agent.id)!.nameFamily).toBe(agent.name.family);
  });
});

describe("record text that looks like markup", () => {
  const hostile = "</script><script>alert(1)</script> <img src=x onerror=alert(2)> $& $' __STEMMA_GRAPH_JSON__ <!--";
  const claim = { ...base("clm-hostileclaim01", "claim"), text: hostile, role: "claim", review: { state: "unreviewed" } };
  const out = make(loadCorpus(project([claim])));

  test("is written with no `<` in any JSON file and reads back unchanged", () => {
    for (const f of out.files) expect(f.text).not.toContain("<");
    expect(entity(out, claim.id)!.text).toBe(hostile);
  });

  test("goes into the page as it is, once, whatever it says", () => {
    const template = "<a>__STEMMA_BANNER_JSON__</a><b>__STEMMA_MODULE_JSON__</b><c>__STEMMA_GRAPH_JSON__</c>";
    const graph = file(out, "stemma.graph.json");
    const page = fillPage(template, { banner: "{}", stemma: "{}", graph });
    expect(page).toBe(`<a>{}</a><b>{}</b><c>${graph}</c>`);
    expect(() => fillPage(template, { banner: "<", stemma: "{}", graph })).toThrow("unescaped");
    expect(() => fillPage("__STEMMA_GRAPH_JSON__", { banner: "{}", stemma: "{}", graph })).toThrow("lacks");
  });
});

describe("invalid records", () => {
  test("stop the export, and warnings do not", () => {
    expect(() => make(loadCorpus(project([{ ...base("clm-invalidclaim01", "claim") }])))).toThrow(InvalidRecords);
    const warned = { ...base("clm-warnedclaim001", "claim"), text: "t", role: "claim", review: { state: "unreviewed" }, unheard_of: 1 };
    expect(make(loadCorpus(project([warned]))).manifest.counts.entities).toBe(1);
  });
});

describe("record states", () => {
  const claim = (id: string, review: object) => ({ ...base(id, "claim"), text: `Claim ${id}`, role: "claim", review });

  /** CONTRACT-001 E: `content_sha256`, over the record without its review and bookkeeping. */
  const reviewed = (record: object) => {
    const { review: _r, created: _c, ...content } = record as Record<string, unknown>;
    return digest(content);
  };

  test("a review mark applies only while the record is what was reviewed", () => {
    const marked = claim("clm-statemarked001", { state: "reviewed", content_sha256: "0".repeat(64) });
    marked.review = { state: "reviewed", content_sha256: reviewed(marked) };
    const edited = { ...claim("clm-stateedited001", marked.review), text: "Edited since" };
    const out = make(loadCorpus(project([marked, edited, claim("clm-stateunread001", { state: "unreviewed" })])));
    expect(out.states.records.get(marked.id)).toBeUndefined();
    expect(out.states.records.get(edited.id)).toEqual(["unreviewed"]);
    expect(out.states.records.get("clm-stateunread001")).toEqual(["unreviewed"]);
    expect(entity(out, marked.id)).not.toHaveProperty("stemmaStates");
  });

  test("open findings and applying annotations come only from checks the data identity covers", () => {
    const directory = fixture("cited");
    const corpus = loadCorpus(readProject(directory));
    const body = runChecks(corpus, {}).body;
    const target = body.results.find((r) => r.check === "source.held" && r.open)!;
    const note = planAnnotation(corpus, body.results, { finding: target.finding_key, effect: "explain", reason: "seeded", actor: { kind: "person", name: "P" }, now: new Date(AT), token: randomToken });
    const content = readProject(directory);
    content.records.push({ path: note.path, bytes: text(note.text) });
    const out = make(loadCorpus(content));
    expect(out.states.records.get(target.subject)).toEqual(["annotated", "open_finding"]);
    expect(out.manifest.states.checks).toContain("source.held");
    for (const check of ["project.binary", "coordinate.stray", "source.original", "meta.source", "meta.resolver", "id.resolves"]) {
      expect(out.manifest.states.checks).not.toContain(check);
      expect(out.manifest.states.checks_left_out.map((c) => c.check)).toContain(check);
    }
  });
});

describe("data identity and staleness", () => {
  const manuscript = (value: string) => project([], { manuscript: [{ path: "manuscript/one.md", bytes: text(value) }] });

  test("changes with a manuscript edit and not with a research note", () => {
    const one = dataIdentity(loadCorpus(manuscript("one")));
    expect(dataIdentity(loadCorpus(manuscript("two"))).data_identity).not.toBe(one.data_identity);
    expect(dataIdentity(loadCorpus(manuscript("two"))).corpus_digest).toBe(one.corpus_digest);
    const noted = { ...manuscript("one"), research: [{ path: "research/a.md", bytes: text("# A") }] };
    expect(dataIdentity(loadCorpus(noted))).toEqual(one);
  });

  test("an export is stale when the data, the exporter or a file differs", () => {
    const corpus = loadCorpus(manuscript("one"));
    const out = make(corpus);
    const read = (change = "") => (name: string) => text(file(out, name) + (name === change ? " " : ""));
    const status = (c: Corpus, version = VERSION, change = "") => exportStaleness(file(out, MANIFEST), dataIdentity(c), version, read(change));
    expect(status(corpus)).toEqual({ fresh: true, reasons: [], files: [] });
    expect(status(loadCorpus(manuscript("two"))).reasons).toEqual(["data_changed"]);
    expect(status(corpus, "9.9.10").reasons).toEqual(["exporter_changed"]);
    expect(status(corpus, VERSION, "stemma.graph.json")).toEqual({ fresh: false, reasons: ["file_changed"], files: ["stemma.graph.json"] });
    expect(exportStaleness("{", dataIdentity(corpus), VERSION, read()).reasons).toEqual(["manifest_unreadable"]);
    expect(exportStaleness(file(out, MANIFEST), dataIdentity(corpus), VERSION, () => undefined).reasons).toEqual(["file_missing"]);
  });
});

// What the explorer relies on in the pinned arras (CONTRACT-005 F and G), on
// small hand-written modules. An arras upgrade reruns this. The build spike also
// drove these in a browser from a local file.
import { describe, expect, test } from "bun:test";
import { createStaticClient, loadStore } from "@documentdrivendx/arras-ui/static";

interface Shape { types: number; spare?: number; viewPadding?: number }

function moduleText({ types, viewPadding = 0 }: Shape): string {
  const names = Array.from({ length: types }, (_, i) => `Kind${i}`);
  const elements = names.flatMap((type) => [
    {
      id: type, kind: "record", name: type, members: ["recordId", "searchText"].map((f) => ({ module: "m", element: `${type}.${f}` })),
      extensions: {
        "umf.ddd": {
          kind: "entity", identity: { fields: ["recordId"], scope: "context" },
          fields: { recordId: { type: { kind: "scalar", name: "string" }, cardinality: "one" }, searchText: { type: { kind: "scalar", name: "string" }, cardinality: "optional" } },
        },
        "arras.view": { title: "{searchText}", search: ["searchText"] },
      },
      keys: [{ id: "identity", name: "Identity", primary: true, fields: [{ module: "m", element: `${type}.recordId` }] }],
    },
    ...["recordId", "searchText"].map((f) => ({
      id: `${type}.${f}`, kind: "field", name: f, nullability: f === "recordId" ? "required" : "absent-allowed", cardinality: "one", scalarType: "string", extensions: {},
    })),
  ]);
  const relationships = Array.from({ length: Math.ceil(viewPadding / 100) }, (_, i) => ({
    id: `link${i}`, name: `link${i}`, source: [{ module: "m", element: "Kind0" }], target: [{ module: "m", element: "Kind0", key: "identity" }],
    sourceMultiplicity: { min: 0, max: "*" }, targetMultiplicity: { min: 0, max: "*" }, targetLifecycle: "independent", directed: true, inverse: `link${i}Inverse`,
    extensions: { "arras.view": { label: "x".repeat(60), hideWhenEmpty: true } },
  }));
  return JSON.stringify({
    umf: "0.10.0", id: "m", vocabularies: { "umf.ddd": { version: "0.1.0" }, "arras.view": { version: "0.1.0" } }, extensions: {},
    modules: [{ id: "m", namespace: "m", extensions: { "umf.ddd": { kind: "bounded-context", terms: [] }, "arras.view": { title: "T" } }, elements, relationships }],
  });
}

const entity = (type: string, key: string, text: string) => ({ type, key, properties: { recordId: key, searchText: text } });
const graphText = (records: object[], format = "arras.graph") => JSON.stringify({ format, version: 1, module: "m", complete: true, records });

const SEARCH = "query($text: String!) { _search(text: $text, limit: 50) { hits { type key } notSearched { type reason } } }";

async function search(types: number, text: string, records: object[]) {
  const store = await loadStore(moduleText({ types }), graphText(records));
  const answer = await createStaticClient(store).moduleQuery("m", SEARCH, { text });
  return (answer.data as { _search: { hits: { type: string }[]; notSearched: { type: string; reason: string }[] } })._search;
}

describe("the pinned arras static profile", () => {
  test("loads a module and graph made together, and only the graph format it names", async () => {
    const store = await loadStore(moduleText({ types: 1 }), graphText([entity("Kind0", "a", "x")]));
    expect(store.get("Kind0", "a")?.props.searchText).toBe("x");
    expect(loadStore(moduleText({ types: 1 }), graphText([], "arras.graph/1"))).rejects.toThrow("format");
  });

  test("one bad record fails the whole load", () => {
    expect(loadStore(moduleText({ types: 1 }), graphText([entity("Kind0", "a", "x"), entity("Nothing", "b", "y")]))).rejects.toThrow("cannot be loaded");
  });

  test("a query searches only the first 20 searchable types, and says so for the rest", async () => {
    const found = await search(22, "zebra", [entity("Kind19", "a", "zebra"), entity("Kind21", "b", "zebra")]);
    expect(found.hits.map((h) => h.type)).toEqual(["Kind19"]);
    expect(found.notSearched).toEqual([{ type: "Kind20", reason: "over_budget" }, { type: "Kind21", reason: "over_budget" }]);
  });

  test("search lowers case and removes no diacritic", async () => {
    const records = [entity("Kind0", "a", "Ḥusayn")];
    expect((await search(1, "ḥusayn", records)).hits).toHaveLength(1);
    expect((await search(1, "husayn", records)).hits).toHaveLength(0);
  });

  test("a relationship field returns at most 100 keys, and a query selects at most 50 fields", async () => {
    const records = [
      ...Array.from({ length: 150 }, (_, i) => entity("Kind0", `k${String(i).padStart(3, "0")}`, "x")),
      ...Array.from({ length: 149 }, (_, i) => ({ relationship: "link0", source: "k000", target: `k${String(i + 1).padStart(3, "0")}` })),
    ];
    const client = createStaticClient(await loadStore(moduleText({ types: 1, viewPadding: 1 }), graphText(records)));
    const one = await client.moduleQuery("m", "query { kind0(key: \"k000\") { link0 { key } } }", {});
    expect((one.data as { kind0: { link0: object[] } }).kind0.link0).toHaveLength(100);
    const wide = await client.moduleQuery("m", `query { kind0(key: "k000") { ${Array.from({ length: 51 }, (_, i) => `f${i}: key`).join(" ")} } }`, {});
    expect(wide.errors.map((e) => e.code)).toEqual(["COST_EXCEEDED"]);
  });

  test("all view terms of a document are at most 128 KiB", () => {
    expect(loadStore(moduleText({ types: 1, viewPadding: 150_000 }), graphText([]))).rejects.toThrow("128 KiB");
  });
});

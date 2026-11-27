// The served explorer's search (CONTRACT-005 M, "Search"; US-120-AC1, AC2, AC5
// to AC7): complete and ranked as a brute-force scan says, every page, every
// type, mixed scripts, and bounded.
import { describe, expect, test } from "bun:test";
import { createStaticClient, loadStore } from "@documentdrivendx/arras-ui/static";
import { type Served, servedData } from "@stemma/graph";
import { loadCorpus, searchFold } from "@stemma/records";
import { answersOf, ARRAS_SEARCH_QUERY, createSearch, excerptOf, MOST_ANSWER_BYTES, queryOf, SEARCH_LIMITS } from "@stemma/server";
import { syntheticProject } from "../scripts/synthetic-project.ts";
import { BROWSER_QUERY, scan } from "./search-oracle.ts";

let made: { served: Served } | undefined;
function synthetic(): Served {
  made ??= (() => {
    const files = syntheticProject({ sources: 150, pages: [[2, 4], [5, 8]], unmatched: 10 });
    const file = (path: string) => ({ path, bytes: new TextEncoder().encode(files.get(path)!) });
    const under = (directory: string) => [...files.keys()].filter((path) => path.startsWith(`${directory}/`)).sort().map(file);
    const content = { settings: file("stemma.json"), records: under("records"), sources: under("sources"), manuscript: [], research: [] };
    return { served: servedData(loadCorpus(content), { version: "test" }) };
  })();
  return made.served;
}

type Search = ReturnType<typeof createSearch>;
/** Every page of a search, and what each page said. */
function everyPage(search: Search, sent: string, type: string | undefined, size: number) {
  const query = queryOf(sent)!;
  const keys: string[] = [];
  const first = search.page(query, type, 0, size);
  for (let offset = 0; offset < Math.max(1, first.total); offset += size) {
    const page = offset === 0 ? first : search.page(query, type, offset, size);
    expect([page.total, page.all]).toEqual([first.total, first.all]);
    expect(page.hits.length).toBe(Math.min(size, first.total - offset));
    expect(page.hits.map((h) => h.rank)).toEqual(page.hits.map((_, i) => offset + i + 1));
    keys.push(...page.hits.map((h) => `${h.type} ${h.key}`));
  }
  expect(search.page(query, type, first.total, size).hits).toEqual([]);
  return { keys, first };
}

describe("US-120 the served data's search", () => {
  test("AC1: every entry of every type has search text, the one arras searches where arras searches", () => {
    const served = synthetic();
    const graph = (JSON.parse(served.graphText) as { records: { type?: string; key: string; properties: Record<string, unknown> }[] }).records.filter((r) => r.type);
    expect(served.search.entries.map((e) => `${e.type} ${e.key}`)).toEqual(graph.map((r) => `${r.type} ${r.key}`));
    expect(served.search.types.length).toBe(new Set(graph.map((r) => r.type)).size);
    const listed = new Set(
      (JSON.parse(served.moduleText) as { modules: { elements: { id: string; extensions: { "arras.view"?: { search?: string[] } } }[] }[] }).modules[0]!.elements
        .filter((e) => (e.extensions["arras.view"]?.search?.length ?? 0) > 0).map((e) => e.id));
    for (const [i, record] of graph.entries()) {
      const { text, label } = served.search.entries[i]!;
      expect(label).toBe(String(record.properties.heading));
      expect(text.startsWith(searchFold(label))).toBe(true);
      if (listed.has(record.type!)) expect(text).toBe(String(record.properties.searchText));
    }
    // Types arras does not search are searched by their records' own words.
    const search = createSearch(served.search);
    for (const [type, property] of [["Upstream", "url"], ["Resolution", "recordQuery"], ["ComparisonRun", "against"], ["TextReview", "against"], ["Contribution", "heading"]] as const) {
      expect(listed.has(type)).toBe(false);
      const record = graph.find((r) => r.type === type)!;
      const value = String(record.properties[property]);
      const query = queryOf(value.slice(0, 150).split(" ").slice(0, 8).join(" "))!;
      const found = everyPage(search, query.text, type, 200).keys;
      expect([type, found.includes(`${type} ${record.key}`)]).toEqual([type, true]);
    }
    // Every type is reached by a record's ID, which puts that record first.
    for (const { type } of served.search.types) {
      const record = graph.find((r) => r.type === type)!;
      expect([type, search.page(queryOf(record.key.toUpperCase())!, type, 0, 1).hits[0]?.key]).toEqual([type, record.key]);
    }
  }, 60_000);

  test("AC1, AC2: many queries give the matches, counts and order of a brute-force scan, and every match once over its pages", () => {
    const { search: data } = synthetic();
    const search = createSearch(data);
    const types = data.types.map((t) => t.type);
    let seed = 7;
    const random = (n: number) => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 1) % n;
    const queries = ["a", "the", "of the", "ka", "karo", "KARO  mi", "Karó", "東京", "東京の", "𝒜", "café", "can't", "fine", "syn1", "10.5555/synthetic.1", "no such words here", "-", "\"", "*", "(", "reading ka", "a e i o u r s t"];
    for (let i = 0; i < 150; i++) {
      const text = Array.from(data.entries[random(data.entries.length)]!.text);
      const cut = () => {
        const from = random(text.length);
        return text.slice(from, from + 1 + random(12)).join("").trim().split(/\s+/)[0]!;
      };
      queries.push(Array.from({ length: 1 + random(3) }, cut).join(" "));
    }
    queries.push(...data.entries.filter((_, i) => i % 97 === 0).map((e) => e.key));
    let compared = 0;
    for (const [i, sent] of queries.entries()) {
      if (!queryOf(sent)) continue;
      const expected = scan(data.entries, sent, types);
      // All pages for all types, at a size that changes, so that pages break in many places.
      const { keys, first } = everyPage(search, sent, undefined, expected.keys.length > 2000 ? SEARCH_LIMITS.page : [1, 7, 50, 200][i % 4]!);
      if (keys.join() !== expected.keys.join()) expect({ sent, keys }).toEqual({ sent, keys: expected.keys });
      expect(new Set(keys).size).toBe(keys.length);
      expect(Object.fromEntries(first.counts.map((c) => [c.type, c.count]))).toEqual(Object.fromEntries(expected.counts));
      const narrowed = types[i % types.length]!;
      const one = search.page(queryOf(sent)!, narrowed, 0, 200);
      expect(one.total).toBe(expected.counts.get(narrowed) ?? 0);
      expect(one.hits.map((h) => `${h.type} ${h.key}`)).toEqual(expected.keys.filter((k) => k.startsWith(`${narrowed} `)).slice(0, 200));
      expect(one.all).toBe(expected.keys.length);
      compared++;
    }
    expect(compared).toBeGreaterThan(150);
  }, 120_000);

  test("AC1: whatever arras's own search finds, this finds", async () => {
    const served = synthetic();
    const arras = createStaticClient(await loadStore(served.moduleText, served.graphText), served.moduleText);
    const search = createSearch(served.search);
    for (const sent of ["karo", "the of", "syn1", "東京の", "reading"]) {
      const answer = await arras.moduleQuery("stemma", "query($t: String!) { _search(text: $t, limit: 50) { hits { type key } } }", { t: sent });
      const all = new Set(everyPage(search, sent, undefined, 200).keys);
      for (const hit of (answer.data as { _search: { hits: { type: string; key: string }[] } })._search.hits) expect(all.has(`${hit.type} ${hit.key}`)).toBe(true);
    }
  }, 60_000);
});

describe("US-120-AC5 scripts, short words and odd characters", () => {
  const titles = [
    "Ḥusayn ʿAbd al-Raḥmān", "Ἀριστοτέλης περὶ ψυχῆς: ΣΟΦΟΣ σοφός", "الْعَرَبِيَّةُ كِتَابٌ مُحَمَّد", "東京の図書館で本を読む", "ภาษาไทยไม่มีช่องว่าง", "漢 字",
    "a\u0000hidden zebra", "lone \ud800 surrogate", "𝒜ka naïve café STRASSE Straße İstanbul", "quote \" and * - OR NEAR( ) ' %_",
  ];
  const data = {
    types: [{ type: "Source", label: "Source" }],
    entries: titles.map((label, i) => ({ type: "Source", key: `src-${i}`, label, text: searchFold(label) })),
  };
  const search = createSearch(data);

  test("every substring of every text, of one to six characters, finds what a scan finds", () => {
    let checked = 0;
    for (const { text } of data.entries) {
      const points = Array.from(text);
      for (let length = 1; length <= 6; length++) {
        for (let at = 0; at + length <= points.length; at++) {
          const sent = points.slice(at, at + length).join("");
          if (!queryOf(sent)) continue;
          expect([sent, everyPage(search, sent, undefined, 3).keys]).toEqual([sent, scan(data.entries, sent, ["Source"]).keys]);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(500);
  });

  test.each([
    ["husayn", "src-0"], ["Ḥusayn", "src-0"], ["αριστοτελης ψυχης", "src-1"], ["σοφοσ", "src-1"], ["العربية كتاب", "src-2"], ["عربي", "src-2"],
    ["図書館", "src-3"], ["本", "src-3"], ["東京 読む", "src-3"], ["ไทย", "src-4"], ["漢", "src-5"], ["zebra", "src-6"], ["istanbul strasse", "src-8"],
  ])("%s finds %s", (sent, key) => {
    expect(everyPage(search, sent, undefined, 10).keys).toContain(`Source ${key}`);
  });

  test("without word spaces a run must occur unbroken; spaced runs must each occur", () => {
    expect(search.page(queryOf("東京図書館")!, undefined, 0, 10).total).toBe(0);
    expect(search.page(queryOf("東京 図書館")!, undefined, 0, 10).total).toBe(1);
  });

  test("an excerpt is a run of the search text, with each match marked, and cuts no character", () => {
    const long = `${"𝒜 ".repeat(120)}needle ${"𝒜".repeat(90)} needle tail`;
    for (const words of [["needle"], ["needle", "tail"], ["𝒜"], ["x".repeat(200)], ["𝒜".repeat(90)]]) {
      const parts = excerptOf(long, words, 3);
      const shown = parts.map((p) => p.text).join("").replace(/^…|…$/g, "");
      expect(long).toContain(shown);
      expect(Array.from(shown).length).toBeLessThanOrEqual(160);
      expect(shown.isWellFormed()).toBe(true);
      for (const part of parts) expect(part.text.isWellFormed()).toBe(true);
    }
    expect(excerptOf("needle and needle", ["needle"], 0).filter((p) => p.mark).map((p) => p.text)).toEqual(["needle", "needle"]);
  });

  test("the ranking puts the heading first, and a word's start before its middle", () => {
    const ranked = createSearch({
      types: [{ type: "A", label: "A" }, { type: "B", label: "B" }],
      entries: [
        { type: "A", key: "a1", label: "other", text: "other subreef" }, { type: "A", key: "a2", label: "other", text: "other reef" },
        { type: "A", key: "a3", label: "subreef", text: "subreef" }, { type: "B", key: "b1", label: "reef", text: "reef" }, { type: "B", key: "reef", label: "x", text: "x" },
      ],
    });
    expect(ranked.page(queryOf("reef")!, undefined, 0, 10).hits.map((h) => h.key)).toEqual(["reef", "b1", "a3", "a2", "a1"]);
  });
});

describe("US-120-AC6 bounds", () => {
  const ask = async (mostBytes?: number) => {
    const served = synthetic();
    const answer = await answersOf(served, mostBytes);
    return async (route: string, body: unknown) => {
      const got = await answer(route, body);
      return { status: got.status, bytes: Buffer.byteLength(got.body), json: JSON.parse(got.body) as Record<string, any> };
    };
  };
  const page = { text: "ka", offset: 0, limit: 200 };

  test("the text, words, limit, offset, type and fields of a search are bounded", async () => {
    const call = await ask();
    const bad: unknown[] = [
      {}, { text: "ka" }, { ...page, limit: 0 }, { ...page, limit: 201 }, { ...page, limit: 1.5 }, { ...page, limit: "50" }, { ...page, offset: -1 }, { ...page, offset: 1e300 },
      { ...page, type: "Nothing" }, { ...page, type: null }, { ...page, type: ["Source"] }, { ...page, extra: 1 }, { ...page, text: 1 }, { ...page, text: "" }, { ...page, text: "   " },
      { ...page, text: "a".repeat(201) }, { ...page, text: "𝒜".repeat(201) }, { ...page, text: "a ".repeat(17) }, { ...page, text: "́" }, [page], "ka",
    ];
    for (const body of bad) expect([body, (await call("search", body)).status]).toEqual([body, 400]);
    for (const body of [{ ...page, text: "a".repeat(200) }, { ...page, text: "𝒜".repeat(200) }, { ...page, text: "a ".repeat(16) }, { ...page, offset: Number.MAX_SAFE_INTEGER }, { ...page, text: "ﷺ".repeat(11) }]) {
      expect([body.text.slice(0, 8), (await call("search", body)).status]).toEqual([body.text.slice(0, 8), body.text.startsWith("ﷺ") ? 400 : 200]);
    }
  }, 60_000);

  test("the broadest search at the largest page stays far under the answer bound", async () => {
    const call = await ask();
    const got = await call("search", { ...page, text: "a" });
    expect(got.json.result.total).toBeGreaterThan(1000);
    expect(got.json.result.hits).toHaveLength(200);
    expect(got.bytes).toBeLessThan(200 * 4096);
    const arras = await call("query", { module: "stemma", query: BROWSER_QUERY, variables: { text: "ka", types: null, limit: SEARCH_LIMITS.arrasPage } });
    expect(arras.json.result.data._search.hits).toHaveLength(500);
    expect(arras.bytes).toBeLessThan(500 * 4096);
  }, 60_000);

  test("an answer past the bound is refused, whichever call made it", async () => {
    const call = await ask(2000);
    expect(MOST_ANSWER_BYTES).toBe(8 * 1024 * 1024);
    for (const [route, body] of [["search", page], ["query", { module: "stemma", query: "query { sourceList(limit: 100) { items { key heading } } }" }], ["arras", { call: "meta" }]] as const) {
      const got = await call(route, body);
      expect([route, got.status, got.json.error?.code]).toEqual([route, 422, "answer_too_large"]);
      expect(got.bytes).toBeLessThan(2000);
    }
  }, 60_000);

  test("arras's search query is answered in its shape, with true counts of every type, and says when it lists fewer than matched", async () => {
    expect(ARRAS_SEARCH_QUERY.test(BROWSER_QUERY)).toBe(true);
    const served = synthetic();
    const call = await ask();
    const types = served.search.types.map((t) => t.type);
    const expected = scan(served.search.entries, "ka", types);
    const got = (await call("query", { module: "stemma", query: BROWSER_QUERY, variables: { text: "ka", types: null, limit: 200 } })).json.result;
    expect(got.errors).toEqual([]);
    const found = got.data._search;
    expect(found.hits.map((h: { type: string; key: string }) => `${h.type} ${h.key}`)).toEqual(expected.keys.slice(0, 200));
    expect(found.counts).toEqual(types.map((type) => ({ type, count: expected.counts.get(type) ?? 0, atLeast: false })));
    expect(found.text).toBe(`ka (the best 200 of ${expected.keys.length.toLocaleString("en-US")} matches are listed; the Search view lists all of them)`);
    expect([found.truncated, found.notSearched, found.freshness.length]).toEqual([false, [], 1]);
    const few = (await call("query", { module: "stemma", query: BROWSER_QUERY, variables: { text: served.search.entries[0]!.key, types: ["Source"], limit: 200 } })).json.result.data._search;
    expect(few.text).toBe(served.search.entries[0]!.key);
    expect(few.counts.map((c: { type: string }) => c.type)).toEqual(["Source"]);
    // What arras itself would not accept gets arras's own words for it.
    const arras = createStaticClient(await loadStore(served.moduleText, served.graphText), served.moduleText);
    for (const text of ["x", "a b c d e f g", "y".repeat(201)]) {
      const mine = (await call("query", { module: "stemma", query: BROWSER_QUERY, variables: { text, types: null, limit: 200 } })).json.result;
      const theirs = await arras.moduleQuery("stemma", BROWSER_QUERY, { text, types: null, limit: 50 });
      expect(mine.errors.map((e: { message: string }) => e.message)).toEqual(theirs.errors.map((e) => e.message));
      expect(mine.errors.length).toBeGreaterThan(0);
    }
    for (const variables of [{ text: "ka", limit: 501 }, { text: "ka", limit: 0 }, { text: "ka", types: ["Nothing"] }, { text: 1 }, { text: "ka", more: 1 }]) {
      expect([variables, (await call("query", { module: "stemma", query: BROWSER_QUERY, variables })).status]).toEqual([variables, 400]);
    }
    // Padding does not push a search arras accepts into arras's limited one.
    const padded = (await call("query", { module: "stemma", query: BROWSER_QUERY, variables: { text: `${" ".repeat(450)}ka`, types: null, limit: 200 } })).json.result.data._search;
    expect([padded.hits, padded.counts]).toEqual([found.hits, found.counts]);
    // No other query reaches arras's search.
    for (const query of ["query { _search(text: \"ka\") { truncated } }", "query { a: _search(text: \"ka\") { truncated } }", `${BROWSER_QUERY} `, BROWSER_QUERY.replace("limit: $limit", "limit: 50")]) {
      expect((await call("query", { module: "stemma", query, variables: { text: "ka" } })).json.error?.code).toBe("unsupported_search");
    }
  }, 60_000);
});

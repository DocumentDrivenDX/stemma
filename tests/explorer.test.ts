// The built explorer page, opened from a local file in headless Chromium
// (US-090, US-094). Fetch the browser with ./scripts/dev.sh browsers; without
// it these tests are skipped, and say so.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { type Browser, chromium, type Page } from "@playwright/test";
import { exportGraph, type Export } from "@stemma/graph";
import { loadCorpus, normalizeSentence, searchFold, sha256 } from "@stemma/records";
import { bundleHost, explorerLicenses } from "../packages/explorer/build.ts";
import { writeExplorer } from "../scripts/build.ts";
import { everyShape, fixtureId } from "./graph-fixture.ts";
import { ROOT, temporary } from "./helpers.ts";

let browser: Browser | undefined;
try {
  browser = await chromium.launch();
} catch (error) {
  if (!String(error).includes("Executable doesn't exist")) throw error;
  console.warn("SKIPPED the explorer browser tests: headless Chromium is not fetched (./scripts/dev.sh browsers).");
}
afterAll(async () => browser?.close());

test("US-094-AC1, US-090-AC6 the explorer Stemma wrote is TypeScript, bundled with the arras graph browser", async () => {
  const written = [...new Bun.Glob("**/*").scanSync(join(ROOT, "packages/explorer/src"))].sort();
  expect(written.filter((file) => !/\.(tsx?|css)$/.test(file))).toEqual([]);
  expect(readFileSync(join(ROOT, "packages/explorer/src/host.tsx"), "utf8")).toContain('import { GraphBrowser } from "@documentdrivendx/arras-ui/browser";');
  const { inputs } = await bundleHost();
  expect(inputs.some((path) => /arras-ui\/dist\/browser\.js$/.test(path))).toBe(true);
  // Of arras, only the browser and the static client and what they load.
  expect(inputs.filter((path) => /arras-ui\/dist\/(index|shell|testkit|ArrasConsole)/.test(path))).toEqual([]);
});

test("every package whose code is in the page ships its license", async () => {
  const inputs = (await bundleHost()).inputs;
  const bundled = [...new Set(inputs.flatMap((path) => /.*node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(path)?.[1] ?? []))].sort();
  expect(bundled).toEqual(["@documentdrivendx/arras-ui", "@tanstack/query-core", "@tanstack/react-query", "react", "react-dom", "scheduler"]);
  const licenses = explorerLicenses();
  expect(Object.keys(licenses).sort()).toEqual(["arras-ui.md", "graphql.txt", "react-dom.txt", "react.txt", "scheduler.txt", "tailwindcss.txt", "tanstack-query-core.txt", "tanstack-react-query.txt"]);
  for (const text of Object.values(licenses)) expect(text).toMatch(/MIT License|Permission is hereby granted/);
});

const HOSTILE = "</script><script>window.__ran=1</script><img src=x onerror=\"window.__ran=2\"> [a](https://example.invalid/m) **b** $&";
const OUTSIDE = "https://example.invalid/outside";
const AT = "2026-01-05T09:00:00Z";
const HUB = 150;

describe.skipIf(!browser)("the explorer page from a local file", () => {
  let template = "";
  let out: Export;
  let page: Page;
  let url = "";
  const outside: string[] = [];
  const errors: string[] = [];
  const dialogs: string[] = [];

  const open = async (name: string, text: string) => {
    const path = join(temporary(), name);
    writeFileSync(path, text);
    return pathToFileURL(path).href;
  };
  const main = () => page.getByRole("main");
  const settled = async (heading: string | RegExp) => main().getByRole("heading", { level: 1, name: heading }).waitFor();
  const visit = async (type: string, key: string) => page.goto(`${url}#/explore/stemma/${type}/${key}`);
  /** Searches from a fresh load, and waits for the answer to these words and no earlier one. */
  const search = async (words: string) => {
    await page.goto("about:blank");
    await page.goto(`${url}#/explore/stemma`);
    const box = page.getByRole("textbox", { name: /Search/ });
    await box.fill(words);
    await box.press("Enter");
    await page.waitForFunction((query) => document.querySelector("main")?.textContent?.includes(query), searchFold(words));
  };
  /** Follows the link to a record from the relationship lists of the open record. */
  const follow = async (key: string) => page.getByRole("complementary").getByRole("listitem").getByRole("link").filter({ hasText: key }).first().click();
  const at = (type: string, key: string) => page.waitForURL((u) => u.hash === `#/explore/stemma/${type}/${key}`);

  beforeAll(async () => {
    const dist = temporary();
    await writeExplorer(dist);
    template = readFileSync(join(dist, "explorer.template.html"), "utf8");
    const hub = Array.from({ length: HUB }, (_, i) => {
      const sentence = normalizeSentence(`Hub sentence ${i}.`);
      return { schema: "stemma.record/0", id: `cit-hubcitation${String(i).padStart(4, "0")}`, kind: "citation", created: { at: AT, by: { kind: "person", name: "P" } }, intake: "parsed", passage: fixtureId("passage"), sentence: { text: sentence, sha256: sha256(sentence) } };
    });
    const corpus = loadCorpus(everyShape({
      extra: hub,
      change: (record) => {
        if (record.kind === "agent") record.name = { family: "Ḥusayn", given: "Taha" };
        if (record.kind === "claim") record.text = "Old irrigation channels fed the terraces";
        if (record.kind === "note") record.body = HOSTILE;
        if (record.kind === "upstream") record.url = OUTSIDE;
        if (record.kind === "plan") record.body = "zebrafinch is only in the last searched type";
      },
    }));
    out = exportGraph(corpus, { version: "9.9.9-test", template });
    url = await open("explorer.html", out.files.find((f) => f.name === "explorer.html")!.text);
    const context = await browser!.newContext({ offline: true });
    page = await context.newPage();
    page.on("request", (request) => {
      if (!/^(file|data):/.test(request.url())) outside.push(request.url());
    });
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("dialog", (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });
    await page.goto(url);
    await page.getByRole("textbox", { name: /Search/ }).waitFor();
  }, 60_000);

  test("the template holds no path from the machine that built it, and builds to the same bytes", async () => {
    expect(template).not.toContain(ROOT);
    const again = temporary();
    await writeExplorer(again);
    expect(readFileSync(join(again, "explorer.template.html"), "utf8")).toBe(template);
  }, 60_000);

  test("the page holds the exported module and graph byte for byte, under a policy that denies connections", async () => {
    for (const [id, name] of [["stemma-module", "stemma.umf.json"], ["stemma-graph", "stemma.graph.json"]]) {
      const inline = await page.evaluate((element) => document.getElementById(element)!.textContent!, id!);
      expect(sha256(inline)).toBe(out.manifest.files[name!]!);
    }
    const policy = await page.locator("meta[http-equiv='Content-Security-Policy']").getAttribute("content");
    for (const part of ["default-src 'none'", "script-src 'sha256-", "connect-src 'none'", "form-action 'none'", "base-uri 'none'"]) expect(policy).toContain(part);
    expect(policy).not.toContain("unsafe-eval");
    expect(await page.evaluate(() => fetch("https://example.invalid/").then(() => "sent", () => "refused"))).toBe("refused");
    // The refusal the policy logs for that probe is the test's own.
    errors.length = 0;
    outside.length = 0;
  });

  test("US-090-AC4, AC5 the banner names the data, what is not shown, and what a support result is", async () => {
    const banner = page.getByRole("region", { name: "About this export" });
    expect(await banner.getByTestId("data-identity").innerText()).toBe(out.manifest.data_identity.slice(0, 12));
    const text = await banner.innerText();
    expect(text).toContain("fixtureshapes");
    expect(text).toContain("Support results are recorded model judgments, not verification.");
    expect(text).toContain("support_missing, support_stale, support_unsupported");
    expect(text).toContain("A record with no state has not been shown to be clear.");
    await banner.getByText("Details: omissions").click();
    expect(await banner.innerText()).toContain("when this page was opened, not when the data was exported");
  });

  test("US-090-AC2, AC3 a name stored with diacritics is found without them, and with them", async () => {
    for (const words of ["husayn", "Ḥusayn", "HUSAYN taha"]) {
      await search(words);
      await main().getByRole("link", { name: /^Agent / }).first().waitFor();
      expect(await main().getByRole("link", { name: /^Source / }).count()).toBeGreaterThan(0);
    }
    await search("irrigation");
    await main().getByRole("link", { name: /Old irrigation channels/ }).first().click();
    await settled(/Old irrigation channels/);
  });

  test("a match in the last of the twenty searched types is listed", async () => {
    await search("zebrafinch");
    await main().getByRole("link", { name: /^Plan / }).first().waitFor();
  });

  test("a search with no match says so", async () => {
    await search("qqqqzzzz");
    console.log("no match:", (await main().innerText()).split("\n").filter((line) => /qqqqzzzz/.test(line)).join(" | "));
    expect(await main().innerText()).toMatch(/no(thing)? (record )?match|No result/i);
    expect(await main().getByRole("link", { name: /^(Source|Claim|Plan) / }).count()).toBe(0);
  });

  test("US-090-AC1, US-094-AC2 links are followed both ways, from source to note to claim and back", async () => {
    const [source, note, attestation, claim] = [fixtureId("source"), fixtureId("note"), fixtureId("attestation", 0), fixtureId("claim")];
    await search("husayn");
    await main().getByRole("link", { name: /^Source / }).first().click();
    await page.waitForURL(/\/Source\//);
    await visit("Source", source);
    await follow(note);
    await at("Note", note);
    await follow(attestation);
    await at("Attestation", attestation);
    await follow(claim);
    await at("Claim", claim);
    // And the other way along the same links.
    await follow(attestation);
    await at("Attestation", attestation);
    await follow(note);
    await at("Note", note);
    await follow(source);
    await at("Source", source);
    await page.goBack();
    await at("Note", note);
    await page.goBack();
    await at("Attestation", attestation);
    await page.reload();
    await at("Attestation", attestation);
    await settled(/./);
  }, 60_000);

  test("US-090 every link of a record with more than 100 stays reachable", async () => {
    await visit("Passage", fixtureId("passage"));
    const list = page.getByRole("complementary").getByRole("region").filter({ has: page.getByRole("heading", { name: /by its passage/i }) })
      .filter({ hasText: "cit-hubcitation" }).last();
    await list.waitFor();
    for (let i = 0; i < 20 && (await list.getByRole("button", { name: /Show more/ }).count()) > 0; i++) {
      const before = await list.getByRole("link").count();
      await list.getByRole("button", { name: /Show more/ }).first().click();
      await page.waitForFunction(([n]) => document.querySelectorAll("aside a, [role=complementary] a").length > n!, [before]);
    }
    await page.waitForTimeout(500);
    const links = await list.getByRole("link").evaluateAll((found) => found.map((a) => a.getAttribute("href")!));
    expect(new Set(links.filter((href) => href.includes("cit-hubcitation"))).size).toBe(HUB);
  }, 60_000);

  test("US-090-AC1 a record of every type opens", async () => {
    const records = JSON.parse(out.files.find((f) => f.name === "stemma.graph.json")!.text).records as { type?: string; key?: string }[];
    const one = new Map(records.filter((r) => r.type).map((r) => [r.type!, r.key!]));
    expect(one.size).toBe(out.projection.types.length);
    for (const [type, key] of one) {
      await visit(type, key);
      const heading = out.projection.entities.find((e) => e.type === type && e.key === key)!.properties.heading as string;
      await main().getByRole("heading", { level: 1, name: heading, exact: true }).waitFor({ timeout: 10_000 });
      await main().getByRole("article").getByText(key, { exact: true }).first().waitFor({ timeout: 10_000 });
    }
  }, 120_000);

  test("US-090-AC4 a record with a state shows it", async () => {
    const [id, states] = [...out.states.records].find(([key, found]) => key.startsWith("clm-") && found.includes("unreviewed"))!;
    await visit("Claim", id);
    await settled(/./);
    const article = await main().getByRole("article").innerText();
    expect(article).toContain("Stemma states");
    for (const state of states) expect(article).toContain(state);
  });

  test("US-090-AC5 a support record is shown as a recorded model judgment", async () => {
    await visit("SupportRecord", fixtureId("support_record"));
    await settled(/^Model judgment:/);
    const article = await main().getByRole("article").innerText();
    expect(article).toMatch(/Support record \(model judgment\)/i);
    expect(article).toContain("A recorded model judgment, not verification.");
    expect(article).toMatch(/Model verdict/i);
  });

  test("US-094-AC4 markup and script in a record are text, and nothing runs or links out", async () => {
    await visit("Note", fixtureId("note"));
    await settled(/./);
    expect(await main().getByRole("article").innerText()).toContain(HOSTILE);
    expect(await main().locator("img, script, strong a").count()).toBe(0);
    await visit("Upstream", fixtureId("upstream"));
    await settled(/./);
    expect(await main().getByRole("article").innerText()).toContain(OUTSIDE);
    expect(await page.locator("a[href^='http']").count()).toBe(0);
    expect(await page.evaluate(() => (window as unknown as { __ran?: number }).__ran)).toBeUndefined();
    expect(dialogs).toEqual([]);
  });

  test("US-094-AC3 using the explorer sent no request and logged no error", () => {
    expect(outside).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("accessibility: Stemma's own part has no violation, and what axe reports in arras is listed", async () => {
    await visit("Source", fixtureId("source"));
    await settled(/./);
    const mine = await new AxeBuilder({ page }).include("[aria-label='About this export']").analyze();
    expect(mine.violations).toEqual([]);
    const places = [["home", `${url}#/explore/stemma`], ["list", `${url}#/explore/stemma/Source`], ["record", `${url}#/explore/stemma/Source/${fixtureId("source")}`]];
    for (const [name, address] of places) {
      await page.goto(address!);
      await page.waitForTimeout(500);
      const all = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      console.log(`axe, arras ${name} view: ${all.violations.length === 0 ? "no violation" : all.violations.map((v) => `${v.id} (${v.impact}, ${v.nodes.length})`).join(", ")}`);
    }
  }, 60_000);

  test("a page whose graph cannot be loaded names the file and the record", async () => {
    const graph = out.files.find((f) => f.name === "stemma.graph.json")!.text;
    const whole = out.files.find((f) => f.name === "explorer.html")!.text;
    const broken = await open("broken.html", whole.replace(graph, () => graph.replace('"type": "Claim"', '"type": "Nothing"')));
    await page.goto(broken);
    const alert = page.getByRole("alert");
    await alert.waitFor();
    expect(await alert.innerText()).toContain("stemma.graph.json, entity stemma.Nothing:clm-fixture0000");
  });
});

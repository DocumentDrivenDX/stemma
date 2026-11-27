// Search without result limits in the served explorer, in headless Chromium
// (US-120-AC2 to AC4 and AC7). Fetch the browser with ./scripts/dev.sh
// browsers; without it these tests are skipped, and say so.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { type Browser, chromium, type Page } from "@playwright/test";
import { servedData } from "@stemma/graph";
import { canonical, loadCorpus, recordPath } from "@stemma/records";
import { ARRAS_SEARCH_QUERY } from "@stemma/server";
import { readProject } from "@stemma/workspace";
import { syntheticProject } from "../scripts/synthetic-project.ts";
import { endRuns, Run } from "./browse-run.ts";
import { temporary } from "./helpers.ts";
import { BROWSER_QUERY, scan } from "./search-oracle.ts";

const browser: Browser | undefined = await chromium.launch().catch((error: unknown) => {
  if (!String(error).includes("Executable doesn't exist")) throw error;
  console.warn("SKIPPED the served search's browser tests: headless Chromium is not fetched (./scripts/dev.sh browsers).");
  return undefined;
});
afterAll(async () => {
  await browser?.close();
  await endRuns();
});

const LINKS = 260;
const HOSTILE = "</script><script>window.__ran=1</script><img src=x onerror=\"window.__ran=2\"> ‮hostileneedle";
const id = (prefix: string, n: number) => `${prefix}-big${String(n).padStart(17, "0")}`;
const CHAPTER = id("chp", 0);
const CITATION = id("cit", 0);
const claims = Array.from({ length: LINKS }, (_, i) => id("clm", i));

/** A synthetic project with one chapter that very many claims name, and one citation that names them all. */
function project(): string {
  const dir = join(temporary(), "large");
  const files = syntheticProject({ sources: 60, pages: [[2, 3], [3, 4]], variety: false });
  const created = { at: "2026-01-05T09:00:00Z", by: { kind: "model", name: "synthetic" } };
  const add = (kind: string, body: { id: string } & Record<string, unknown>) =>
    files.set(recordPath(kind, body.id), canonical({ schema: "stemma.record/0", kind, created, ...body }));
  add("chapter", { id: CHAPTER, title: "Hub chapter", order: 99, matter: "body" });
  for (const [i, claim] of claims.entries()) add("claim", { id: claim, text: i === 7 ? HOSTILE : `Hub claim number ${i}.`, role: "claim", chapters: [CHAPTER], review: { state: "unreviewed" } });
  const sentence = "A sentence that many claims share.";
  add("citation", {
    id: CITATION, chapter: CHAPTER, key: "syn0", quotation: "many claims share", locator: { label: "page", value: "1" }, claims,
    sentence: { text: sentence, sha256: new Bun.CryptoHasher("sha256").update(sentence).digest("hex") }, intake: "parsed",
  });
  for (const [path, text] of files) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}

async function opened(dir: string) {
  const run = await Run.command(["browse", "--no-open", "--format", "json", "--project", dir]);
  await run.until(() => run.stdout.includes("\n"), 60_000);
  const info = JSON.parse(run.stdout.split("\n")[0]!) as { address: string; launch_file: string };
  const context = await browser!.newContext({ viewport: { width: 1300, height: 900 } });
  const page = await context.newPage();
  const seen = { errors: [] as string[], dialogs: [] as string[], elsewhere: [] as string[], queries: [] as { query: string; variables?: Record<string, unknown> }[] };
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") seen.errors.push(m.text());
  });
  page.on("pageerror", (error) => seen.errors.push(String(error)));
  page.on("dialog", (dialog) => {
    seen.dialogs.push(dialog.message());
    void dialog.dismiss();
  });
  context.on("request", (request) => {
    if (!request.url().startsWith(info.address) && !/^(file|data):/.test(request.url())) seen.elsewhere.push(request.url());
    if (request.url() === `${info.address}api/query`) seen.queries.push(request.postDataJSON() as { query: string });
  });
  await page.goto(pathToFileURL(info.launch_file).href);
  await page.getByTestId("data-identity").waitFor({ timeout: 30_000 });
  return { run, info, context, page, seen };
}

const total = (page: Page) => page.getByTestId("stemma-search-total");
/** The record keys listed, once the page of results that starts at `first` is shown. */
async function listed(page: Page, first: number): Promise<string[]> {
  await page.locator(`.stemma-hits li[value="${first}"]`).first().waitFor();
  return page.locator(".stemma-hits li code").allInnerTexts();
}

const clean = async (page: Page, seen: { errors: string[]; dialogs: string[]; elsewhere: string[] }) => {
  expect(await page.evaluate(() => (window as { __ran?: number }).__ran)).toBeUndefined();
  expect(await page.locator("img").count()).toBe(0);
  expect([seen.errors, seen.dialogs, seen.elsewhere]).toEqual([[], [], []]);
};

describe.skipIf(!browser)("US-120 search without result limits, in a browser", () => {
  test("AC2, AC3: every match is reached page by page; arras's box says how many of how many it lists", async () => {
    const dir = project();
    const served = servedData(loadCorpus(readProject(dir)), { version: "test" });
    const types = served.search.types.map((t) => t.type);
    const expected = scan(served.search.entries, "claim", types);
    expect(expected.keys.length).toBeGreaterThan(250);
    const { run, context, page, seen } = await opened(dir);
    try {
      // arras's own box, with more matches than it lists.
      await page.getByRole("textbox", { name: /Search/ }).fill("claim");
      const status = page.getByTestId("gb-status");
      const count = expected.keys.length.toLocaleString("en-US");
      await status.filter({ hasText: `the best 200 of ${count} matches are listed; the Search view lists all of them` }).waitFor();
      expect(await status.innerText()).not.toContain("best 50");
      expect(await page.locator(".gb-hits li").count()).toBe(200);
      await page.getByRole("radio", { name: new RegExp(`^All\\s*${expected.keys.length}$`) }).waitFor();
      await page.getByRole("radio", { name: new RegExp(`^Claims\\s*${expected.counts.get("Claim")}$`) }).waitFor();
      // The query the pinned arras sends is the one the server knows, with the page's limit.
      const sent = seen.queries.find((q) => q.variables?.text === "claim")!;
      expect(sent.query).toBe(BROWSER_QUERY);
      expect(ARRAS_SEARCH_QUERY.test(sent.query)).toBe(true);
      expect(sent.variables).toEqual({ text: "claim", types: null, limit: 200 });

      // The Search view takes the typed text, and every page of it.
      await page.getByRole("link", { name: "Search", exact: true }).click();
      await total(page).filter({ hasText: `${count} records match “claim”. Listed here: 1 to 50` }).waitFor();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      const pages = Math.ceil(expected.keys.length / 50);
      const found: string[] = [];
      for (let at = 1; at <= pages; at++) {
        found.push(...await listed(page, (at - 1) * 50 + 1));
        if (at < pages) await page.getByRole("navigation", { name: "Pages of results" }).getByRole("link", { name: "Next" }).click();
      }
      expect(found).toEqual(expected.keys.map((k) => k.split(" ")[1]!));
      const pager = page.getByRole("navigation", { name: "Pages of results" });
      await pager.getByRole("link", { name: "First" }).click();
      await listed(page, 1);
      await pager.getByRole("spinbutton", { name: "Go to page" }).fill("3");
      await pager.getByRole("button", { name: "Go" }).click();
      const third = await listed(page, 101);
      // A record opens, and Back returns to the same page of results.
      await page.locator(".stemma-hits li a").first().click();
      await page.getByRole("main").getByRole("heading", { level: 1 }).waitFor();
      expect(page.url()).toContain("#/explore/stemma/");
      await page.goBack();
      expect(await listed(page, 101)).toEqual(third);
      await pager.getByRole("link", { name: "Last" }).click();
      await listed(page, (pages - 1) * 50 + 1);
      await page.evaluate(() => (window.location.hash = "#/search/all/9999/claim"));
      await total(page).filter({ hasText: "There is no such page." }).waitFor();
      await pager.getByRole("link", { name: "Last" }).click();
      await listed(page, (pages - 1) * 50 + 1);
      // One type.
      await page.getByRole("navigation", { name: "Narrow by type" }).getByRole("link", { name: /^Citation:/ }).click();
      await total(page).filter({ hasText: `${expected.counts.get("Citation")} ${expected.counts.get("Citation") === 1 ? "record matches" : "records match"} of the type Citation (of ${count} of all types)` }).waitFor();
      // Nothing matches, and a search the server refuses says why.
      const box = page.getByRole("searchbox", { name: "Search all records" });
      await box.fill("qqqzzzxxx");
      await box.press("Enter");
      await total(page).filter({ hasText: `0 records match “qqqzzzxxx”. Searched ${served.search.entries.length.toLocaleString("en-US")} records of ${types.length} types.` }).waitFor();
      await box.fill("a b c d e f g h i j k l m n o p q");
      await box.press("Enter");
      await page.getByRole("alert").filter({ hasText: "A search is 1 to 200 characters and at most 16 words." }).waitFor();
      // The browser notes that refusal's status, and nothing else.
      expect(seen.errors.splice(0)).toEqual(["Failed to load resource: the server responded with a status of 400 (Bad Request)"]);

      // AC7: hostile text, in a record and in the box, stays text.
      await box.fill("hostileneedle");
      await box.press("Enter");
      await page.locator(".stemma-hits li").filter({ hasText: "<img src=x onerror" }).first().waitFor();
      await box.fill("<img src=x onerror=alert(1)>");
      await box.press("Enter");
      await total(page).filter({ hasText: "<img src=x onerror=alert(1)>" }).waitFor();
      await clean(page, seen);
      await run.stop();
    } finally {
      await context.close();
    }
  }, 180_000);

  test("AC4: every link of a record with 260 links is reached, in both directions", async () => {
    const dir = project();
    const { run, info, context, page, seen } = await opened(dir);
    try {
      for (const [type, key] of [["Citation", CITATION], ["Chapter", CHAPTER]] as const) {
        await page.goto(`${info.address}#/explore/stemma/${type}/${key}`);
        await page.getByRole("main").getByRole("heading", { level: 1 }).waitFor();
        // The rows of the record's lists of links, not the picture beside them.
        const rows = "a.gb-rel-row[href*='/stemma/Claim/']";
        const linked = () => page.locator(rows).evaluateAll((links) => [...new Set(links.map((a) => decodeURIComponent(a.getAttribute("href")!.split("/").at(-1)!)))]);
        await page.locator(rows).first().waitFor();
        const more = page.getByRole("button", { name: /^Show more/ });
        for (let presses = 0; presses < 60; presses++) {
          if ((await linked()).length === LINKS) break;
          await more.first().waitFor();
          const before = (await linked()).length;
          await more.first().click();
          // Until the list has grown, or its button has gone or changed.
          await page.waitForFunction(([selector, n]) => new Set([...document.querySelectorAll(selector as string)].map((a) => a.getAttribute("href"))).size > (n as number), [rows, before], { timeout: 5000 }).catch(() => {});
        }
        expect([type, (await linked()).sort()]).toEqual([type, claims]);
      }
      await clean(page, seen);
      await run.stop();
    } finally {
      await context.close();
    }
  }, 180_000);
});

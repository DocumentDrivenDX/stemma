// The manuscript browser in the built page, opened from a local file in headless
// Chromium (US-118). Fetch the browser with ./scripts/dev.sh browsers; without
// it these tests are skipped, and say so.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { type Browser, chromium, type Page } from "@playwright/test";
import type { ManuscriptView } from "@stemma/core";
import { exportGraph } from "@stemma/graph";
import { manuscriptView } from "@stemma/publish";
import { type Corpus, loadCorpus } from "@stemma/records";
import { readProject } from "@stemma/workspace";
import { writeExplorer } from "../scripts/build.ts";
import { ROOT, temporary } from "./helpers.ts";
import { anchorOf, content, LETTER, PAGES, passage, project, type Rec, sources, standard, VOLUME } from "./source-view-fixture.ts";

let browser: Browser | undefined;
try {
  browser = await chromium.launch();
} catch (error) {
  if (!String(error).includes("Executable doesn't exist")) throw error;
  console.warn("SKIPPED the manuscript browser's tests: headless Chromium is not fetched (./scripts/dev.sh browsers).");
}
afterAll(async () => browser?.close());

let template = "";
beforeAll(async () => {
  if (!browser) return;
  const dist = temporary();
  await writeExplorer(dist);
  template = readFileSync(join(dist, "explorer.template.html"), "utf8");
}, 120_000);

function pageOf(corpus: Corpus) {
  const out = exportGraph(corpus, { version: "9.9.9-test", template, manuscript: (has) => manuscriptView(corpus, [], has) });
  const path = join(temporary(), "explorer.html");
  writeFileSync(path, out.files.find((f) => f.name === "explorer.html")!.text);
  return { out, path };
}

/** A page from a local file, offline, recording everything it should never do. */
async function offline(path: string, viewport = { width: 1400, height: 900 }) {
  const context = await browser!.newContext({ offline: true, viewport });
  const page = await context.newPage();
  const seen = { requests: [] as string[], errors: [] as string[], dialogs: [] as string[] };
  page.on("request", (request) => {
    if (!/^(file|data):/.test(request.url())) seen.requests.push(request.url());
  });
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") seen.errors.push(message.text());
  });
  page.on("pageerror", (error) => seen.errors.push(String(error)));
  page.on("dialog", (dialog) => {
    seen.dialogs.push(dialog.message());
    void dialog.dismiss();
  });
  const url = pathToFileURL(path).href;
  await page.goto(url);
  await page.getByRole("textbox", { name: /Search/ }).waitFor();
  return { page, url, seen };
}

const quiet = { requests: [], errors: [], dialogs: [] };
const control = (page: Page, name: string) => page.getByRole("navigation", { name: "Views" }).getByRole("link", { name });
const pane = (page: Page) => page.getByRole("region", { name: "In the source" });
/** Goes to a route and gives the pane once every quotation in it has its view. */
async function shown(page: Page, route: string) {
  await page.evaluate((hash) => { window.location.hash = hash; }, route);
  await page.locator(`section.stemma-source[data-route="${route}"]`).waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll(".stemma-quoted")].every((q) => q.getAttribute("data-state")));
  // A highlighted view's marks arrive with its passages.
  await page.waitForFunction(() => [...document.querySelectorAll('.stemma-quoted[data-state="highlighted"]')].every((q) => q.querySelector("mark")));
  return pane(page);
}
const marksOf = (page: Page) => page.locator(".stemma-quoted").evaluateAll((all) => all.map((q) => ({
  id: q.getAttribute("data-quotation")!, state: q.getAttribute("data-state"), marks: [...q.querySelectorAll("mark")].map((m) => m.textContent),
})));
const markVisible = (page: Page) => page.evaluate(() => {
  const panel = document.querySelector(".stemma-source")!.getBoundingClientRect();
  const mark = document.querySelector(".stemma-source mark")!.getBoundingClientRect();
  return mark.top >= panel.top - 1 && mark.top < Math.min(panel.bottom, window.innerHeight) && mark.top >= 0;
});

describe.skipIf(!browser)("the worked example's report in the page", () => {
  let path = "";
  let view: ManuscriptView;
  let expected: (id: string) => string[];

  beforeAll(() => {
    const corpus = loadCorpus(readProject(join(ROOT, "examples/coral-reefs")));
    const made = pageOf(corpus);
    path = made.path;
    view = made.out.manuscript;
    expected = (id) => view.quotations[id]!.view.passages.flatMap((p) => made.out.sourceViews[p.passage]!.segments.map((s) => s.quoted));
  }, 120_000);

  test("US-118-AC1 the manuscript is reached from a visible control and says what it is", async () => {
    const { page, seen } = await offline(path);
    await control(page, "Manuscript").click();
    const main = page.getByRole("main");
    await main.getByRole("heading", { level: 1, name: "Foundations Out of Sight" }).waitFor();
    const words = await main.innerText();
    for (const part of ["This is the manuscript as the export read it, not the printed PDF.", "This offline file cannot show originals.", "report/report.src"]) expect(words).toContain(part);
    expect(await page.locator(".stemma-notes > li").count()).toBe(view.notes.length);
    expect(await page.locator("a.stemma-entry").count()).toBe(view.bibliography.length);
    expect(await page.locator(".stemma-broken, mark").count()).toBe(0);
    expect(await pane(page).count()).toBe(0);
    // A note's number moves to the note and back without changing the address.
    await page.getByRole("button", { name: "Go to note 1", exact: true }).click();
    expect(await page.evaluate(() => [document.activeElement!.id, window.location.hash])).toEqual(["stemma-note-1", "#/manuscript"]);
    await control(page, "Records").click();
    await page.getByRole("textbox", { name: /Search/ }).waitFor();
    await page.goBack();
    await page.getByRole("main").getByRole("heading", { level: 1, name: "Foundations Out of Sight" }).waitFor();
    expect(seen).toEqual(quiet);
  }, 60_000);

  test("US-118-AC2 clicking a quotation and a note citation shows the cited words marked in the source", async () => {
    const { page, seen } = await offline(path);
    await control(page, "Manuscript").click();
    const quotation = page.locator(".stemma-reading a.stemma-quotation").nth(3);
    const id = (await quotation.getAttribute("data-quotation"))!;
    await quotation.click();
    await pane(page).locator("mark").first().waitFor();
    expect(await pane(page).locator("mark").allTextContents()).toEqual(expected(id));
    expect(await markVisible(page)).toBe(true);
    const citation = page.locator('a.stemma-citation[data-citation="1/0"]');
    await citation.click();
    await page.locator('section.stemma-source[data-route="#/manuscript/citation/1/0"] mark').first().waitFor();
    expect(await markVisible(page)).toBe(true);
    for (const words of ["Cited source:", "Converted or recognized text, not a reading of the page", "Original not shown: the offline file cannot show originals."]) expect(await pane(page).innerText()).toContain(words);
    await page.getByRole("link", { name: "Close the source" }).click();
    await pane(page).waitFor({ state: "detached" });
    expect(seen).toEqual(quiet);
  }, 60_000);

  test("every quotation marks its own passages' words, and no other", async () => {
    const { page, seen } = await offline(path);
    for (const id of Object.keys(view.quotations)) {
      await shown(page, `#/manuscript/quotation/${id}`);
      expect(await marksOf(page), id).toEqual([{ id, state: "highlighted", marks: expected(id) }]);
    }
    expect(seen).toEqual(quiet);
  }, 120_000);

  test("every note citation shows the quotations it supports and its own source", async () => {
    const { page, seen } = await offline(path);
    for (const note of view.notes) {
      for (const [index, citation] of note.citations.entries()) {
        const found = await shown(page, `#/manuscript/citation/${note.number}/${index}`);
        expect(await marksOf(page), `${note.number}/${index}`).toEqual(citation.quotations.map((id) => ({ id, state: "highlighted", marks: expected(id) })));
        expect(await found.getByRole("link", { name: view.works[citation.source!]!.key!, exact: true }).count()).toBeGreaterThan(0);
      }
    }
    expect(seen).toEqual(quiet);
  }, 120_000);

  test("US-118-AC4 each bibliography entry shows its source and every place that cites it, each openable", async () => {
    const { page, seen } = await offline(path);
    await control(page, "Manuscript").click();
    for (const entry of view.bibliography) {
      await page.locator(`a.stemma-entry[data-entry="${entry.source}"]`).click();
      const found = page.locator(`section.stemma-source[data-route="#/manuscript/source/${entry.source}"]`);
      await found.waitFor();
      // The first quotation of the work, by the order of its places and then of those with no citation, is shown in its source.
      const first = entry.places.flatMap((p) => view.notes.find((n) => n.number === p.note)!.citations[p.citation]!.quotations)[0] ?? entry.quoted[0]?.quotation;
      if (first === undefined) {
        expect(await found.locator("mark").count()).toBe(0);
        expect(await found.innerText()).toContain("The report quotes nothing from this work, so nothing is highlighted");
      } else {
        await found.locator(".stemma-quoted mark").first().waitFor();
        expect(await marksOf(page)).toEqual([{ id: first, state: "highlighted", marks: expected(first) }]);
        expect(await found.innerText()).toContain("Shown first is the first quotation of this work in the report");
      }
      const links = await found.locator(".stemma-places a[href^='#/manuscript/citation/']").evaluateAll((all) => all.map((a) => a.getAttribute("href")));
      expect(links).toEqual(entry.places.map((p) => `#/manuscript/citation/${p.note}/${p.citation}`));
    }
    const last = view.bibliography.at(-1)!;
    await pane(page).locator(".stemma-places a").first().click();
    await page.locator(`section.stemma-source[data-route="#/manuscript/citation/${last.places[0]!.note}/${last.places[0]!.citation}"] mark`).first().waitFor();
    expect(seen).toEqual(quiet);
  }, 120_000);

  test("US-118-AC9 on a narrow screen the source lies over the text, on screen, and closes", async () => {
    const { page, seen } = await offline(path, { width: 390, height: 800 });
    await control(page, "Manuscript").click();
    const quotation = page.locator(".stemma-reading a.stemma-quotation").nth(40);
    await quotation.scrollIntoViewIfNeeded();
    await quotation.click();
    await pane(page).locator("mark").first().waitFor();
    expect(await markVisible(page)).toBe(true);
    const places = await page.evaluate(() => {
      const box = document.querySelector(".stemma-pane")!.getBoundingClientRect();
      const clicked = document.querySelector(".stemma-reading [aria-current]")!.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, height: window.innerHeight, clicked: clicked.top, sideways: document.documentElement.scrollWidth - window.innerWidth };
    });
    expect(places.top).toBeGreaterThan(0);
    expect(places.bottom).toBeLessThanOrEqual(places.height + 1);
    // What was clicked is still in sight above the source.
    expect(places.clicked).toBeGreaterThanOrEqual(0);
    expect(places.clicked).toBeLessThan(places.top);
    expect(places.sideways).toBeLessThanOrEqual(0);
    await page.getByRole("link", { name: "Close the source" }).click();
    await pane(page).waitFor({ state: "detached" });
    expect(seen).toEqual(quiet);
  }, 60_000);

  test("a note's quotation ends as the printed note does, and stays in sight when it is the copy clicked", async () => {
    const { page, seen } = await offline(path, { width: 390, height: 800 });
    await control(page, "Manuscript").click();
    // The first paragraph of a note holds its cited quotations; a comment quotes as running text.
    const copies = page.locator(".stemma-notes > li > p:first-child a.stemma-quotation");
    for (const text of await copies.allInnerTexts()) expect(text).toMatch(/[.?!]”$/);
    const copy = copies.nth(40);
    await copy.scrollIntoViewIfNeeded();
    await copy.click();
    await pane(page).locator("mark").first().waitFor();
    const id = (await copy.getAttribute("data-quotation"))!;
    const at = await page.evaluate((quotation) => ({
      clicked: document.querySelector(`.stemma-notes > li > p:first-child a[data-quotation="${quotation}"]`)!.getBoundingClientRect().top,
      pane: document.querySelector(".stemma-pane")!.getBoundingClientRect().top,
    }), id);
    expect(at.clicked).toBeGreaterThanOrEqual(0);
    expect(at.clicked).toBeLessThan(at.pane);
    expect(seen).toEqual(quiet);
  }, 60_000);

  test("axe-core reports no violation in the manuscript with a source open", async () => {
    const { page } = await offline(path);
    for (const route of ["#/manuscript/quotation/D37-crater", `#/manuscript/source/${view.bibliography[0]!.source}`]) {
      await shown(page, route);
      const found = await new AxeBuilder({ page }).include(".stemma-manuscript").include(".stemma-views").analyze();
      expect(found.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    }
  }, 60_000);
});

describe.skipIf(!browser)("hostile text and broken quotations in a synthetic report", () => {
  const SCRIPT = "</script><script>window.__ran=1</script><img src=x onerror=\"window.__ran=2\"> [a](javascript:window.__ran=3) <mark>fake</mark> $& __STEMMA_MANUSCRIPT_JSON__";
  const BIDI = "‮desrever‬ ⁧isolate⁩‏";
  const { one, two } = standard();
  const changed = passage("psg-changed00001", [{ ...anchorOf(PAGES, 2, "main", "islets"), page_sha256: "0".repeat(64) }], "islets");
  const quotation = (id: string, passages: string[], more: Rec = {}) => ({ id, cites: "volume1850", passages: passages.map((p) => ({ passage: p })), ...more });
  let page: Page;
  let seen: Awaited<ReturnType<typeof offline>>["seen"];

  beforeAll(async () => {
    const base = content(project({ sources: sources().map((s) => (s.id === LETTER ? { ...s, type: "personal_communication" } : s)), records: [one, two, changed] }));
    const spec = { manuscript: "report.src", quotations: [quotation("good", [one.id]), quotation("two", [two.id]), quotation("stale", [changed.id]), quotation("bare", [])] };
    const words = `# ${SCRIPT}\n\n${SCRIPT} ${BIDI} {{q:good}}.[^good|${SCRIPT} ${BIDI}] Stale {{q:stale}}.[^stale] None.[^bare] Two {{q:two}}.[^two]\n\n{{bibliography}}\n`;
    const corpus = loadCorpus({
      ...base, report: {
        spec: { path: "report/report.json", bytes: new TextEncoder().encode(JSON.stringify(spec)) },
        template: { path: "report/report.src", bytes: new TextEncoder().encode(words) },
      },
    });
    ({ page, seen } = await offline(pageOf(corpus).path));
    await control(page, "Manuscript").click();
    await page.locator(".stemma-reading h1").waitFor();
  }, 60_000);

  test("US-118-AC6 manuscript text is inert, with hidden characters shown", async () => {
    const reading = page.locator(".stemma-reading");
    const words = (await reading.textContent())!;
    expect(words).toContain("<script>window.__ran=1</script>");
    expect(words).toContain("<mark>fake</mark>");
    expect(words).toContain("U+2067isolateU+2069U+200F");
    expect(words).not.toMatch(/[‎‏‪-‮⁦-⁩]/);
    expect(await reading.locator("script, img, iframe, mark").count()).toBe(0);
    expect(await reading.getByRole("link").evaluateAll((all) => all.map((a) => a.getAttribute("href")!).filter((h) => !h.startsWith("#/manuscript/")))).toEqual([]);
    expect(await page.evaluate(() => (window as unknown as { __ran?: number }).__ran)).toBeUndefined();
  }, 60_000);

  test("US-118-AC5 a broken quotation is marked broken, shows no words, and highlights nothing; the rest opens", async () => {
    const broken = page.locator('.stemma-reading a[data-quotation="stale"]').first();
    expect(await broken.textContent()).toBe("[Broken quotation stale: The text has changed]");
    await broken.click();
    const found = await shown(page, "#/manuscript/quotation/stale");
    expect(await found.innerText()).toContain("The text has changed. Nothing is highlighted.");
    expect(await found.locator("mark, .stemma-source-text").count()).toBe(0);
    await shown(page, "#/manuscript/quotation/good");
    expect(await marksOf(page)).toEqual([{ id: "good", state: "highlighted", marks: ["nothing more is known"] }]);
    await shown(page, "#/manuscript/quotation/two");
    expect(await marksOf(page)).toEqual([{ id: "two", state: "highlighted", marks: ["We saw the la-", "\u{1D49C}\u{1F600}goon was deep"] }]);
  }, 60_000);

  test("US-118-AC3 a citation with no passage opens the source and highlights nothing", async () => {
    await page.locator('a.stemma-citation[data-citation="3/0"]').click();
    const found = await shown(page, "#/manuscript/citation/3/0");
    const words = await found.innerText();
    expect(words).toContain("No passage recorded. Nothing is highlighted.");
    expect(words).toContain("The volume1850 book");
    expect(await found.getByRole("link", { name: "volume1850", exact: true }).first().getAttribute("href")).toBe(`#/explore/stemma/Source/${VOLUME}`);
    expect(await found.locator("mark, .stemma-source-text").count()).toBe(0);
  }, 60_000);

  test("a route that names nothing highlights nothing, and nothing was requested or run", async () => {
    for (const route of ["#/manuscript/quotation/absent", "#/manuscript/citation/99/0", "#/manuscript/source/src-absent000001", "#/manuscript/quotation/__proto__"]) {
      const found = await shown(page, route);
      expect(await found.innerText(), route).toContain("nothing is highlighted");
      expect(await found.locator("mark").count()).toBe(0);
    }
    expect(seen).toEqual(quiet);
  }, 60_000);
});

describe.skipIf(!browser)("a project with no report", () => {
  test("offers no manuscript control", async () => {
    const { page, seen } = await offline(pageOf(loadCorpus(content(project()))).path);
    expect(await page.getByRole("navigation", { name: "Views" }).count()).toBe(0);
    expect(seen).toEqual(quiet);
  }, 60_000);
});

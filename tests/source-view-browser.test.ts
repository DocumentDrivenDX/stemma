// The "In the source" panel in the built page, opened from a local file in
// headless Chromium (US-116). Fetch the browser with ./scripts/dev.sh browsers;
// without it these tests are skipped, and say so.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { type Browser, chromium, type Page } from "@playwright/test";
import { exportGraph } from "@stemma/graph";
import { normalizeSentence, sha256 } from "@stemma/records";
import { ISOLATION_FLAGS } from "../packages/cli/src/runtime.ts";
import { bundle, writeExplorer } from "../scripts/build.ts";
import { ROOT, temporary } from "./helpers.ts";
import { anchorOf, AT, citation, corpusOf, PAGES, passage, standard, VOLUME } from "./source-view-fixture.ts";

let browser: Browser | undefined;
try {
  browser = await chromium.launch();
} catch (error) {
  if (!String(error).includes("Executable doesn't exist")) throw error;
  console.warn("SKIPPED the source panel's browser tests: headless Chromium is not fetched (./scripts/dev.sh browsers).");
}
afterAll(async () => browser?.close());

/** A page from a local file, offline, recording everything it should never do. */
async function offline(path: string) {
  const context = await browser!.newContext({ offline: true, viewport: { width: 1400, height: 900 } });
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

const panelOf = (page: Page) => page.getByRole("region", { name: "In the source" });
/** The panel once it shows this record's view. */
const opened = async (page: Page, id: string, state?: string) => {
  const panel = page.locator(`section.stemma-source[data-record="${id}"]${state ? `[data-state="${state}"]` : ""}`);
  await panel.waitFor();
  return panel;
};
/** Whether the first highlight lies inside what the panel and the window show. */
const markVisible = (page: Page) => page.evaluate(() => {
  const panel = document.querySelector(".stemma-source")!.getBoundingClientRect();
  const mark = document.querySelector(".stemma-source mark")!.getBoundingClientRect();
  return mark.top >= panel.top - 1 && mark.top < Math.min(panel.bottom, window.innerHeight);
});

describe.skipIf(!browser)("the worked example's source panel, as the built command line makes the page", () => {
  let path = "";
  let views: Record<string, any>;

  beforeAll(async () => {
    const work = temporary();
    const cli = await bundle(join(work, "dist"));
    const dir = join(work, "coral-reefs");
    cpSync(join(ROOT, "examples/coral-reefs"), dir, { recursive: true, filter: (p) => !p.endsWith("/build") });
    const done = Bun.spawnSync([process.execPath, ...ISOLATION_FLAGS, cli, "graph", "export", "--audience", "author", "--page", "--project", dir],
      { cwd: dirname(cli), env: { PATH: process.env.PATH ?? "", HOME: temporary() } });
    expect([done.exitCode, done.stderr.toString()]).toEqual([0, ""]);
    path = join(dir, "build/graph/author/explorer.html");
    const file = readFileSync(join(dir, "build/graph/author/stemma.sourceviews.json"), "utf8");
    views = JSON.parse(file).views;
    // The measured size the new file adds to this export, and to its page.
    console.log(`worked example: stemma.sourceviews.json is ${Buffer.byteLength(file)} bytes of a ${readFileSync(path).length} byte page`);
    expect(Buffer.byteLength(file)).toBeLessThan(1_000_000);
    expect(readFileSync(path, "utf8")).toContain(file);
  }, 120_000);

  test("US-116-AC1, AC4, AC5 a citation shows its sentence, its quotation marked in its page, and the page label, with no request", async () => {
    const { page, url, seen } = await offline(path);
    expect(await panelOf(page).count()).toBe(0);
    const citations = Object.values(views).filter((v) => v.kind === "citation");
    expect(citations).toHaveLength(4);
    for (const view of citations) {
      expect(view.state, view.id).toBe("highlighted");
      await page.goto(`${url}#/explore/stemma/Citation/${view.id}`);
      const panel = await opened(page, view.id, "highlighted");
      await panel.locator("mark").waitFor();
      const passageView = views[view.passages[0].passage];
      expect(await panel.locator("mark").allTextContents()).toEqual(passageView.segments.map((s: any) => s.quoted));
      // The whole page text stands around the mark, in order.
      expect(await panel.locator(".stemma-source-text").first().textContent()).toBe(passageView.segments[0].before + passageView.segments[0].quoted + passageView.segments[0].after);
      const words = await panel.innerText();
      for (const part of [view.citation.sentence, `Printed page ${passageView.segments[0].printed_label}`, "Converted or recognized text, not a reading of the page", "recorded quality unassessed", "The original, as recorded", "Original not shown: the offline file cannot show originals."]) {
        expect(words, view.id).toContain(part);
      }
      expect(await markVisible(page)).toBe(true);
      // The first page's printed label is on screen beside its highlight.
      expect(await panel.locator(".stemma-page-heading").first().evaluate((e) => {
        const [h, box] = [e.getBoundingClientRect(), e.closest(".stemma-source")!.getBoundingClientRect()];
        return h.top >= box.top - 1 && h.bottom <= Math.min(box.bottom, window.innerHeight) + 1;
      })).toBe(true);
    }
    const link = panelOf(page).getByRole("link", { name: /^https:\/\/archive\.org/ }).first();
    expect(await link.getAttribute("rel")).toBe("noreferrer noopener");
    expect(await page.locator("link[rel=preload], link[rel=prefetch], iframe, img[src^=http]").count()).toBe(0);
    expect([seen.requests, seen.errors, seen.dialogs]).toEqual([[], [], []]);
  }, 60_000);

  test("the panel follows the browser's own routing: from search to a passage, to its source, and back", async () => {
    const { page, url, seen } = await offline(path);
    const box = page.getByRole("textbox", { name: /Search/ });
    await box.fill("theory most generally received");
    await box.press("Enter");
    await page.getByRole("main").getByRole("link", { name: /^Passage .*theory most generally/i }).first().click();
    await page.waitForURL(/\/Passage\/psg-/);
    const id = new URL(page.url()).hash.split("/").at(-1)!;
    await (await opened(page, id, "highlighted")).locator("mark").first().waitFor();
    await page.getByRole("complementary").getByRole("listitem").getByRole("link").filter({ hasText: "src-darwinreefs1842" }).first().click();
    await page.waitForURL(/\/Source\/src-darwinreefs1842$/);
    await panelOf(page).waitFor({ state: "detached" });
    expect(await page.locator("mark").count()).toBe(0);
    await page.goBack();
    await (await opened(page, id, "highlighted")).locator("mark").first().waitFor();
    // From one record straight to another: only the second's highlight is ever left.
    await page.goto(`${url}#/explore/stemma/Citation/cit-darwinreefs0001`);
    await opened(page, "cit-darwinreefs0001", "highlighted");
    await page.evaluate(() => { window.location.hash = "#/explore/stemma/Citation/cit-darwinreefs0003"; });
    const next = await opened(page, "cit-darwinreefs0003", "highlighted");
    await next.locator("mark").waitFor();
    const third = views[views["cit-darwinreefs0003"].passages[0].passage].segments.map((s: any) => s.quoted);
    expect(third.join(" ").replaceAll("\n", " ")).toBe("I have invariably used in this volume the term");
    expect(await next.locator("mark").allTextContents()).toEqual(third);
    // The `browse` alias is rewritten without a hashchange, and the panel still follows.
    await page.goto("about:blank");
    await page.goto(`${url}#/browse/stemma/Citation/cit-darwinreefs0004`);
    await (await opened(page, "cit-darwinreefs0004", "highlighted")).locator("mark").waitFor();
    expect([seen.requests, seen.errors]).toEqual([[], []]);
  }, 60_000);

  test("on a narrow screen the panel is below the record, nothing overflows sideways, and the highlight is shown", async () => {
    const { page, url, seen } = await offline(path);
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(`${url}#/explore/stemma/Citation/cit-darwinreefs0002`);
    const panel = await opened(page, "cit-darwinreefs0002", "highlighted");
    await panel.locator("mark").waitFor();
    await page.getByRole("main").getByRole("heading", { level: 1 }).waitFor();
    const places = await page.evaluate(() => ({
      record: document.querySelector(".stemma-records")!.getBoundingClientRect().bottom,
      panel: document.querySelector(".stemma-source")!.getBoundingClientRect().top,
      sideways: document.querySelector(".stemma-source")!.scrollWidth - document.querySelector(".stemma-source")!.clientWidth,
    }));
    expect(places.panel).toBeGreaterThanOrEqual(places.record - 1);
    expect(places.sideways).toBeLessThanOrEqual(0);
    await panel.scrollIntoViewIfNeeded();
    expect(await panel.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect([seen.requests, seen.errors]).toEqual([[], []]);
  }, 60_000);

  test("axe-core reports no violation in the panel", async () => {
    const { page, url } = await offline(path);
    await page.goto(`${url}#/explore/stemma/Citation/cit-darwinreefs0001`);
    await (await opened(page, "cit-darwinreefs0001", "highlighted")).locator("mark").waitFor();
    const found = await new AxeBuilder({ page }).include(".stemma-source").analyze();
    expect(found.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  }, 60_000);
});

describe.skipIf(!browser)("hostile text and the states, in a synthetic page", () => {
  const SCRIPT = "</script><script>window.__ran=1</script><img src=x onerror=\"window.__ran=2\"> [a](https://example.invalid/m) <mark>fake</mark> $& __STEMMA_GRAPH_JSON__";
  const BIDI = "‮desrever‬ ⁧isolate⁩‏";
  const { one, two } = standard();
  let url = "";
  let page: Page;
  let seen: Awaited<ReturnType<typeof offline>>["seen"];

  beforeAll(async () => {
    const dist = temporary();
    await writeExplorer(dist);
    const pages = structuredClone(PAGES);
    pages.push({ label: "4", blocks: [{ role: "paragraph", content: `${SCRIPT.replaceAll("<", "&lt;")} ${BIDI} THE HOSTILE WORDS ${BIDI}` }] });
    const hostile = passage("psg-hostile00001", [anchorOf(pages, 3, "main", `THE HOSTILE WORDS ‮`)], "THE HOSTILE WORDS ‮", { locator: { label: "page", value: "4" } });
    const changed = passage("psg-changed00001", [{ ...anchorOf(pages, 2, "main", "islets"), page_sha256: "0".repeat(64) }], "islets");
    const sentence = normalizeSentence(`${SCRIPT} ${BIDI}`);
    const corpus = corpusOf({
      pages,
      records: [
        hostile, changed, one, two,
        citation("cit-hostile00001", hostile, { sentence: { text: sentence, sha256: sha256(sentence) } }),
        citation("cit-differs00001", one, { locator: { label: "page", value: "99" } }),
        citation("cit-nopassage001", one, { passage: undefined }),
        citation("cit-changed00001", changed),
        citation("cit-twopages0001", two),
        { schema: "stemma.record/0", id: "ups-javascript001", kind: "upstream", created: { at: AT, by: { kind: "person", name: "A" } }, source: VOLUME,
          retrieved_at: AT, retrieved_by: { kind: "person", name: "A" }, sha256: "a".repeat(64), size: 10, media_type: "application/pdf", url: "javascript:window.__ran=3" },
      ],
      manifest: { original: { form: "file", files: [{ sha256: "a".repeat(64), size: 10, media_type: "application/pdf" }], obtained_from: "data:text/html,<script>1</script>", acquired_at: AT } },
    });
    const out = exportGraph(corpus, { version: "9.9.9-test", template: readFileSync(join(dist, "explorer.template.html"), "utf8") });
    const path = join(temporary(), "explorer.html");
    writeFileSync(path, out.files.find((f) => f.name === "explorer.html")!.text);
    ({ page, url, seen } = await offline(path));
  }, 60_000);

  const visit = async (type: string, id: string, state: string) => {
    await page.goto(`${url}#/explore/stemma/${type}/${id}`);
    return opened(page, id, state);
  };

  test("hostile source text is shown as text, each piece isolated, with hidden characters visible", async () => {
    const panel = await visit("Citation", "cit-hostile00001", "highlighted");
    await panel.locator("mark").waitFor();
    expect(await panel.locator("mark").count()).toBe(1);
    expect(await panel.locator("mark").textContent()).toBe("THE HOSTILE WORDS U+202E");
    const words = await panel.locator(".stemma-source-text").textContent();
    expect(words).toContain("<script>window.__ran=1</script>");
    expect(words).toContain("<mark>fake</mark>");
    expect(words).toContain("U+2067isolateU+2069U+200F");
    // No hidden character reaches the panel's text, in the page text or the citing sentence.
    expect(await panel.textContent()).not.toMatch(/[‎‏‪-‮⁦-⁩]/);
    const pieces = await panel.locator(".stemma-source-text > span, .stemma-source-text > mark > span").evaluateAll((all) => all.map((e) => [e.getAttribute("dir"), getComputedStyle(e).unicodeBidi]));
    expect(pieces).toEqual([["auto", "isolate"], ["auto", "isolate"], ["auto", "isolate"]]);
    expect(await panel.locator("script, img, iframe").count()).toBe(0);
    expect(await panel.getByRole("link").evaluateAll((all) => all.map((a) => a.getAttribute("href")!).filter((h) => !h.startsWith("#/explore/")))).toEqual([]);
    expect(await panel.innerText()).toContain("javascript:window.__ran=3");
    expect(await page.evaluate(() => (window as unknown as { __ran?: number }).__ran)).toBeUndefined();
  }, 60_000);

  test.each([
    ["Citation", "cit-differs00001", "citation_differs", "The citation differs from its passage. Nothing is highlighted."],
    ["Citation", "cit-nopassage001", "no_passage", "No passage recorded. Nothing is highlighted."],
    ["Citation", "cit-changed00001", "changed", "The text has changed. Nothing is highlighted."],
    ["Passage", "psg-changed00001", "changed", "The text has changed. Nothing is highlighted."],
  ])("US-116-AC2, AC3 %s %s shows why and no highlight or source text", async (type, id, state, heading) => {
    const panel = await visit(type, id, state);
    const words = await panel.innerText();
    expect(words).toContain(heading);
    expect(words).toContain("The volume1850 book");
    expect([await panel.locator("mark").count(), await panel.locator(".stemma-source-text").count()]).toEqual([0, 0]);
  }, 60_000);

  test("a quotation across two pages has one mark on each page", async () => {
    const panel = await visit("Citation", "cit-twopages0001", "highlighted");
    await panel.locator("mark").first().waitFor();
    expect(await panel.locator("mark").allTextContents()).toEqual(["We saw the la-", "\u{1D49C}\u{1F600}goon was deep"]);
    const words = await panel.innerText();
    expect(words.indexOf("Printed page 1")).toBeLessThan(words.indexOf("Printed page 2"));
    expect([seen.requests, seen.errors, seen.dialogs]).toEqual([[], [], []]);
  }, 60_000);
});

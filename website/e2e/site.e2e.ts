import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { colorTokens, contrast, measured, PAIRS } from "../lib/contrast.ts";
import { PAGES } from "../lib/nav.ts";

const SCHEMES = ["light", "dark"] as const;

/** Collects console problems, failed or off-site requests, and bad responses. */
function watch(page: Page, origin: string) {
  const problems: string[] = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") problems.push(`console ${m.type()}: ${m.text()}`); });
  page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
  page.on("request", (r) => { if (!r.url().startsWith(origin) && !r.url().startsWith("data:")) problems.push(`external request: ${r.url()}`); });
  page.on("requestfailed", (r) => problems.push(`failed request: ${r.url()}`));
  page.on("response", (r) => { if (r.status() >= 400) problems.push(`${r.status()}: ${r.url()}`); });
  return problems;
}

/** Loads lazy images and waits for fonts, so that every request is seen. */
async function settle(page: Page) {
  await page.evaluate(async () => {
    for (const image of document.images) image.loading = "eager";
    await Promise.all([...document.images].map((i) => i.decode()));
    await document.fonts.ready;
  });
}

for (const { file } of PAGES) {
  test(`${file}: loads cleanly from this server only`, async ({ page, baseURL }) => {
    const problems = watch(page, baseURL!);
    await page.goto(file);
    await settle(page);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator('nav [aria-current="page"]')).toHaveAttribute("href", file);
    const levels = await page.locator("main :is(h1,h2,h3,h4)").evaluateAll((all) => all.map((h) => Number(h.tagName[1])));
    levels.forEach((level, i) => expect(level, "no heading level is skipped").toBeLessThanOrEqual((levels[i - 1] ?? 0) + 1));
    const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replaceAll('"', "")));
    expect(fonts).toContain("Inter");
    expect(problems).toEqual([]);
  });

  for (const colorScheme of SCHEMES) {
    test(`${file}: no automated accessibility violation, ${colorScheme}`, async ({ browser, baseURL }) => {
      const context = await browser.newContext({ colorScheme, baseURL: baseURL!, bypassCSP: true });
      const page = await context.newPage();
      await page.goto(file);
      await settle(page);
      const found = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
      expect(found.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 5).join(", ")}`)).toEqual([]);
      await context.close();
    });
  }

  for (const width of [320, 375]) {
    test(`${file}: no sideways page scroll at ${width} pixels`, async ({ page }) => {
      await page.setViewportSize({ width, height: 740 });
      await page.goto(file);
      await settle(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      for (const link of await page.locator("nav a").all()) {
        const box = (await link.boundingBox())!;
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        expect(box.height).toBeGreaterThanOrEqual(24);
      }
    });
  }
}

test("the navigation reaches every page", async ({ page }) => {
  await page.goto("index.html");
  for (const { file, nav } of PAGES) {
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: nav, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${file.replace(".", "\\.")}$`));
    await expect(page.locator("h1")).toBeVisible();
  }
});

test("every link on this site, with its fragment, leads somewhere", async ({ page, request, baseURL }) => {
  const targets = new Set<string>();
  for (const { file } of PAGES) {
    await page.goto(file);
    for (const url of await page.locator("a[href], link[href], img[src]").evaluateAll((all) =>
      all.map((e) => (e as HTMLAnchorElement).href || (e as HTMLImageElement).src))) {
      if (url.startsWith(baseURL!)) targets.add(url);
    }
  }
  expect(targets.size).toBeGreaterThan(PAGES.length);
  for (const url of targets) {
    const [path, fragment] = url.split("#") as [string, string?];
    const response = await request.get(path);
    expect(response.status(), url).toBe(200);
    if (fragment) expect(await response.text(), url).toContain(`id="${fragment}"`);
  }
});

test("links that leave the site go only to the project and its family", async ({ page, baseURL }) => {
  // These are not fetched: the tests make no external request.
  for (const { file } of PAGES) {
    await page.goto(file);
    for (const url of await page.locator("a[href]").evaluateAll((all) => all.map((e) => (e as HTMLAnchorElement).href))) {
      if (!url.startsWith(baseURL!)) expect(url).toMatch(/^https:\/\/(github\.com\/DocumentDrivenDX\/|documentdrivendx\.github\.io\/)/);
    }
  }
});

const hex = (rgb: string) => `#${rgb.match(/\d+/g)!.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`;

for (const scheme of SCHEMES) {
  test(`rendered colors match the tokens and meet their contrast floors, ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("design.html");
    const value = new Map(colorTokens().map((t) => [t.name, t[scheme]]));
    expect(await page.locator("body").evaluate((b) => getComputedStyle(b).backgroundColor).then(hex)).toBe(value.get("--arras-color-ground")!);
    const expected = measured(scheme);
    await expect(page.locator("[data-pair]")).toHaveCount(PAIRS.length);
    for (const [i, pair] of expected.entries()) {
      const shown = await page.locator(`[data-pair="${i}"]`).evaluate((e) => [getComputedStyle(e).color, getComputedStyle(e).backgroundColor]);
      const ratio = contrast(hex(shown[0]!), hex(shown[1]!));
      expect(ratio, `${pair.fg} on ${pair.bg}`).toBeCloseTo(pair.ratio, 5);
      expect(ratio, `${pair.fg} on ${pair.bg}`).toBeGreaterThanOrEqual(pair.floor);
    }
  });
}

const DRAWN = ["index.html", "how.html", "checks.html", "postgres.html"];

for (const file of DRAWN) {
  for (const width of [320, 375, 1280]) {
    test(`${file}: diagram text stays legible, with its text equivalent in view, at ${width} pixels`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(file);
      await settle(page);
      const drawings = await page.locator(".drawing svg").evaluateAll((all) => (all as SVGSVGElement[]).filter((s) => s.getBoundingClientRect().width > 0).map((s) => {
        const scale = s.getBoundingClientRect().width / s.viewBox.baseVal.width;
        return {
          name: s.querySelector("title")!.textContent!,
          smallest: Math.min(...[...s.querySelectorAll("text")].map((t) => parseFloat(getComputedStyle(t).fontSize) * scale)),
          labels: [...s.querySelectorAll("text")].map((t) => t.textContent!),
          // Wider than the room it has: it must be in a region the keyboard can reach and scroll.
          clipped: s.getBoundingClientRect().width > s.parentElement!.clientWidth + 1,
          reachable: s.parentElement!.getAttribute("tabindex") === "0" && !!s.parentElement!.getAttribute("aria-label"),
        };
      }));
      expect(drawings.length).toBeGreaterThan(0);
      const words = (await page.locator(".equivalent").allInnerTexts()).join("\n").toLowerCase();
      for (const d of drawings) {
        expect(d.smallest, d.name).toBeGreaterThanOrEqual(11.5);
        if (d.clipped) expect(d.reachable, d.name).toBe(true);
        for (const label of d.labels) expect(words, `${d.name}: ${label}`).toContain(label.toLowerCase());
      }
      for (const list of await page.locator(".equivalent").all()) await expect(list).toBeVisible();
    });
  }
}

for (const scheme of SCHEMES) {
  test(`diagrams are drawn in the page's tokens, ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("how.html");
    const value = new Map(colorTokens().map((t) => [t.name, t[scheme]]));
    const style = (selector: string, property: "fill" | "stroke" | "strokeDasharray") =>
      page.locator(selector).first().evaluate((e, p) => getComputedStyle(e)[p], property);
    const box = ".diagram-evidence .lini-box:not(.stm-focus) > rect";
    expect(hex(await style(box, "fill"))).toBe(value.get("--arras-color-surface")!);
    expect(hex(await style(box, "stroke"))).toBe(value.get("--stm-color-line-strong")!);
    expect(await style(box, "strokeDasharray")).toBe("none");
    expect(hex(await style(".diagram-evidence .lini-text", "fill"))).toBe(value.get("--arras-color-text")!);
    await expect(page.locator(".diagram-evidence .stm-opposing")).toHaveCount(1);
    expect(await style(".diagram-evidence .stm-opposing path", "strokeDasharray")).not.toBe("none");
    expect(await style(".diagram-evidence .lini-link:not(.stm-opposing) path", "strokeDasharray")).toBe("none");
    await expect(page.locator(".diagram-evidence .stm-inner")).toHaveCount(1);
  });
}

test("data-appearance overrides the system setting", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("index.html");
  const ground = () => page.locator("body").evaluate((b) => getComputedStyle(b).backgroundColor).then(hex);
  expect(await ground()).toBe("#f6f7f9");
  await page.evaluate(() => { document.documentElement.dataset.appearance = "dark"; });
  expect(await ground()).toBe("#0f131a");
});

test("keyboard: the skip link comes first and focus is visible on every stop", async ({ page }) => {
  await page.goto("checks.html");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();

  await page.goto("checks.html");
  const stops = await page.locator("a[href], [tabindex='0']").count();
  for (let i = 0; i < stops; i++) {
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => {
      const e = document.activeElement!;
      const s = getComputedStyle(e);
      return { name: `${e.tagName} ${e.textContent?.slice(0, 40)}`, style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
    });
    expect(focus.style, focus.name).toBe("solid");
    expect(focus.width, focus.name).toBeGreaterThanOrEqual(2);
  }
});

test("the site works without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL: baseURL! });
  const page = await context.newPage();
  for (const { file } of PAGES) {
    await page.goto(file);
    await expect(page.locator("script")).toHaveCount(0);
    await expect(page.locator("h1")).toBeVisible();
  }
  await context.close();
});

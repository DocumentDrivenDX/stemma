// A served explorer in headless Chromium is given real answers with their bodies
// changed (US-119-AC10). Without the browser (./scripts/dev.sh browsers) these
// tests are skipped, and say so.
import { afterAll, describe, expect, test } from "bun:test";
import { pathToFileURL } from "node:url";
import { type Page } from "@playwright/test";
import { endRuns } from "./browse-run.ts";
import { browser, notice, project, searchBox, stored, takenDown, unused, watched } from "./browse-page.ts";

afterAll(async () => {
  await browser?.close();
  await endRuns();
});

describe.skipIf(!browser)("US-119-AC10 another program that takes the port", () => {
  test.each([
    ["/api/boot", async () => {}],
    ["/api/arras", async () => {}],
    ["/api/query", async (page: Page) => searchBox(page).fill("subsidence")],
    ["/api/manuscript", async (page: Page) => page.getByRole("link", { name: "Manuscript", exact: true }).click()],
    ["/api/source-view", async (page: Page) => {
      await page.getByRole("link", { name: "Manuscript", exact: true }).click();
      await page.locator("a.stemma-quotation").first().click();
    }],
  ] as const)("a real answer of %s with its body changed is not used", async (path, reach) => {
    const { run, info } = await unused(project());
    const { context, page } = await watched();
    try {
      let changed = 0;
      await page.route(`**${path}`, async (route) => {
        const response = await route.fetch();
        // The real status and proof, and a body that differs by one added space.
        const body = `${await response.text()} `;
        changed++;
        await route.fulfill({ response, body, headers: { ...response.headers(), "content-length": String(Buffer.byteLength(body)) } });
      });
      await page.goto(pathToFileURL(info.launch_file).href);
      if (path !== "/api/boot" && path !== "/api/arras") {
        await searchBox(page).waitFor();
        await reach(page);
      }
      await notice(page, "Stemma’s server has stopped").waitFor({ timeout: 15_000 });
      expect(changed).toBeGreaterThan(0);
      await takenDown(page);
      expect(Object.keys((await stored(page)).session)).toEqual([]);
      await run.stop();
    } finally {
      await context.close();
    }
  }, 60_000);
});

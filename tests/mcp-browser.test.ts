// `open` from the MCP server to the author's page in headless Chromium
// (US-122-AC4): the launch file the opener is given leads to the record asked
// for, and the code leaves the address. Without the browser these are skipped.
import { afterAll, describe, expect, test } from "bun:test";
import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { type Browser, chromium } from "@playwright/test";
import { ISOLATION_FLAGS } from "../packages/cli/src/runtime.ts";
import { shipped } from "./browse-run.ts";
import { ROOT, temporary } from "./helpers.ts";
import { endMcp, McpHost, stubOpener } from "./mcp-run.ts";

const browser: Browser | undefined = await chromium.launch().catch((error: unknown) => {
  if (!String(error).includes("Executable doesn't exist")) throw error;
  console.warn("SKIPPED the MCP server's browser test: headless Chromium is not fetched (./scripts/dev.sh browsers).");
  return undefined;
});
afterAll(async () => {
  await browser?.close();
  await endMcp();
});

describe.skipIf(!browser)("US-122-AC4 in a browser", () => {
  test("open with a record shows that record's page and its source, and a later open another", async () => {
    const dir = join(temporary(), "coral");
    cpSync(join(ROOT, "examples/coral-reefs"), dir, { recursive: true, filter: (from) => !/[\\/](build|\.stemma)$/.test(from) });
    const data = join(temporary(), "data");
    mkdirSync(data);
    const opener = stubOpener();
    const bundle = await shipped();
    const host = McpHost.start([process.execPath, ...ISOLATION_FLAGS, bundle, "mcp", "--opener", opener.program], { PATH: "/usr/bin:/bin", HOME: temporary(), TMPDIR: temporary(), STEMMA_DATA: data, CLAUDE_PROJECT_DIR: dir }, dirname(bundle));
    await host.initialize();
    const context = await browser!.newContext({ viewport: { width: 1400, height: 900 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    let seen = 0;
    for (const [type, record] of [["Citation", "cit-darwinreefs0001"], ["Passage", "psg-t7k8gv4zwswt2qnv46cb"]] as const) {
      if (seen > 0) await Bun.sleep(5_100);
      const opening = host.call("open", { record });
      while (opener.calls().length === seen) await Bun.sleep(20);
      seen = opener.calls().length;
      const code = opener.launched()!.code;
      await page.goto(pathToFileURL(opener.calls().at(-1)!).href);
      await page.locator(".stemma-source mark").first().waitFor({ timeout: 30_000 });
      expect(page.url()).toBe(`${opener.launched()!.address}#/explore/stemma/${type}/${record}`);
      expect(page.url()).not.toContain(code);
      const got = await opening;
      expect(got.data.link_opened_at).toBeDefined();
      expect(got.text).not.toContain(code);
    }
    // An address with anything but a record's route in it gives the page no code to use.
    const stranger = await context.newPage();
    await stranger.goto(`${opener.launched()!.address}#code=${"a".repeat(43)}&to=https://example.invalid/`);
    await stranger.getByRole("heading", { level: 1, name: "This tab has no access" }).waitFor();
    expect(errors).toEqual([]);
    await context.close();
    expect(await host.end()).toBe(0);
  }, 90_000);
});

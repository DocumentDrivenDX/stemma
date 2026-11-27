// Another program takes the port of a served explorer open in headless Chromium
// (US-119-AC10). Without the browser (./scripts/dev.sh browsers) these tests are
// skipped, and say so.
import { afterAll, describe, expect, test } from "bun:test";
import { pathToFileURL } from "node:url";
import { endRuns } from "./browse-run.ts";
import { givenUp, type Impostor, impostor, plausible } from "./browse-impostor.ts";
import { browser, project, searchBox, stored, unused, watched } from "./browse-page.ts";

afterAll(async () => {
  await browser?.close();
  await endRuns();
});

describe.skipIf(!browser)("US-119-AC10 another program that takes the port", () => {
  test.each([
    ["with no proof", (): string | undefined => undefined],
    ["with a made-up proof", (): string | undefined => "A".repeat(43)],
  ] as const)("after the page has loaded, answering 200 with plausible data %s, is not believed", async (_, proof) => {
    const { run, info, code } = await unused(project());
    const { context, page } = await watched();
    let other: Impostor | undefined;
    try {
      await page.goto(pathToFileURL(info.launch_file).href);
      await searchBox(page).waitFor();
      const secret = (await stored(page)).session["stemma.secret"]!;
      await run.stop();
      const answer = plausible(info.data_identity);
      other = impostor(info.address, (path) => ({ ...answer(path), proof: proof() }));
      await givenUp(page, other, [secret, code]);
    } finally {
      other?.stop();
      await context.close();
    }
  }, 60_000);

  test("sending again a real answer with its real proof is not believed", async () => {
    const { run, info, code } = await unused(project());
    const { context, page } = await watched();
    let other: Impostor | undefined;
    try {
      const genuine: Promise<{ body: string; proof: string }>[] = [];
      page.on("response", (response) => {
        if (response.url().endsWith("/api/status")) genuine.push(response.text().then((body) => ({ body, proof: response.headers()["x-stemma-proof"]! })));
      });
      await page.goto(pathToFileURL(info.launch_file).href);
      await searchBox(page).waitFor();
      await Bun.sleep(2500);
      const secret = (await stored(page)).session["stemma.secret"]!;
      const kept = await genuine[0]!;
      expect(kept.proof).toMatch(/^[A-Za-z0-9_-]{43}$/);
      await run.stop();
      other = impostor(info.address, () => kept);
      await givenUp(page, other, [secret, code]);
    } finally {
      other?.stop();
      await context.close();
    }
  }, 60_000);

  test.each(["/api/session", "/api/boot"])("before the page has any data, taking the port ahead of %s, it gets nothing it can use and shows nothing", async (first) => {
    const { run, info, code } = await unused(project());
    const { context, page } = await watched();
    let other: Impostor | undefined;
    try {
      let release!: () => void;
      const held = new Promise<void>((resolve) => (release = resolve));
      let holding = false;
      // The shell and script come from Stemma; the named call is held until the port has changed hands.
      await page.route(`**${first}`, async (route) => {
        holding = true;
        await held;
        await route.continue().catch(() => {});
      });
      await page.goto(pathToFileURL(info.launch_file).href);
      while (!holding) await Bun.sleep(25);
      const secret = (await stored(page)).session["stemma.secret"];
      expect(secret === undefined).toBe(first === "/api/session");
      await run.stop();
      other = impostor(info.address, plausible(info.data_identity));
      release();
      await givenUp(page, other, [code, ...(secret ? [secret] : [])]);
      expect(other.asked[0]!.path).toBe(first);
      if (first === "/api/session") expect(other.asked.map((a) => [a.path, a.body])).toEqual([["/api/session", "{}"]]);
    } finally {
      other?.stop();
      await context.close();
    }
  }, 60_000);
});

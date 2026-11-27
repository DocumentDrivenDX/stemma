// Shared by the served explorer's browser tests (browse-*.test.ts): the browser,
// a copy of the worked example, a run whose code is unused, and a watched page.
// Each test file closes the browser itself: a hook registered here would run after
// only the first file that imports this one.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Browser, chromium, type Page } from "@playwright/test";
import { expect } from "bun:test";
import { codeIn, Run } from "./browse-run.ts";
import { copyExample, temporary } from "./helpers.ts";

export const launch = (args: string[] = []) => chromium.launch({ args }).catch((error: unknown) => {
  if (!String(error).includes("Executable doesn't exist")) throw error;
  console.warn("SKIPPED the served explorer's browser tests: headless Chromium is not fetched (./scripts/dev.sh browsers).");
  return undefined;
});
export const browser: Browser | undefined = await launch();

export function project(): string {
  const dir = join(temporary(), "coral");
  return copyExample(dir);
}

export const HOSTILE = "</script><script>window.__ran=1</script><img src=x onerror=\"window.__ran=2\"> [a](https://example.invalid/m) ‮evil";

export function retitle(dir: string, title: string): string {
  const name = (readdirSync(join(dir, "records"), { recursive: true }) as string[]).sort().find((f) => f.split("/").at(-1)!.startsWith("src-"))!;
  const path = join(dir, "records", name);
  const record = JSON.parse(readFileSync(path, "utf8")) as { id: string; title: { value: string } };
  record.title.value = title;
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`);
  return record.id;
}

/** A run that has printed its launch file and whose code nobody has used. */
export async function unused(dir: string) {
  const run = await Run.command(["browse", "--no-open", "--format", "json", "--project", dir]);
  await run.until(() => run.stdout.includes("\n"));
  const info = JSON.parse(run.stdout.split("\n")[0]!) as { address: string; launch_file: string; data_identity: string };
  return { run, info, code: codeIn(info.launch_file) };
}

export async function watched(context = browser!) {
  const own = await context.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await own.newPage();
  const seen = { requests: [] as string[], sent: [] as string[], errors: [] as string[], dialogs: [] as string[], notFound: [] as string[] };
  own.on("response", (response) => {
    if (response.status() === 404) seen.notFound.push(response.url());
  });
  own.on("request", (request) => {
    seen.requests.push(`${request.method()} ${request.url()}`);
    seen.sent.push(JSON.stringify([request.headers(), request.postData()]));
  });
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") seen.errors.push(message.text());
  });
  page.on("pageerror", (error) => seen.errors.push(String(error)));
  page.on("dialog", (dialog) => {
    seen.dialogs.push(dialog.message());
    void dialog.dismiss();
  });
  return { context: own, page, seen };
}

export const searchBox = (page: Page) => page.getByRole("textbox", { name: /Search/ });
export const notice = (page: Page, title: string) => page.getByRole("heading", { level: 1, name: title });
export const stored = (page: Page) => page.evaluate(() => ({ session: { ...window.sessionStorage }, local: window.localStorage.length, cookie: document.cookie }));
/** No record, source text or banner is on the screen. */
export const takenDown = async (page: Page) => expect(await page.locator("[data-testid=data-identity], .stemma-browser, .stemma-manuscript, mark").count()).toBe(0);

// The served explorer in headless Chromium (US-119): reached through the launch
// file, reading only from its own server, taken down when it can no longer be
// current; and what a hostile page in the same browser can do to the server.
// Fetch the browser with ./scripts/dev.sh browsers; without it these tests are
// skipped, and say so.
import { afterAll, describe, expect, test } from "bun:test";
import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { type Browser, chromium, type Page } from "@playwright/test";
import { createSession, listen } from "@stemma/server";
import { buildServed } from "../packages/explorer/build.ts";
import { responseProof } from "./browse-http.ts";
import { Browsing, codeIn, endRuns, redeem, Run } from "./browse-run.ts";
import { ROOT, temporary } from "./helpers.ts";

const launch = (args: string[] = []) => chromium.launch({ args }).catch((error: unknown) => {
  if (!String(error).includes("Executable doesn't exist")) throw error;
  console.warn("SKIPPED the served explorer's browser tests: headless Chromium is not fetched (./scripts/dev.sh browsers).");
  return undefined;
});
const browser: Browser | undefined = await launch();
afterAll(async () => {
  await browser?.close();
  await endRuns();
});

function project(): string {
  const dir = join(temporary(), "coral");
  cpSync(join(ROOT, "examples/coral-reefs"), dir, { recursive: true, filter: (from) => !/[\\/](build|\.stemma)$/.test(from) });
  return dir;
}

const HOSTILE = "</script><script>window.__ran=1</script><img src=x onerror=\"window.__ran=2\"> [a](https://example.invalid/m) ‮evil";

function retitle(dir: string, title: string): string {
  const name = (readdirSync(join(dir, "records"), { recursive: true }) as string[]).sort().find((f) => f.split("/").at(-1)!.startsWith("src-"))!;
  const path = join(dir, "records", name);
  const record = JSON.parse(readFileSync(path, "utf8")) as { id: string; title: { value: string } };
  record.title.value = title;
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`);
  return record.id;
}

/** A run that has printed its launch file and whose code nobody has used. */
async function unused(dir: string) {
  const run = await Run.command(["browse", "--no-open", "--format", "json", "--project", dir]);
  await run.until(() => run.stdout.includes("\n"));
  const info = JSON.parse(run.stdout.split("\n")[0]!) as { address: string; launch_file: string; data_identity: string };
  return { run, info, code: codeIn(info.launch_file) };
}

async function watched(context = browser!) {
  const own = await context.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await own.newPage();
  const seen = { requests: [] as string[], sent: [] as string[], errors: [] as string[], dialogs: [] as string[] };
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

const searchBox = (page: Page) => page.getByRole("textbox", { name: /Search/ });
const notice = (page: Page, title: string) => page.getByRole("heading", { level: 1, name: title });
const stored = (page: Page) => page.evaluate(() => ({ session: { ...window.sessionStorage }, local: window.localStorage.length, cookie: document.cookie }));
/** No record, source text or banner is on the screen. */
const takenDown = async (page: Page) => expect(await page.locator("[data-testid=data-identity], .stemma-browser, .stemma-manuscript, mark").count()).toBe(0);

describe.skipIf(!browser)("US-119 the served explorer in a browser", () => {
  test("AC1, AC3, AC4, AC6: from the launch file to the source of a citation, through a change, a reload and the server's end", async () => {
    const dir = project();
    const { run, info, code } = await unused(dir);
    const { context, page, seen } = await watched();
    try {
      await page.goto(pathToFileURL(info.launch_file).href);
      await searchBox(page).waitFor();
      // The code is gone from the address, and from the history behind it.
      expect(page.url()).not.toContain(code);
      expect(page.url().startsWith(info.address)).toBe(true);
      expect(existsSync(info.launch_file)).toBe(false);
      const kept = await stored(page);
      expect([Object.keys(kept.session), kept.local, kept.cookie, await context.cookies()]).toEqual([["stemma.secret"], 0, "", []]);
      const secret = kept.session["stemma.secret"]!;
      await page.getByText("Stemma, served from your files on this computer.").waitFor();
      await page.getByTestId("data-identity").filter({ hasText: info.data_identity.slice(0, 12) }).waitFor();

      await searchBox(page).fill("subsidence");
      await page.getByRole("main").getByText(/results for/).waitFor();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

      await page.getByRole("link", { name: "Manuscript", exact: true }).click();
      await page.getByText("This is the manuscript as Stemma read it from your files, not the printed PDF.").waitFor();
      await page.locator("a.stemma-quotation").first().click();
      await page.locator(".stemma-source mark").first().waitFor();
      await page.locator("a.stemma-entry").first().click();
      await page.getByText(/Where the report cites it/).waitFor();
      const citation = (readdirSync(join(dir, "records"), { recursive: true }) as string[]).sort().find((f) => /(^|\/)cit-[^/]+\.json$/.test(f));
      if (citation) {
        await page.goto(`${info.address}#/explore/stemma/Citation/${citation.split("/").at(-1)!.replace(".json", "")}`);
        await page.locator(".stemma-source mark").first().waitFor();
      }

      // A change takes down what is shown, then the new data comes at the same place, with hostile text inert.
      await page.goto(`${info.address}#/explore/stemma/Source`);
      await searchBox(page).waitFor();
      const id = retitle(dir, `Zebra ${HOSTILE}`);
      await notice(page, "The records changed").waitFor({ timeout: 15_000 });
      await takenDown(page);
      await page.getByTestId("data-identity").waitFor({ timeout: 60_000 });
      expect(await page.getByTestId("data-identity").innerText()).not.toBe(info.data_identity.slice(0, 12));
      expect(page.url()).toBe(`${info.address}#/explore/stemma/Source`);
      await page.goto(`${info.address}#/explore/stemma/Source/${id}`);
      await page.getByRole("main").getByRole("heading", { level: 1, name: /^Zebra <\/script><script>/ }).waitFor();
      expect(await page.evaluate(() => (window as { __ran?: number }).__ran)).toBeUndefined();
      expect(await page.locator("img").count()).toBe(0);

      await page.reload();
      await page.getByRole("main").getByRole("heading", { level: 1, name: /^Zebra/ }).waitFor();

      // A tab that was never given the code has no access, and a used code gives none.
      const other = await context.newPage();
      await other.goto(info.address);
      await notice(other, "This tab has no access").waitFor();
      const stranger = await watched();
      await stranger.page.goto(`${info.address}#code=${code}`);
      await notice(stranger.page, "Another page or program opened this link first").waitFor();
      await takenDown(stranger.page);
      expect(stranger.page.url()).not.toContain(code);
      await stranger.context.close();

      const origin = info.address.replace(/\/$/, "");
      const elsewhere = seen.requests.filter((r) => !r.includes(` ${origin}/`) && !r.startsWith("GET file:") && !r.includes(" data:"));
      expect(elsewhere).toEqual([]);
      expect(seen.requests.filter((r) => r.includes(secret) || (r.includes(code) && !r.startsWith("GET file:")))).toEqual([]);
      // Neither is in any header or body the page sent: each only signs. The local file's own address is not sent anywhere.
      expect(seen.sent.length).toBeGreaterThan(20);
      expect(seen.sent.filter((r) => r.includes(secret) || r.includes(code))).toEqual([]);
      // A call made while the records are being read again is answered 503 `index_stale`,
      // which the browser logs whether or not it happens to be caught in that moment.
      expect([seen.errors.filter((e) => !/Failed to load resource.*\b503\b/.test(e)), seen.dialogs]).toEqual([[], []]);

      expect(await run.stop()).toBe(0);
      await notice(page, "Stemma’s server has stopped").waitFor({ timeout: 15_000 });
      await takenDown(page);
      expect(Object.keys((await stored(page)).session)).toEqual([]);
      expect(run.stdout + run.stderr).not.toContain(secret);
    } finally {
      await context.close();
    }
  }, 150_000);

  test("AC4: an answer from other data takes the page down, and so does silence once it has gone on too long", async () => {
    const { run, info } = await unused(project());
    const { context, page } = await watched();
    try {
      await page.goto(pathToFileURL(info.launch_file).href);
      await searchBox(page).waitFor();
      const secret = (await stored(page)).session["stemma.secret"]!;
      await page.route("**/api/query", async (route) => {
        const response = await route.fetch();
        // Proved as the server proves it: only a holder of the secret can make the page read it at all.
        const body = JSON.stringify({ ...(await response.json()), data_identity: "other", result: { data: null, errors: [], marker: "FROM OTHER DATA" } });
        const proof = responseProof(secret, "/api/query", response.status(), body, route.request().headers()["x-stemma-nonce"]!);
        await route.fulfill({ response, body, headers: { ...response.headers(), "content-length": String(Buffer.byteLength(body)), "x-stemma-proof": proof } });
      });
      let slow = 1500;
      await page.route("**/api/status", async (route) => {
        await Bun.sleep(slow);
        await route.continue();
      });
      await searchBox(page).fill("subsidence");
      await notice(page, "The records changed").waitFor();
      await takenDown(page);
      await page.unroute("**/api/query");
      slow = 0;
      await searchBox(page).waitFor({ timeout: 15_000 });
      // The server goes unheard: what is shown is covered.
      let release!: () => void;
      const held = new Promise<void>((resolve) => (release = resolve));
      await page.route("**/api/status", async (route) => {
        await held;
        await route.continue().catch(() => {});
      });
      await notice(page, "Checking that this is current").waitFor({ timeout: 20_000 });
      expect(await searchBox(page).isVisible()).toBe(false);
      release();
      await searchBox(page).waitFor({ timeout: 15_000 });
      await run.stop();
    } finally {
      await context.close();
    }
  }, 90_000);

  test("AC5: a hostile page on another local port, holding even the real code, can neither use it nor read, frame or run anything", async () => {
    const { run, info, code } = await unused(project());
    const target = info.address.replace(/\/$/, "");
    const attacker = Bun.serve({
      hostname: "127.0.0.1", port: 0,
      fetch: () => new Response(`<!doctype html><title>hostile</title>
<form id="f" method="post" enctype="text/plain" action="${target}/api/session" target="sink"><input name='{"code":"${code}","x":"' value='"}'></form>
<form id="g" method="post" action="${target}/api/session" target="sink"><input name="code" value="${code}"></form>
<iframe name="sink"></iframe><iframe id="framed" src="${target}/"></iframe>`, { headers: { "content-type": "text/html" } }),
    });
    const { context, page } = await watched();
    try {
      const posted: [string, number][] = [];
      context.on("response", (response) => {
        if (response.url().startsWith(target) && response.request().method() !== "GET") posted.push([response.request().method(), response.status()]);
      });
      await page.goto(`http://127.0.0.1:${attacker.port}/`);
      for (const form of ["f", "g"]) {
        const answered = context.waitForEvent("response", (r) => r.url() === `${target}/api/session`);
        await page.evaluate((id) => (document.getElementById(id) as HTMLFormElement).submit(), form);
        expect((await answered).status()).toBe(403);
      }
      const tried = await page.evaluate(async ([to, given]) => {
        const attempt = async (init: RequestInit, path = "/api/session") => {
          try {
            const response = await fetch(`${to}${path}`, { method: "POST", body: JSON.stringify({ code: given }), ...init });
            return `read ${response.type} ${response.status} ${await response.text()}`;
          } catch {
            return "failed";
          }
        };
        const script = await new Promise<string>((resolve) => {
          const element = document.createElement("script");
          element.src = `${to}/app.js`;
          element.onload = () => resolve("ran");
          element.onerror = () => resolve("blocked");
          document.body.append(element);
        });
        return [
          await attempt({ headers: { "content-type": "application/json", "x-stemma-request": "1" } }),
          await attempt({ headers: { "content-type": "text/plain" } }),
          await attempt({ mode: "no-cors" }),
          await attempt({ method: "GET", body: null }, "/"),
          script,
        ];
      }, [target, code] as const);
      expect(tried.map((outcome) => outcome.replace("read opaque 0 ", "failed"))).toEqual(["failed", "failed", "failed", "failed", "blocked"]);
      const framed = page.frames().find((f) => f !== page.mainFrame() && f.name() !== "sink");
      expect(await framed?.locator("#root").count().catch(() => 0) ?? 0).toBe(0);
      // Not one of those used the code up.
      expect(posted.filter(([, status]) => status < 400)).toEqual([]);
      expect((await redeem(info, code)).status).toBe(200);
      await run.stop();
    } finally {
      attacker.stop(true);
      await context.close();
    }
  }, 60_000);

  test("AC5: a name that is made to point at this computer is refused (DNS rebinding)", async () => {
    const { run, info, code } = await unused(project());
    const rebinding = (await launch(["--host-resolver-rules=MAP rebind.test 127.0.0.1"]))!;
    try {
      const page = await rebinding.newPage();
      const port = new URL(info.address).port;
      const response = await page.goto(`http://rebind.test:${port}/`);
      expect([response!.status(), await response!.text()]).toEqual([403, expect.stringContaining("forbidden_host")]);
      const call = await page.evaluate(async (given) => {
        const got = await fetch("/api/session", { method: "POST", headers: { "content-type": "application/json", "x-stemma-request": "1" }, body: JSON.stringify({ code: given }) });
        return [got.status, await got.text()];
      }, code);
      expect(call).toEqual([403, expect.stringContaining("forbidden_host")]);
      expect((await redeem(info, code)).status).toBe(200);
      await run.stop();
    } finally {
      await rebinding.close();
    }
  }, 60_000);

  test("when something else redeems the code first, the page says so plainly, and so does the command", async () => {
    const { run, info, code } = await unused(project());
    const { context, page } = await watched();
    try {
      expect((await redeem(info, code)).status).toBe(200);
      await run.until(() => run.stderr.includes("The one-time link was opened at "));
      await page.goto(`${info.address}#code=${code}`);
      await notice(page, "Another page or program opened this link first").waitFor();
      await page.getByText("another program on this computer may have used the link").waitFor();
      await takenDown(page);
      expect(page.url()).not.toContain(code);
      expect(Object.keys((await stored(page)).session)).toEqual([]);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await run.stop();
    } finally {
      await context.close();
    }
  }, 60_000);

  test("an expired code has a notice of its own", async () => {
    const session = createSession(() => {}, 1);
    const server = await listen({ assets: await buildServed(), session, check: async () => ({ state: "rebuilding" }) });
    const { context, page } = await watched();
    try {
      await Bun.sleep(20);
      await page.goto(`${server.address}#code=${session.code}`);
      await notice(page, "This link has expired").waitFor();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    } finally {
      await context.close();
      await server.close();
    }
  }, 60_000);

  test("the notices have no accessibility violations", async () => {
    const one = await Browsing.start(project());
    const { context, page } = await watched();
    try {
      await page.goto(one.info.address);
      await notice(page, "This tab has no access").waitFor();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await one.stop();
    } finally {
      await context.close();
    }
  }, 60_000);
});

const FAKE = "FAKE RECORD FROM ANOTHER PROGRAM";

/** What the page asked of another program, which answers every call with 200 and data of the right shape. */
interface Impostor {
  asked: { path: string; headers: Record<string, string>; body: string }[];
  stop(): void;
}

type Answer = (path: string) => { body: string; proof?: string | undefined };

/** Data as the real server would give it, naming the data the page loaded. */
const plausible = (identity: string): Answer => (path) => ({
  body: JSON.stringify(path === "/api/session" ? { secret: "A".repeat(43) }
    : path === "/api/status" ? { state: "current", data_identity: identity }
    : { data_identity: identity, result: path === "/api/boot" ? { banner: { warnings: [FAKE] }, manuscript_state: "none" } : { data: { marker: FAKE }, errors: [] } }),
});

/** Takes the port a server has just left. */
function impostor(address: string, answer: Answer): Impostor {
  const asked: Impostor["asked"] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1", port: Number(new URL(address).port),
    async fetch(request) {
      const path = new URL(request.url).pathname;
      asked.push({ path, headers: Object.fromEntries(request.headers), body: await request.text() });
      const { body, proof } = answer(path);
      return new Response(body, { headers: { "content-type": "application/json", ...(proof === undefined ? {} : { "x-stemma-proof": proof }) } });
    },
  });
  return { asked, stop: () => void server.stop(true) };
}

/** The page has said it stopped, shows and keeps nothing, and asks no more. */
async function givenUp(page: Page, other: Impostor, kept: string[]) {
  await notice(page, "Stemma’s server has stopped").waitFor({ timeout: 15_000 });
  await takenDown(page);
  expect(await page.content()).not.toContain(FAKE);
  expect(await page.title()).toBe("Stemma explorer");
  expect(Object.keys((await stored(page)).session)).toEqual([]);
  const so = other.asked.length;
  await Bun.sleep(4500);
  expect(other.asked.length).toBe(so);
  // It was sent signatures, never a key.
  expect(other.asked.length).toBeGreaterThan(0);
  for (const key of kept) expect(JSON.stringify(other.asked).includes(key)).toBe(false);
}

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

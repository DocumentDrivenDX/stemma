// The original page beside the highlighted text, in headless Chromium (US-121;
// CONTRACT-005 M, "Originals"; SEC-038, SEC-039): from every place a source view
// appears, with the reason when it cannot be shown, inert for a PDF that tries
// everything, and nothing used before its proof. Everything is invented. Fetch
// the browser with ./scripts/dev.sh browsers; without it these tests are
// skipped, and say so.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { type Browser, chromium, type Locator, type Page } from "@playwright/test";
import { responseProof } from "./browse-http.ts";
import { codeIn, endRuns, Run } from "./browse-run.ts";
import { BLACK_G4, RED_JPX } from "./originals-images.ts";
import { CITATION, folderOf, imageTie, originalPdf, originalPng, PASSAGES, pdfPages, pdfTie, sha, type Tie, writeOriginalsProject } from "./originals-fixture.ts";
import { makePdf } from "./pdf.ts";
import { makePng } from "./png.ts";

const browser: Browser | undefined = await chromium.launch().catch((error: unknown) => {
  if (!String(error).includes("Executable doesn't exist")) throw error;
  console.warn("SKIPPED the original pages' browser tests: headless Chromium is not fetched (./scripts/dev.sh browsers).");
  return undefined;
});
afterAll(async () => {
  await browser?.close();
  await endRuns();
});

interface Seen { requests: string[]; errors: string[]; dialogs: string[]; popups: number; downloads: number; violations: string[]; notFound: string[] }

/** A served run, opened in a page of its own that records everything it should never do. */
async function opened(dir: string, places: string[] = [], viewport = { width: 1500, height: 950 }) {
  const run = await Run.command(["browse", "--no-open", "--format", "json", "--project", dir, ...places.flatMap((p) => ["--originals", p])]);
  await run.until(() => run.stdout.includes("\n"));
  const info = JSON.parse(run.stdout.split("\n")[0]!) as { address: string; launch_file: string };
  const code = codeIn(info.launch_file);
  const context = await browser!.newContext({ viewport, acceptDownloads: true });
  const page = await context.newPage();
  const seen: Seen = { requests: [], errors: [], dialogs: [], popups: 0, downloads: 0, violations: [], notFound: [] };
  await context.exposeBinding("stemmaViolation", (_source, text: string) => void seen.violations.push(text));
  await context.addInitScript(() => document.addEventListener("securitypolicyviolation", (e) => void (window as unknown as { stemmaViolation(t: string): void }).stemmaViolation(`${e.violatedDirective} ${e.blockedURI}`)));
  context.on("request", (request) => void seen.requests.push(`${request.method()} ${request.url()}`));
  context.on("response", (response) => void (response.status() === 404 && seen.notFound.push(response.url())));
  page.on("console", (message) => void (["error", "warning"].includes(message.type()) && seen.errors.push(message.text())));
  page.on("worker", (worker) => worker.on("console", (message) => void (["error", "warning"].includes(message.type()) && seen.errors.push(message.text()))));
  page.on("pageerror", (error) => void seen.errors.push(String(error)));
  page.on("dialog", (dialog) => {
    seen.dialogs.push(dialog.message());
    void dialog.dismiss();
  });
  // Windows the page itself opens; the accessibility checker opens one of its own in the context.
  page.on("popup", () => seen.popups++);
  page.on("download", () => seen.downloads++);
  await page.goto(pathToFileURL(info.launch_file).href);
  await page.getByRole("textbox", { name: /Search/ }).waitFor();
  const origin = info.address.replace(/\/$/, "");
  const go = (hash: string) => page.evaluate((to) => { window.location.hash = to; }, hash);
  return {
    run, info, code, context, page, seen, origin, go,
    /** Nothing but the server was asked, and nothing ran, opened, downloaded or broke the policy. */
    quiet: () => {
      expect(seen.requests.filter((r) => !r.includes(` ${origin}/`) && !r.startsWith("GET file:") && !r.includes(" data:"))).toEqual([]);
      expect({ errors: seen.errors, dialogs: seen.dialogs, popups: seen.popups, downloads: seen.downloads, violations: seen.violations })
        .toEqual({ errors: [], dialogs: [], popups: 0, downloads: 0, violations: [] });
    },
    async end() {
      await context.close();
      await run.stop();
    },
  };
}

const passageRoute = (id: string) => `#/explore/stemma/Passage/${id}`;
const originals = (page: Page) => page.locator(".stemma-original");
const drawn = (page: Page) => page.locator('.stemma-original figure[data-original="drawn"]');
const reasonOf = async (page: Page) => {
  const note = page.locator(".stemma-original [data-original]:not(figure)").first();
  await note.waitFor({ timeout: 20_000 });
  return [await note.getAttribute("data-original"), await note.innerText()] as const;
};

/** The colour of a drawn canvas at a place given as parts of its width and height. */
const colourAt = (canvas: Locator, x: number, y: number) => canvas.evaluate((element: HTMLCanvasElement, [px, py]) => (
  [...element.getContext("2d")!.getImageData(Math.floor(element.width * px!), Math.floor(element.height * py!), 1, 1).data.slice(0, 3)]
), [x, y]);
/** How many pixels of a part of the canvas are not white. */
const inked = (canvas: Locator, [x, y, w, h]: [number, number, number, number]) => canvas.evaluate((element: HTMLCanvasElement, box) => {
  const [left, top, width, height] = box.map((part, i) => Math.floor(part * (i % 2 === 0 ? element.width : element.height))) as [number, number, number, number];
  const data = element.getContext("2d")!.getImageData(left, top, width, height).data;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i]! < 200 || data[i + 1]! < 200 || data[i + 2]! < 200) count++;
  return count;
}, [x, y, w, h]);

describe.skipIf(!browser)("US-121 the original page beside the highlighted text", () => {
  test("US-121-AC1 and AC6: from every place a source view appears, with a PDF that tries scripts, links, forms and an attachment", async () => {
    // Anything the file reaches for would be asked of this.
    const asked: string[] = [];
    const trap = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: (request) => (asked.push(request.url), new Response("")) });
    const pdf = originalPdf({ hostile: { address: `http://127.0.0.1:${trap.port}` } });
    for (const part of ["/JavaScript", "/URI", "/Launch", "/AcroForm", "/XFA", "/EmbeddedFile", "/OpenAction"]) expect(new TextDecoder().decode(pdf)).toContain(part);
    const it = await opened(writeOriginalsProject(pdfTie(pdf)), [folderOf({ "book.pdf": pdf })]);
    const { page, go } = it;
    try {
      const shows = async (where: string, pages: number[]) => {
        await drawn(page).nth(pages.length - 1).waitFor({ timeout: 20_000 });
        expect([where, await drawn(page).count()]).toEqual([where, pages.length]);
        expect(await drawn(page).locator("figcaption").allInnerTexts()).toEqual(pages.map((n) => expect.stringContaining(`Original: Page ${n} of 3 of the PDF.`)));
        for (const caption of await drawn(page).locator("figcaption").allInnerTexts()) expect(caption).toContain("The original is not highlighted. Nothing is marked on it: the highlighted words are in the converted text.");
        // Beside each: the page's text with the highlight, to its left.
        const pair = page.locator(".stemma-pair").first();
        expect(await pair.locator("mark").count()).toBe(1);
        const [text, original] = [await pair.locator("> div").first().boundingBox(), await pair.locator(".stemma-original").boundingBox()];
        expect([where, original!.x >= text!.x + text!.width - 1]).toEqual([where, true]);
        expect(await inked(drawn(page).first().locator("canvas"), [0, 0, 1, 1])).toBeGreaterThan(100);
      };
      await go(passageRoute(PASSAGES.one.id));
      await shows("the record panel of a passage", [2]);
      await go(`#/explore/stemma/Citation/${CITATION}`);
      await page.locator(`section.stemma-source[data-record="${CITATION}"] mark`).waitFor();
      await shows("the record panel of a citation", [2]);
      await go("#/manuscript");
      await page.locator("a.stemma-quotation[data-quotation=two]").first().click();
      // Two pages of one passage, and the first is the page the file's annotations cover.
      await shows("a manuscript quotation", [1, 2]);
      const first = drawn(page).first().locator("canvas");
      expect(await inked(first, [0, 0, 1, 0.2])).toBeGreaterThan(50);
      // The form field's box, with its value, lies low on the page, which has no words there: it is not drawn.
      expect(await inked(first, [0.03, 0.76, 0.94, 0.2])).toBe(0);
      // Clicking where the links lie does nothing, and nothing of a link, field or attachment is in the page.
      const address = page.url();
      for (const at of [{ x: 20, y: 20 }, { x: 100, y: 200 }]) await first.click({ position: at });
      await Bun.sleep(1000);
      expect(page.url()).toBe(address);
      expect(await originals(page).locator("a, input, textarea, select, iframe, embed, object, img, .annotationLayer").count()).toBe(0);
      expect(await page.content()).not.toMatch(/FORM-VALUE|ATTACHED-SECRET|attached\.html/);
      await page.locator("a.stemma-citation").first().click();
      await shows("a note's citation", [2]);
      await page.locator("a.stemma-entry").first().click();
      await page.getByText("Shown first is the first quotation of this work").waitFor();
      await shows("a bibliography entry", [2]);
      expect((await new AxeBuilder({ page }).include(".stemma-source").analyze()).violations).toEqual([]);
      const large = drawn(page).first().getByRole("button", { name: "Larger" });
      await large.click();
      expect(await large.getAttribute("aria-pressed")).toBe("true");
      // One PDF, asked for once, however many of its pages were shown.
      expect(it.seen.requests.filter((r) => r.endsWith("/original")).length).toBe(1);
      expect(asked).toEqual([]);
      it.quiet();
    } finally {
      trap.stop(true);
      await it.end();
    }
  }, 120_000);

  test("US-121-AC6 the JPEG 2000 and CCITT images of scans are drawn by decoders loaded with the page: no script is asked for afterwards", async () => {
    const pdf = makePdf({
      pages: pdfPages,
      images: [
        { page: 1, x: 40, y: 300, width: 16, height: 16, filter: "JPXDecode", entries: "", data: RED_JPX },
        { page: 1, x: 340, y: 300, width: 16, height: 16, filter: "CCITTFaxDecode", entries: "/ColorSpace /DeviceGray /BitsPerComponent 1 /DecodeParms [null << /K -1 /Columns 16 /Rows 16 >>]", data: BLACK_G4 },
      ],
    });
    const it = await opened(writeOriginalsProject(pdfTie(pdf)), [folderOf({ "book.pdf": pdf })]);
    try {
      // The worker has all of its code before any original is asked for; from now on no script can be had.
      await Bun.sleep(1500);
      const scripts = it.seen.requests.filter((r) => r.startsWith("GET ") && /\.js$/.test(r)).map((r) => r.slice(`GET ${it.origin}`.length)).sort();
      expect(scripts).toEqual(["/app.js", "/pdf-worker.js", "/pdfjs/jbig2_nowasm_fallback.js", "/pdfjs/openjpeg_nowasm_fallback.js", "/pdfjs/pdf.worker.min.js"]);
      const before = it.seen.requests.length;
      await it.context.route(/\.(js|wasm|bcmap)$/, (route) => route.abort());
      await it.go(passageRoute(PASSAGES.one.id));
      await drawn(it.page).first().waitFor({ timeout: 20_000 });
      const canvas = drawn(it.page).first().locator("canvas");
      // The images are 200 units square on a page 600 by 800, their lower left corners at 300 units up.
      const [red, black] = [await colourAt(canvas, 140 / 600, 400 / 800), await colourAt(canvas, 440 / 600, 400 / 800)];
      expect(red[0]! > 180 && red[1]! < 80 && red[2]! < 80).toBe(true);
      expect(black.every((v) => v < 60)).toBe(true);
      expect(it.seen.requests.slice(before).filter((r) => r.startsWith("GET "))).toEqual([]);
      it.quiet();
    } finally {
      await it.end();
    }
  }, 60_000);

  test("US-121-AC5 a character map the PDF needs comes by a signed call and is proved like every answer", async () => {
    const pdf = makePdf({ pages: [["港の通行税"], ["港"], ["税"]], font: "japanese" });
    const it = await opened(writeOriginalsProject(pdfTie(pdf)), [folderOf({ "book.pdf": pdf })]);
    try {
      const names: string[] = [];
      it.context.on("request", (request) => void (request.url().endsWith("/pdfjs-data") && names.push((request.postDataJSON() as { name: string }).name)));
      await it.go(passageRoute(PASSAGES.one.id));
      await drawn(it.page).first().waitFor({ timeout: 20_000 });
      expect(names.some((n) => n.startsWith("cmaps/") && n.endsWith(".bcmap"))).toBe(true);
      expect(it.seen.requests.filter((r) => r.includes("bcmap"))).toEqual([]);
      expect([it.seen.violations, it.seen.dialogs]).toEqual([[], []]);
    } finally {
      await it.end();
    }
  }, 60_000);

  test("US-121-AC1 a page image is shown for the part it is numbered for, in a narrow window too", async () => {
    const images = [0, 1, 2].map(originalPng);
    const folder = folderOf(Object.fromEntries(images.map((bytes, i) => [`scan-${i}.png`, bytes])));
    const it = await opened(writeOriginalsProject(imageTie(images)), [folder], { width: 390, height: 800 });
    try {
      await it.go(passageRoute(PASSAGES.one.id));
      await drawn(it.page).first().waitFor({ timeout: 20_000 });
      expect(await drawn(it.page).locator("figcaption").innerText()).toContain("Original: Page image of page index 1.");
      // The second page's band is green.
      expect(await colourAt(drawn(it.page).locator("canvas"), 0.5, 0.25)).toEqual([0, 140, 0]);
      expect(await it.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
      expect(await originals(it.page).locator("img").count()).toBe(0);
      expect((await new AxeBuilder({ page: it.page }).include(".stemma-source").analyze()).violations).toEqual([]);
      it.quiet();
    } finally {
      await it.end();
    }
  }, 60_000);

  const pdf = originalPdf();
  const text = new TextEncoder().encode("%PDF-1.7 but nothing a reader can take");
  const vast = makePng(2, 2, () => [0, 0, 0]);
  // A PNG whose header states 20,000 pixels each way.
  new DataView(vast.buffer).setUint32(16, 20_000);
  new DataView(vast.buffer).setUint32(20, 20_000);
  const fake = new TextEncoder().encode("<svg onload=alert(1)>");

  test.each([
    ["not held", "not_held", "Original not shown: Not held.", { tie: pdfTie(pdf), files: {} }],
    ["a changed file in the cache", "changed", "Original not shown: Digest mismatch.", { tie: pdfTie(pdf), files: {}, cache: { [sha(pdf)]: originalPdf({ labels: "/Nums [0 << /S /D >>]" }) } }],
    ["a TIFF image", "unsupported_type", "A TIFF image is not converted.", { tie: imageTie([0, 1, 2].map(originalPng), "image/tiff"), files: {} }],
    ["no recorded page count", "no_page_mapping", "records no page count for the PDF", { tie: pdfTie(pdf, null), files: { "a.pdf": pdf } }],
    ["a PDF with another number of pages than recorded", "no_page_mapping", "The PDF has 3 pages and the source file records 5", { tie: pdfTie(pdf, 5), files: { "a.pdf": pdf }, manifest: { coverage: "partial", coverage_note: "Only some pages." } }],
    ["a recorded size over the limit", "too_large", "more than the 268435456 this server gives", { tie: { ...pdfTie(pdf), files: [{ sha256: sha(pdf), size: 300_000_000, media_type: "application/pdf" }] }, files: {} }],
    ["a physical original", "physical", "paper or another physical object", { tie: { form: "physical", files: [] }, files: {}, manifest: {}, original: { description: "A bound copy", held_at: "A shelf" } }],
    ["a file that is no PDF though its digest is right", "not_drawn", "could not read this file as a PDF", { tie: pdfTie(text), files: { "a.pdf": text } }],
    ["an image that states a vast size", "not_drawn", "more than the page decodes", { tie: imageTie([vast, vast.slice(), vast.slice()].map((v, i) => new Uint8Array([...v, i]))), files: Object.fromEntries([0, 1, 2].map((i) => [`${i}.png`, new Uint8Array([...vast, i])])) }],
    ["something else recorded as an image", "not_drawn", "does not begin as a image/png image does", { tie: imageTie([0, 1, 2].map((i) => new Uint8Array([...fake, 48 + i]))), files: Object.fromEntries([0, 1, 2].map((i) => [`${i}.png`, new Uint8Array([...fake, 48 + i])])) }],
  ] as [string, string, string, { tie: Tie; files: Record<string, Uint8Array>; cache?: Record<string, Uint8Array>; manifest?: Record<string, unknown>; original?: Record<string, unknown> }][])(
    "US-121-AC2 and AC3: %s: the page says why, and the highlighted text stays", async (_, reason, words, made) => {
      const tie = made.original ? { ...made.tie, ...made.original } : made.tie;
      const dir = writeOriginalsProject(tie, { ...(made.manifest ? { manifest: made.manifest } : {}) });
      for (const [name, bytes] of Object.entries(made.cache ?? {})) {
        mkdirSync(join(dir, ".stemma/originals"), { recursive: true });
        writeFileSync(join(dir, ".stemma/originals", name), bytes);
      }
      const it = await opened(dir, [folderOf(made.files)]);
      try {
        await it.go(passageRoute(PASSAGES.one.id));
        const [got, said] = await reasonOf(it.page);
        expect([got, said.includes(words), said]).toEqual([reason, true, said]);
        expect(await it.page.locator(".stemma-source mark").innerText()).toBe("nothing more is known");
        expect(await drawn(it.page).count()).toBe(0);
        if (reason === "not_held" || reason === "changed") expect(said).toContain("--originals");
        // The browser logs a refusal's status, and the library says that it looked through a broken file; nothing else is said.
        expect(it.seen.errors.filter((e) => !/Failed to load resource.*\b(404|409|415|422)\b|^Warning: Indexing all PDF objects$/.test(e))).toEqual([]);
        expect([it.seen.violations, it.seen.dialogs]).toEqual([[], []]);
      } finally {
        await it.end();
      }
    }, 60_000);

  test("US-121-AC5 an original whose answer is changed is not used: the page takes everything down", async () => {
    const bytes = originalPdf();
    const it = await opened(writeOriginalsProject(pdfTie(bytes)), [folderOf({ "book.pdf": bytes })]);
    try {
      await it.page.route("**/original", async (route) => {
        const response = await route.fetch();
        const body = Buffer.from(await response.body());
        // The real status and proof, with one byte of the file changed.
        body[body.length - 3] = body[body.length - 3]! ^ 1;
        await route.fulfill({ response, body });
      });
      await it.go(passageRoute(PASSAGES.one.id));
      await it.page.getByRole("heading", { level: 1, name: "Stemma’s server has stopped" }).waitFor({ timeout: 15_000 });
      expect(await it.page.locator("canvas, mark, .stemma-browser").count()).toBe(0);
    } finally {
      await it.end();
    }
  }, 60_000);

  test("US-121-AC5 other bytes, even rightly proved, are not drawn: their digest is not the one asked for", async () => {
    const bytes = originalPdf();
    const other = originalPdf({ labels: "/Nums [0 << /S /D >>]" });
    const it = await opened(writeOriginalsProject(pdfTie(bytes)), [folderOf({ "book.pdf": bytes })]);
    try {
      const secret = await it.page.evaluate(() => window.sessionStorage.getItem("stemma.secret")!);
      await it.page.route("**/original", async (route) => {
        const response = await route.fetch();
        const body = Buffer.from(other);
        const proof = responseProof(secret, "/original", 200, body, route.request().headers()["x-stemma-nonce"]!);
        await route.fulfill({ response, body, headers: { ...response.headers(), "content-length": String(body.length), "x-stemma-proof": proof } });
      });
      await it.go(passageRoute(PASSAGES.one.id));
      const [reason, said] = await reasonOf(it.page);
      expect([reason, said.includes("does not have the recorded SHA-256")]).toEqual(["changed", true]);
      expect(await it.page.locator("canvas").count()).toBe(0);
    } finally {
      await it.end();
    }
  }, 60_000);
});

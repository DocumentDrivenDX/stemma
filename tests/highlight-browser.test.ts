// Marks on originals in headless Chromium (US-123; CONTRACT-005 M,
// "Highlighting on originals"): the boxes against the pixels pdf.js draws, from
// every place a source view appears, and the reasons shown when nothing is
// marked. Everything is invented. Fetch the browser with ./scripts/dev.sh
// browsers; without it these tests are skipped, and say so.
import { afterAll, describe, expect, test } from "bun:test";
import { pathToFileURL } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { type Browser, chromium, type Page } from "@playwright/test";
import { createOriginals, createSession, listen, type Verdict } from "@stemma/server";
import { answersOf } from "../packages/server/src/answers.ts";
import { buildServed } from "../packages/explorer/build.ts";
import { servedData } from "../packages/graph/src/export.ts";
import { manuscriptView } from "../packages/publish/src/index.ts";
import { openCorpus } from "../packages/cli/src/context.ts";
import { endRuns, Run } from "./browse-run.ts";
import { line, pageText, rawPdf, stream } from "./highlight-pdf.ts";
import { CITATION, folderOf, imageTie, originalPng, PASSAGES, pdfTie, writeOriginalsProject } from "./originals-fixture.ts";
import { anchorOf, citation, passage } from "./source-view-fixture.ts";

const browser: Browser | undefined = await chromium.launch().catch((error: unknown) => {
  if (!String(error).includes("Executable doesn't exist")) throw error;
  console.warn("SKIPPED the marks on originals' browser tests: headless Chromium is not fetched (./scripts/dev.sh browsers).");
  return undefined;
});
afterAll(async () => {
  await browser?.close();
  await endRuns();
});

/** The size, on the page, of the invented layout's words, and its scale. */
const SIZE = 20;
const SCALE = 1.25;

/**
 * An invented page whose words are placed by most of what moves text: a scaled
 * and shifted coordinate system, character and word spacing, narrowed letters,
 * kerning, leading, and a raised run. `quoted` and `rest` are the fill colors of
 * the words the passage quotes and of all others.
 */
const layout = (quoted: string, rest: string): string => [
  `q ${SCALE} 0 0 ${SCALE} -20 -150 cm`,
  `BT /F1 ${SIZE} Tf 26 TL 0.6 Tc 3 Tw 90 Tz 60 720 Td`,
  `${rest} (Harbour log, an invented page.) Tj T* T*`,
  `[(Boats left the )] TJ ${quoted} [(quay at )-40(dawn and)] TJ`,
  `T* (came back with) Tj ${rest} ( the evening tide.) Tj`,
  `T* (Nobody ) Tj 7 Ts (ever) Tj 0 Ts ( counted them twice.) Tj`,
  "ET Q",
].join("\n");
const QUOTE = "quay at dawn and\ncame back with";
const FULL = rawPdf({ content: layout("0 g", "0 g") });

/** A project whose one page of source text is what the PDF's page gives, with the quotation in it. */
async function project(bytes: Uint8Array, words = QUOTE, text?: string): Promise<string> {
  const pages = [{ label: "1", blocks: [{ role: "undetermined", content: text ?? await pageText(bytes) }] }];
  const one = passage(PASSAGES.one.id, [anchorOf(pages, 0, "main", words)], words, { locator: { label: "page", value: "1" } });
  return writeOriginalsProject(pdfTie(bytes, 1), { pages, records: [one, citation(CITATION, one)] });
}

async function opened(dir: string, places: string[], viewport = { width: 1500, height: 950 }) {
  const run = await Run.command(["browse", "--no-open", "--format", "json", "--project", dir, ...places.flatMap((p) => ["--originals", p])]);
  await run.until(() => run.stdout.includes("\n"));
  const info = JSON.parse(run.stdout.split("\n")[0]!) as { launch_file: string; address: string };
  return { ...await visit(pathToFileURL(info.launch_file).href, viewport), run, origin: info.address };
}

async function visit(address: string, viewport = { width: 1500, height: 950 }) {
  const context = await browser!.newContext({ viewport });
  const page = await context.newPage();
  const wrong: string[] = [];
  await context.exposeBinding("stemmaViolation", (_source, text: string) => void wrong.push(text));
  await context.addInitScript(() => document.addEventListener("securitypolicyviolation", (e) => void (window as unknown as { stemmaViolation(t: string): void }).stemmaViolation(`${e.violatedDirective} ${e.blockedURI}`)));
  page.on("console", (message) => void (["error", "warning"].includes(message.type()) && wrong.push(message.text())));
  page.on("pageerror", (error) => void wrong.push(String(error)));
  await page.goto(address);
  await page.getByRole("textbox", { name: /Search/ }).waitFor();
  return { context, page, wrong, go: (hash: string) => page.evaluate((to) => { window.location.hash = to; }, hash) };
}

const figure = (page: Page) => page.locator('.stemma-original figure[data-original="drawn"]').first();
const settled = async (page: Page): Promise<string> => {
  const found = page.locator('.stemma-original figure[data-original="drawn"]:not([data-highlight="asking"])').first();
  await found.waitFor({ timeout: 30_000 });
  return (await found.getAttribute("data-highlight"))!;
};

interface Canvas { width: number; height: number; dark: number[] }
/** The pixels pdf.js made dark, as positions in the canvas. */
const darkPixels = (page: Page): Promise<Canvas> => figure(page).locator("canvas").evaluate((element: HTMLCanvasElement) => {
  const { data } = element.getContext("2d")!.getImageData(0, 0, element.width, element.height);
  const dark: number[] = [];
  for (let i = 0; i < data.length; i += 4) if (data[i]! < 140) dark.push(i / 4);
  return { width: element.width, height: element.height, dark };
});

/** Each box as laid out on the screen, as fractions of the canvas as laid out. */
const shownBoxes = (page: Page) => figure(page).evaluate((element) => {
  const canvas = element.querySelector("canvas")!.getBoundingClientRect();
  return [...element.querySelectorAll(".stemma-box")].map((box) => {
    const at = box.getBoundingClientRect();
    return { left: (at.left - canvas.left) / canvas.width, top: (at.top - canvas.top) / canvas.height, right: (at.right - canvas.left) / canvas.width, bottom: (at.bottom - canvas.top) / canvas.height };
  });
});

describe.skipIf(!browser)("US-123 the quoted words marked on the original", () => {
  test("US-123-AC1: every pixel of the quoted words is in a box, no pixel of any other word is, and the screen is tinted there and nowhere else", async () => {
    // The same layout with only the quoted words drawn in black, and with only the others.
    const inkOf = async (bytes: Uint8Array): Promise<Canvas> => {
      const it = await opened(await project(bytes), [folderOf({ "a.pdf": bytes })]);
      try {
        await it.go(`#/explore/stemma/Passage/${PASSAGES.one.id}`);
        await settled(it.page);
        return await darkPixels(it.page);
      } finally {
        await it.context.close();
        await it.run.stop();
      }
    };
    const quoted = await inkOf(rawPdf({ content: layout("0 g", "1 g") }));
    const others = await inkOf(rawPdf({ content: layout("1 g", "0 g") }));
    expect(quoted.dark.length).toBeGreaterThan(5000);
    expect(others.dark.length).toBeGreaterThan(5000);

    const it = await opened(await project(FULL), [folderOf({ "a.pdf": FULL })]);
    try {
      await it.go(`#/explore/stemma/Passage/${PASSAGES.one.id}`);
      expect(await settled(it.page)).toBe("boxes");
      const full = await darkPixels(it.page);
      expect([full.width, full.height]).toEqual([quoted.width, quoted.height]);
      const boxes = await shownBoxes(it.page);
      expect(boxes.length).toBe(2);
      /** Which box a canvas pixel lies in, with a pixel's allowance for drawing at the edge. */
      const boxOf = (pixel: number, allow: number) => {
        const x = (pixel % full.width) + 0.5;
        const y = Math.floor(pixel / full.width) + 0.5;
        return boxes.findIndex((b) => x >= b.left * full.width - allow && x <= b.right * full.width + allow && y >= b.top * full.height - allow && y <= b.bottom * full.height + allow);
      };
      expect(quoted.dark.filter((p) => boxOf(p, 1.5) < 0)).toEqual([]);
      expect(others.dark.filter((p) => boxOf(p, -1) >= 0)).toEqual([]);
      // Tight: in each box the ink reaches close to both ends, within the space a letter's side leaves.
      const em = (SIZE * SCALE * full.width) / 600;
      for (const [i, box] of boxes.entries()) {
        const across = quoted.dark.filter((p) => boxOf(p, 1.5) === i).map((p) => p % full.width);
        expect(Math.min(...across) - box.left * full.width).toBeLessThan(0.15 * em);
        expect(box.right * full.width - Math.max(...across)).toBeLessThan(0.15 * em);
        // And no taller than the line it marks.
        expect((box.bottom - box.top) * full.height).toBeLessThan(1.35 * em);
      }

      // What the screen shows: yellow around the quoted ink, and none at the other words.
      const sheet = figure(it.page).locator(".stemma-leaf");
      const shot = await sheet.screenshot();
      const blank = await it.context.newPage();
      const tinted = await blank.evaluate(async (data) => {
        const picture = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
        const canvas = new OffscreenCanvas(picture.width, picture.height);
        const context = canvas.getContext("2d")!;
        context.drawImage(picture, 0, 0);
        const pixels = context.getImageData(0, 0, picture.width, picture.height).data;
        const found: number[] = [];
        for (let i = 0; i < pixels.length; i += 4) if (pixels[i]! > 200 && pixels[i + 1]! > 180 && pixels[i + 2]! < 190) found.push(i / 4);
        return { width: picture.width, height: picture.height, found };
      }, shot.toString("base64"));
      const share = (ink: Canvas) => {
        const yellow = new Set(tinted.found);
        // Whether the screen is yellow within two pixels of where a canvas pixel is shown.
        const near = (p: number) => {
          const x = Math.round((((p % ink.width) + 0.5) / ink.width) * tinted.width);
          const y = Math.round(((Math.floor(p / ink.width) + 0.5) / ink.height) * tinted.height);
          return [-2, -1, 0, 1, 2].some((dx) => [-2, -1, 0, 1, 2].some((dy) => yellow.has((y + dy) * tinted.width + x + dx)));
        };
        return ink.dark.filter(near).length / ink.dark.length;
      };
      expect(share(quoted)).toBeGreaterThan(0.99);
      expect(share(others)).toBeLessThan(0.01);

      const caption = await figure(it.page).locator("figcaption").innerText();
      expect(caption).toContain("Highlighted on the original. The boxes are positions from the PDF’s text layer.");
      expect(caption).not.toContain("not highlighted");
      expect(await figure(it.page).locator("canvas").getAttribute("aria-label")).toContain("with boxes marking the quoted words");

      // From the manuscript's quotation, its citation, and its bibliography entry too.
      await it.go("#/manuscript");
      await it.page.locator("a.stemma-quotation[data-quotation=one]").first().click();
      expect(await settled(it.page)).toBe("boxes");
      await it.page.locator("a.stemma-citation").first().click();
      await it.page.locator(".stemma-pane .stemma-box").first().waitFor();
      await it.page.locator("a.stemma-entry").first().click();
      await it.page.getByText("Shown first is the first quotation of this work").waitFor();
      expect(await settled(it.page)).toBe("boxes");
      expect(await it.page.locator(".stemma-pane mark").count()).toBe(1);
      if (process.env.STEMMA_SCREENSHOT) await it.page.screenshot({ path: process.env.STEMMA_SCREENSHOT });
      expect((await new AxeBuilder({ page: it.page }).include(".stemma-source").analyze()).violations).toEqual([]);
      // The boxes stay with the words when the page is made larger.
      const before = await shownBoxes(it.page);
      await figure(it.page).getByRole("button", { name: "Larger" }).click();
      const after = await shownBoxes(it.page);
      for (const [i, box] of after.entries()) for (const side of ["left", "top", "right", "bottom"] as const) expect(box[side]).toBeCloseTo(before[i]![side], 2);
      expect(it.wrong).toEqual([]);
    } finally {
      await it.context.close();
      await it.run.stop();
    }
  }, 180_000);

  test("US-123-AC2, AC4 and AC5: the page says why nothing is marked, for a scan's recognition layer, covered words, other text, and a page image", async () => {
    const picture = stream("/Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /ASCIIHexDecode", "f0>");
    const words = "A scanned page of an invented book.";
    const scan = rawPdf({ content: `q 600 0 0 800 0 0 cm /Im Do Q\nBT 3 Tr ET\n${line(words)}`, resources: "/XObject << /Im 6 0 R >>", objects: [picture] });
    const covered = rawPdf({ content: `${line(words)}\n90 690 80 30 re f` });
    const other = await pageText(rawPdf({ content: line(words) }));
    const cases = [
      ["recognition_layer", scan, undefined, "The only positions are those of an invisible text layer over an image"],
      ["covered", covered, undefined, "Something else is painted over or under quoted words"],
      ["text_differs", rawPdf({ content: line(words.replace("book", "tome")) }), other, "not exactly the source text’s page"],
    ] as const;
    for (const [expected, bytes, text, why] of cases) {
      const it = await opened(await project(bytes, "scanned page", text), [folderOf({ "a.pdf": bytes })]);
      try {
        await it.go(`#/explore/stemma/Passage/${PASSAGES.one.id}`);
        expect(await settled(it.page)).toBe(expected);
        const caption = await figure(it.page).locator("figcaption").innerText();
        expect(caption).toContain("The original is not highlighted.");
        expect(caption).toContain(why);
        expect(await it.page.locator(".stemma-box").count()).toBe(0);
        expect(await it.page.locator("section.stemma-source mark").innerText()).toBe("scanned page");
        expect(it.wrong).toEqual([]);
      } finally {
        await it.context.close();
        await it.run.stop();
      }
    }
    const images = [0, 1, 2].map(originalPng);
    const it = await opened(writeOriginalsProject(imageTie(images)), [folderOf(Object.fromEntries(images.map((bytes, i) => [`${i}.png`, bytes])))]);
    try {
      await it.go(`#/explore/stemma/Passage/${PASSAGES.one.id}`);
      expect(await settled(it.page)).toBe("page_image");
      expect(await figure(it.page).locator("figcaption").innerText()).toContain("A page image holds no word positions");
      expect(await it.page.locator(".stemma-box").count()).toBe(0);
    } finally {
      await it.context.close();
      await it.run.stop();
    }
  }, 180_000);

  test("US-123-AC6: boxes over nothing drawn, or for another page or file, are not shown", async () => {
    const dir = await project(FULL);
    const corpus = openCorpus(dir);
    const data = servedData(corpus, { version: "0", manuscript: (exported) => manuscriptView(corpus, [], exported) });
    const answer = await answersOf(data);
    const verdict: Verdict = { state: "current", data_identity: data.data_identity, process: { ask: answer } as never };
    const assets = await buildServed();
    const nowhere = { left: 0.7, top: 0.8, width: 0.2, height: 0.05 };
    // The one is over blank paper; the others name another page and another file.
    const answers = [
      ["pixels_disagree", {}],
      ["failed", { page: 2 }],
      ["failed", { sha256: "0".repeat(64) }],
    ] as const;
    for (const [expected, change] of answers) {
      const session = createSession(() => {});
      const server = await listen({
        assets, session, check: async () => verdict, originals: createOriginals(dir, [folderOf({ "a.pdf": FULL })]),
        highlighter: { place: async (target) => ({ state: "boxes", sha256: target.sha256, page: target.page, page_count: target.page_count, boxes: [nowhere], ...change }), close: () => {} },
      });
      const it = await visit(`${server.address}#code=${session.code}`);
      try {
        await it.go(`#/explore/stemma/Passage/${PASSAGES.one.id}`);
        expect(await settled(it.page)).toBe(expected);
        expect(await it.page.locator(".stemma-box").count()).toBe(0);
        expect(await figure(it.page).locator("figcaption").innerText()).toContain("The original is not highlighted.");
      } finally {
        await it.context.close();
        await server.close();
      }
    }
  }, 120_000);
});

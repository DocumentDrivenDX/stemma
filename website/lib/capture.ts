// Photographs the pages in screens.ts with the project-local Chromium.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { FONTS, fontFaces, fontFile, type screenshotPlan, sha, SUBSETS } from "./screens.ts";

export async function capture(plan: ReturnType<typeof screenshotPlan>, outdir: string): Promise<void> {
  mkdirSync(outdir, { recursive: true });
  const work = mkdtempSync(join(tmpdir(), "stemma-shots-"));
  for (const font of FONTS) {
    for (const subset of SUBSETS) {
      const name = fontFile(font.pkg, subset);
      writeFileSync(join(work, name), readFileSync(join(import.meta.dir, "../../node_modules/@fontsource-variable", font.pkg, "files", name)));
    }
  }
  const browser = await chromium.launch();
  try {
    const manifest = [];
    for (const { html, ...shot } of plan) {
      const context = await browser.newContext({ viewport: { width: shot.width, height: 100 }, deviceScaleFactor: shot.width < 500 ? 2 : 1.5, colorScheme: shot.appearance });
      const page = await context.newPage();
      const path = join(work, shot.file.replace(".png", ".html"));
      writeFileSync(path, html.replace("/*fonts*/", fontFaces("./")));
      await page.goto(pathToFileURL(path).href);
      await page.evaluate("document.fonts.ready");
      const png = await page.screenshot({ fullPage: true, animations: "disabled" });
      writeFileSync(join(outdir, shot.file), png);
      manifest.push({ ...shot, png_sha256: sha(png) });
      await context.close();
    }
    writeFileSync(join(outdir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  } finally {
    await browser.close();
    rmSync(work, { recursive: true, force: true });
  }
}

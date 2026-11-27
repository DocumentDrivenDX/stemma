// Builds the static website into website/dist/ (git-ignored): HTML from
// lib/pages.ts, one Tailwind stylesheet, and local copies of fonts, the mark,
// screenshots and reports. No page needs JavaScript or the network.
//   ./scripts/dev.sh site
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PAGES, render } from "./lib/pages.ts";
import { siteFonts } from "./lib/fonts.ts";

const ROOT = join(import.meta.dir, "..");
const OUT = join(import.meta.dir, "dist");

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "fonts"), { recursive: true });
for (const page of PAGES) writeFileSync(join(OUT, page.file), render(page));

const tailwind = Bun.spawnSync([
  process.execPath, "--no-install", "--no-env-file", "--config=/dev/null", "--bun",
  join(ROOT, "node_modules/.bin/tailwindcss"), "--input", "website/src/site.css", "--output", join(OUT, "tailwind.css"), "--minify",
], { cwd: ROOT });
if (tailwind.exitCode !== 0) throw new Error(tailwind.stderr.toString());
const styles = await Bun.file(join(OUT, "tailwind.css")).text();
const fonts = siteFonts("fonts/");
writeFileSync(join(OUT, "site.css"), `${fonts.css}\n${styles}`);
rmSync(join(OUT, "tailwind.css"));

for (const { pkg, file } of fonts.files) cpSync(join(ROOT, "node_modules/@fontsource-variable", pkg, "files", file), join(OUT, "fonts", file));
for (const pkg of new Set(fonts.files.map((f) => f.pkg))) cpSync(join(ROOT, "node_modules/@fontsource-variable", pkg, "LICENSE"), join(OUT, "fonts", `LICENSE-${pkg}.txt`));
cpSync(join(import.meta.dir, "src/mark.svg"), join(OUT, "mark.svg"));
cpSync(join(import.meta.dir, "generated/screenshots"), join(OUT, "screenshots"), { recursive: true, filter: (path) => !path.endsWith(".json") });
cpSync(join(import.meta.dir, "generated/reports"), join(OUT, "reports"), { recursive: true });
// The whole transcripts that a page shows only in part.
cpSync(join(import.meta.dir, "recorded"), join(OUT, "recorded"), { recursive: true });
console.log(`built ${PAGES.length} pages in website/dist/\nopen it with ./scripts/dev.sh preview`);

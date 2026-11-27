// The site's @font-face rules and the font files they need. Unlike the captured
// pages (screens.ts), the site takes Source Serif 4 with its optical size axis
// and its own italic, for display headings and quoted words.
import { RANGES, SUBSETS } from "./screens.ts";

const FACES = [
  { family: "Inter", pkg: "inter", axes: "wght", style: "normal", weight: "100 900" },
  { family: "Source Serif 4", pkg: "source-serif-4", axes: "opsz", style: "normal", weight: "200 900" },
  { family: "Source Serif 4", pkg: "source-serif-4", axes: "opsz", style: "italic", weight: "200 900" },
  { family: "JetBrains Mono", pkg: "jetbrains-mono", axes: "wght", style: "normal", weight: "100 800" },
];

export function siteFonts(base: string): { css: string; files: { pkg: string; file: string }[] } {
  const faces = FACES.flatMap((f) => SUBSETS.map((subset) => ({ ...f, subset, file: `${f.pkg}-${subset}-${f.axes}-${f.style}.woff2` })));
  return {
    css: faces.map((f) =>
      `@font-face{font-family:"${f.family}";font-style:${f.style};font-weight:${f.weight};font-display:block;src:url("${base}${f.file}") format("woff2");unicode-range:${RANGES[f.subset]}}`).join("\n"),
    files: faces.map(({ pkg, file }) => ({ pkg, file })),
  };
}

// The pages that are photographed. Each holds real command output from a
// generated transcript and says on its face that it is not a terminal window.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { escape, excerpt } from "./html.ts";

export const sha = (bytes: string | Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

export const FONTS = [
  { family: "Inter", pkg: "inter", style: "normal", weight: "100 900" },
  { family: "Source Serif 4", pkg: "source-serif-4", style: "normal", weight: "200 900" },
  { family: "JetBrains Mono", pkg: "jetbrains-mono", style: "normal", weight: "100 800" },
];
export const SUBSETS = ["latin", "latin-ext"] as const;
const RANGES = {
  latin: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
  "latin-ext": "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF",
};
export const fontFile = (pkg: string, subset: string) => `${pkg}-${subset}-wght-normal.woff2`;

export function fontFaces(base: string): string {
  return FONTS.flatMap((f) => SUBSETS.map((subset) =>
    `@font-face{font-family:"${f.family}";font-style:${f.style};font-weight:${f.weight};font-display:block;src:url("${base}${fontFile(f.pkg, subset)}") format("woff2");unicode-range:${RANGES[subset]}}`)).join("\n");
}

/** Lines of a transcript from the first match up to, not including, the second. */
function between(text: string, from: string, to?: string): string {
  const start = text.indexOf(from);
  const end = to ? text.indexOf(to, start + from.length) : text.length;
  if (start < 0 || end < 0) throw new Error(`transcript no longer holds "${from}" or "${to}"`);
  return text.slice(start, end).trimEnd();
}

interface Spec { file: string; title: string; alt: string; appearance: "light" | "dark"; width: number; command: string; text: (t: (path: string) => string) => string }

const seeded = (t: (path: string) => string) => between(t("transcripts/check-seeded.txt"), "$ stemma", "\n4. ");
const SPECS: Spec[] = [
  ...(["light", "dark"] as const).map((appearance): Spec => ({
    file: `check-findings-${appearance}.png`, appearance, width: 880, title: "check: the first three findings in the test fixture",
    alt: "Output of stemma check: an OPEN FINDINGS summary, then numbered findings, each with why it matters, what to do and where.",
    command: "From the seeded test fixture. The output continues below the third finding.", text: seeded,
  })),
  {
    file: "check-findings-phone.png", appearance: "light", width: 375, title: "check: findings at phone width",
    alt: "The same findings wrapped to a narrow page.", command: "From the seeded test fixture, cut after the third finding.", text: seeded,
  },
  {
    file: "demo-first-check.png", appearance: "light", width: 880, title: "check: a mistyped citation key",
    alt: "Output of stemma check in the demo: an uncited source, a citation key no source holds, and a file not in canonical form.",
    command: "From the demo run. All names and sources are invented.",
    text: (t) => between(t("transcripts/demo.txt"), "$ stemma check --project $DEMO/book", "\n=============== 4."),
  },
  {
    file: "check-quotations.png", appearance: "light", width: 880, title: "check: a quotation that differs, and a page outside the source",
    alt: "Output of stemma check: a cited page outside the mapped pages, a quotation shown beside the closest stored text, and a note that one quotation matched after joining a word split at a line end.",
    command: "From the demo run. All names and sources are invented.",
    text: (t) => between(t("transcripts/demo.txt"), "$ stemma check --project $DEMO/quoting-book", "\n=============== 10."),
  },
  {
    file: "check-clean.png", appearance: "light", width: 880, title: "check: checked clean, with nothing cited",
    alt: "Output of stemma check saying CHECKED CLEAN, followed by what that label does not mean.",
    command: "From the clean test fixture. The label says nothing about citations, because this project has none.",
    text: (t) => t("transcripts/check-clean.txt").trimEnd(),
  },
];

export const LABEL = "Rendered page, not a terminal window.";
// Change this when lib/capture.ts changes how a page is photographed.
const CAPTURE = "capture 2: viewport 100 high, full page";

export function screenshotPlan(files: Map<string, string>) {
  const read = (path: string) => {
    const text = files.get(path);
    if (text === undefined) throw new Error(`no generated file ${path}`);
    return text;
  };
  const css = ["../src/tokens.css", "../src/report.css"].map((p) => readFileSync(join(import.meta.dir, p), "utf8")).join("\n");
  const versions = ["@fontsource-variable/inter", "@fontsource-variable/jetbrains-mono", "@fontsource-variable/source-serif-4", "@playwright/test"]
    .map((name) => `${name}@${JSON.parse(readFileSync(join(import.meta.dir, "../../package.json"), "utf8")).devDependencies[name]}`).join(" ");
  return SPECS.map(({ command, text, ...spec }) => {
    const body = excerpt(`<strong>${LABEL}</strong> Real output of the stemma command line. ${escape(command)}`, text(read));
    const html = `<!doctype html><html lang="en" data-appearance="${spec.appearance}"><meta charset="utf-8"><title>${escape(spec.title)}</title><style>\n/*fonts*/\n${css}\nbody{margin:0;padding:16px;background:var(--arras-color-ground)}</style><body>${body}</body></html>`;
    return { ...spec, html, input_sha256: sha(`${versions}\n${spec.width}\n${CAPTURE}\n${html}`) };
  });
}

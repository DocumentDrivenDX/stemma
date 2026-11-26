// WCAG 2.2 contrast, and the color tokens read from src/tokens.css so that the
// design page and its tests cannot drift from the stylesheet.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface Token { name: string; light: string; dark: string }

export function colorTokens(css = readFileSync(join(import.meta.dirname, "../src/tokens.css"), "utf8")): Token[] {
  return [...css.matchAll(/(--(?:arras|stm)-color-[a-z-]+): light-dark\((#[0-9a-f]{6}), (#[0-9a-f]{6})\);/g)]
    .map((m) => ({ name: m[1]!, light: m[2]!, dark: m[3]! }));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

export const BACKGROUNDS = ["--arras-color-ground", "--arras-color-surface", "--arras-color-surface-sunken"];

/** Every pairing the design allows to carry meaning, with the WCAG floor it must meet. */
export const PAIRS: { fg: string; bg: string; floor: number }[] = [
  ...["--arras-color-text", "--arras-color-text-muted", "--arras-color-accent",
    "--stm-color-ok", "--stm-color-warn", "--stm-color-bad"].flatMap((fg) => BACKGROUNDS.map((bg) => ({ fg, bg, floor: 4.5 }))),
  ...BACKGROUNDS.map((bg) => ({ fg: "--stm-color-line-strong", bg, floor: 3 })),
  { fg: "--arras-color-on-accent", bg: "--arras-color-accent", floor: 4.5 },
];

export function measured(mode: "light" | "dark") {
  const value = new Map(colorTokens().map((t) => [t.name, t[mode]]));
  return PAIRS.map((p) => ({ ...p, ratio: contrast(value.get(p.fg)!, value.get(p.bg)!) }));
}

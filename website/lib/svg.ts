// The site's treatment of a drawing Lini made, so that it can be written into a
// page: its embedded stylesheet and title caption come out, the view box is
// trimmed to the drawing, colors become tokens, and it gets a name for a screen
// reader. site.css colors what is left (DESIGN.md, Generated diagrams). Anything
// this does not expect fails, so that a change in the renderer is seen. Pure text
// work: it loads nothing.
import { escape } from "./html.ts";

/** Colors Lini writes into some forms, as the tokens that stand for them. */
export const COLORS: Record<string, string> = {
  "var(--lini-stroke)": "var(--stm-color-line-strong)",
};

/** The classes of the renderer that site.css styles. Another one fails the run. */
const CLASSES = new Set([
  "lini-scene", "lini-links", "lini-node", "lini-block", "lini-group", "lini-box", "lini-text", "lini-link",
  "lini-marker", "lini-marker-arrow", "lini-path", "lini-note", "lini-cyl", "lini-cell",
]);
const STYLE_PROPERTIES = new Set(["font-family", "fill", "stroke", "stroke-width", "stroke-dasharray"]);
const NUMBERS = /^[0-9., ]+$/;

/** What may never be in a drawing written into a page. */
export const UNSAFE: [RegExp, string][] = [
  [/<(script|style|foreignObject|iframe|image|use|a|object|embed)\b/i, "an element that is not allowed"],
  [/\son[a-z]+\s*=/i, "an event handler"],
  [/\b(xlink:)?href\s*=/i, "a link"],
  [/url\s*\(|@import/i, "a reference to another file"],
  [/https?:\/\//i, "a web address"],
  [/#[0-9a-f]{3,8}\b|\b(rgb|rgba|hsl|hsla|light-dark)\s*\(/i, "a color that is not a token"],
  [/\/Users\/|\/home\/[a-z]|\/var\/folders\/|\/private\/(?:tmp|var)\/|\/tmp\/|[A-Z]:\\Users\\/, "a local path"],
];

export interface Treatment {
  /** Unique among the drawings of a page. */
  key: string;
  title: string;
  desc: string;
  /** Each box: the renderer's ID for it, its label, and whether it takes a double or heavier border. */
  nodes: { native: string; label: string; focus?: boolean; doubled?: boolean }[];
  /** Lines drawn dashed with a bar end, by the renderer's IDs of the boxes they join. */
  opposing: { from: string; to: string }[];
}

const INSET = 28;
/** An opposing line's bar: its length against the arrowhead's base, and how far from the base to the tip it stands. */
const BAR_WIDTH = 1.7;
const BAR_AT = 0.35;

/** Replaces each style attribute's declarations with allowed ones. */
function styles(svg: string): string {
  return svg.replace(/ style="([^"]*)"/g, (_whole, value: string) => {
    const kept = value.split(";").map((d) => d.trim()).filter(Boolean).flatMap((declaration) => {
      const at = declaration.indexOf(":");
      const [property, set] = [declaration.slice(0, at).trim(), declaration.slice(at + 1).trim()];
      if (!STYLE_PROPERTIES.has(property)) throw new Error(`unknown style property in a drawing: ${property}`);
      // The page sets the font.
      if (property === "font-family") return [];
      if (property === "fill" || property === "stroke") {
        if (set === "none") return [`${property}: none`];
        const token = COLORS[set.toLowerCase()];
        if (!token) throw new Error(`unknown color in a drawing: ${set}`);
        return [`${property}: ${token}`];
      }
      if (!NUMBERS.test(set)) throw new Error(`unknown ${property} in a drawing: ${set}`);
      return [`${property}: ${set}`];
    });
    return kept.length > 0 ? ` style="${kept.join("; ")}"` : "";
  });
}

/** Where the group opened before `from` closes. */
function closing(svg: string, from: number): number {
  const tags = /<g\b[^>]*?(\/?)>|<\/g>/g;
  tags.lastIndex = from;
  let depth = 1;
  for (let found = tags.exec(svg); found; found = tags.exec(svg)) {
    if (found[0] === "</g>") depth -= 1;
    else if (found[1] !== "/") depth += 1;
    if (depth === 0) return found.index;
  }
  throw new Error("a drawing's groups do not close");
}

const plain = (text: string): string =>
  text.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'").replaceAll("&#39;", "'").replaceAll("&amp;", "&");

const attribute = (tag: string, name: string): number => {
  const found = new RegExp(`\\s${name}="(-?[0-9.]+)"`).exec(tag);
  if (!found) throw new Error(`a drawing's ${name} is missing from ${tag}`);
  return Number(found[1]);
};

/** The pairs of numbers at which a path made of M, L and A commands arrives. */
function pathPoints(d: string): [number, number][] {
  return [...d.matchAll(/([MLA])([^MLA]*)/g)].map(([, command, rest]) => {
    const values = rest!.trim().split(/[ ,]+/).map(Number);
    if (values.length !== (command === "A" ? 7 : 2) || values.some(Number.isNaN)) throw new Error(`a line is drawn in a way not expected: ${d}`);
    return values.slice(-2) as [number, number];
  });
}

export function treat(raw: string, t: Treatment): string {
  // The renderer's stylesheet and its empty definitions.
  let svg = raw.replace(/\s*<style>[\s\S]*?<\/style>/, "").replace(/\s*<defs\/>/, "");
  // The title, drawn as a caption: the figure's own caption says it.
  svg = svg.replace(/\s*<g class="lini-node lini-caption lini-block"[^>]*>(?:(?!<g\b)[\s\S])*?<\/g>/g, "");

  for (const found of svg.matchAll(/\sclass="([^"]*)"/g)) {
    for (const name of found[1]!.split(/\s+/)) {
      if (name !== "lini" && !CLASSES.has(name) && !/^lini-scope-[0-9a-f]+$/.test(name) && !/^lini-style-e\d+$/.test(name)) {
        throw new Error(`unknown class in a drawing: ${name}`);
      }
    }
  }
  svg = styles(svg);
  svg = svg.replace(/ lini-style-e\d+/g, "");
  if (/\sid="/.test(svg)) throw new Error("a drawing has an ID of the renderer's own, which would repeat on a page");

  // The view box: the outermost group's rectangle, less its padding.
  const root = /data-id="visual"[^>]*>\s*(<rect [^>]*\/>)/.exec(svg);
  if (!root) throw new Error("a drawing has no outermost group");
  const box = {
    x: attribute(root[1]!, "x") + INSET, y: attribute(root[1]!, "y") + INSET,
    width: attribute(root[1]!, "width") - 2 * INSET, height: attribute(root[1]!, "height") - 2 * INSET,
  };
  const within = ([x, y]: [number, number], what: string) => {
    if (x < box.x || y < box.y || x > box.x + box.width || y > box.y + box.height) throw new Error(`${what} would fall outside the trimmed drawing at ${x},${y}`);
  };
  for (const [, d] of svg.matchAll(/<path d="([^"]*)"\/>/g)) {
    if (/^M [^a-zA-Z]*( [LA] [^a-zA-Z]*)*$/.test(d!.trim())) for (const point of pathPoints(d!)) within(point, "a line");
  }

  // Boxes: found by the renderer's ID, checked for their label, and marked.
  for (const node of t.nodes) {
    const open = new RegExp(`<g class="([^"]*)" data-id="${node.native}"((?: style="[^"]*")?) transform="translate\\((-?[0-9.]+),(-?[0-9.]+)\\)">`).exec(svg);
    if (!open) throw new Error(`the box ${node.native} is not in the drawing`);
    const [tag, classes, style, x, y] = open as unknown as [string, string, string, string, string];
    within([Number(x), Number(y)], `the box “${node.label}”`);
    const end = closing(svg, open.index + tag.length);
    let body = svg.slice(open.index + tag.length, end);
    const shown = [...body.matchAll(/<text [^>]*>([^<]*)<\/text>/g)].map((m) => plain(m[1]!)).join(" ");
    if (shown !== node.label) throw new Error(`the box “${node.label}” shows “${shown}”`);
    if (node.doubled) {
      const rect = /<rect [^>]*\/>/.exec(body)?.[0];
      if (!rect) throw new Error(`the box “${node.label}” has no rectangle to double`);
      const [rx, ry, w, h] = ["x", "y", "width", "height"].map((n) => attribute(rect, n)) as [number, number, number, number];
      body = body.replace(rect, `${rect}\n<rect class="stm-inner" x="${rx + 5}" y="${ry + 5}" width="${w - 10}" height="${h - 10}" rx="4" ry="4"/>`);
    }
    const marked = `<g class="${classes}${node.focus ? " stm-focus" : ""}" data-id="${node.native}"${style} transform="translate(${x},${y})">`;
    svg = svg.slice(0, open.index) + marked + body + svg.slice(end);
  }

  // Opposing lines: dashed by the stylesheet, and the arrowhead becomes a bar.
  for (const link of t.opposing) {
    const group = new RegExp(`<g class="lini-link" data-from="visual\\.${link.from}" data-to="visual\\.${link.to}">([\\s\\S]*?)</g>`).exec(svg);
    const head = group && /<polygon class="lini-marker lini-marker-arrow" points="([^"]*)"\/>/.exec(group[1]!);
    if (!group || !head) throw new Error(`the opposing line from ${link.from} to ${link.to} is not in the drawing`);
    const [tip, a, b] = head[1]!.split(" ").map((p) => p.split(",").map(Number) as [number, number]) as [[number, number], [number, number], [number, number]];
    const reach: [number, number] = [tip[0] - (a[0] + b[0]) / 2, tip[1] - (a[1] + b[1]) / 2];
    // Short of the box's edge, so that the bar stands clear of the border.
    const end = (p: [number, number]) => {
      const middle: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      return `${round(middle[0] + (p[0] - middle[0]) * BAR_WIDTH + reach[0] * BAR_AT)},${round(middle[1] + (p[1] - middle[1]) * BAR_WIDTH + reach[1] * BAR_AT)}`;
    };
    const [one, two] = [end(a).split(","), end(b).split(",")];
    const bar = `<line class="stm-bar" x1="${one[0]}" y1="${one[1]}" x2="${two[0]}" y2="${two[1]}"/>`;
    svg = svg.replace(group[0], () => `<g class="lini-link stm-opposing" data-from="visual.${link.from}" data-to="visual.${link.to}">${group[1]!.replace(head[0], bar)}</g>`);
  }

  // The root element: a name and a description, and a size the page can shrink.
  const open = /<svg [^>]*>/.exec(svg)?.[0];
  if (!open) throw new Error("not a drawing");
  const width = round(box.width);
  const label = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${[box.x, box.y, box.width, box.height].map(round).join(" ")}" width="${width}" height="${round(box.height)}" class="lini" role="img" aria-labelledby="${t.key}-title ${t.key}-desc">\n  <title id="${t.key}-title">${escape(t.title)}</title>\n  <desc id="${t.key}-desc">${escape(t.desc)}</desc>`;
  svg = svg.replace(open, () => label);
  assertSafe(svg);
  return `${svg.trim()}\n`;
}

const round = (value: number): number => Math.round(value * 1000) / 1000;

export function assertSafe(svg: string): void {
  const body = svg.replace('xmlns="http://www.w3.org/2000/svg"', "");
  for (const [pattern, what] of UNSAFE) {
    const found = pattern.exec(body);
    if (found) throw new Error(`a drawing holds ${what}: ${body.slice(found.index, found.index + 60)}`);
  }
}

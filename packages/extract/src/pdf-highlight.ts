// Where the quoted words lie on a page of a PDF (CONTRACT-005 M, "Highlighting
// on originals"). A box drawn on the wrong words is the worst failure here, so
// every doubt gives no highlight and says why.
//
// The one page is read again with the pinned pdf.js. Its text must be exactly
// the source file's part. Positions are then worked out from the page's drawing
// operators, as pdf.js's canvas does, and held against pdf.js's text content,
// which it computes separately. Anything the operators do that is not known
// here refuses the page. Nothing is run, recognized, drawn, or fetched.
//
// Where that gives no highlight and the page is a scan with invisible
// recognition text, the place may be estimated from that text ("Estimates on
// scans"; pdf-estimate.ts). An estimate is its own kind of answer and loosens
// nothing a highlight is held to.
import { join } from "node:path";
import { sha256 } from "@stemma/records";
import { type Highlight, type HighlightBox, type HighlightTarget, noHighlight, type NoHighlightReason } from "../../core/src/highlight.ts";
import { assetDirectory } from "./index.ts";
import { cleanText } from "./model.ts";
import { estimatePlace, type LayerGlyph, type LayerRect } from "./pdf-estimate.ts";
import { type RawItem, readPageItems } from "./pdf-lines.ts";

export const HIGHLIGHT_BOUNDS = { operators: 300_000, glyphs: 100_000, boxes: 500 };

/** A box's extent above and below the baseline at least, in text sizes, and the part of it other text and paint are held against. */
const BOX = { down: 0.22, up: 0.75 };
const CORE = { down: 0.15, up: 0.68 };
/** How far a glyph's outline may reach past its advance width and from its baseline, in text sizes. */
const OUTLINE = { before: 0.25, after: 0.35, down: 0.45, up: 1.15 };
const LEAST_SIZE = 4;
/** The lightest fill, as a part of white, in which words count as seen on white paper. */
const DARKEST_SEEN = 0.6;
const WHITE = 0.97;
/** For an estimate: the least part of the page that images cover, and of its glyphs that are not seen, for it to be read as a scan. */
const SCAN = { images: 0.5, unseen: 0.5 };
/** The most a baseline may slope on the page as shown for boxes along lines, as a part of its run. */
const LEVEL = 0.09;

type Matrix = [number, number, number, number, number, number];
interface Rect { x0: number; y0: number; x1: number; y1: number }

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const times = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const point = (m: Matrix, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
/** The upright rectangle around a rectangle moved by a matrix. */
const around = (m: Matrix, x0: number, y0: number, x1: number, y1: number): Rect => {
  const corners = [point(m, x0, y0), point(m, x1, y0), point(m, x1, y1), point(m, x0, y1)];
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
};
const union = (a: Rect, b: Rect): Rect => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) });
const intersection = (a: Rect, b: Rect): Rect => ({ x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) });
const area = (r: Rect): number => Math.max(0, r.x1 - r.x0) * Math.max(0, r.y1 - r.y0);
const meet = (a: Rect, b: Rect): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const inside = (inner: Rect, outer: Rect, slack: number): boolean => (
  inner.x0 >= outer.x0 - slack && inner.y0 >= outer.y0 - slack && inner.x1 <= outer.x1 + slack && inner.y1 <= outer.y1 + slack
);
/** Neither turned, skewed, nor mirrored. */
const upright = (m: Matrix): boolean => m[0] > 0 && m[3] > 0 && Math.abs(m[1]) <= m[0] * 1e-4 && Math.abs(m[2]) <= m[3] * 1e-4;

const brightness = (colour: string | null): number | undefined => {
  const found = colour === null ? null : /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(colour);
  return found ? (0.2126 * parseInt(found[1]!, 16) + 0.7152 * parseInt(found[2]!, 16) + 0.0722 * parseInt(found[3]!, 16)) / 255 : undefined;
};

class Refused extends Error {
  constructor(readonly reason: NoHighlightReason) {
    super(reason);
  }
}

interface State {
  ctm: Matrix;
  clip: Rect;
  /** A clipping path that is not one upright rectangle is in force, whose inside is not worked out. */
  shapedClip: boolean;
  fill: string | null;
  fillAlpha: number;
  normalBlend: boolean;
  lineWidth: number;
  miter: number;
  font: any;
  size: number;
  direction: number;
  charSpacing: number;
  wordSpacing: number;
  hScale: number;
  leading: number;
  rise: number;
  mode: number;
  text: Matrix;
  x: number;
  y: number;
  lineX: number;
  lineY: number;
}

interface Glyph {
  unicode: string;
  /** Where it lies: advance and outline, upright around them. */
  box: Rect;
  core: Rect;
  /** Its baseline's start, its advance, and its size, on the page; meaningful when upright. */
  x: number;
  y: number;
  advance: number;
  /** How far it reaches along its baseline, however that lies. */
  span: number;
  size: number;
  upright: boolean;
  /** The way its baseline runs on the page. */
  toward: [number, number];
  /** It makes no mark: white space with no outline. */
  blank: boolean;
  /** Its text is white space only. Some fonts give a space a shape. */
  space: boolean;
  order: number;
  mode: number;
  fill: string | null;
  fillAlpha: number;
  normalBlend: boolean;
  clip: Rect;
  shapedClip: boolean;
  /** Its outline lies about where its width says it does. */
  fits: boolean;
  /** Its font's name says it is one of symbols or pictures. */
  symbols: boolean;
}

interface Paint { box: Rect; order: number; white: boolean; image: boolean }

/**
 * Fonts whose shapes are signs, whatever letters the file's text gives them. The
 * library does not say whether a file gave a font its own character map, and
 * nearly every font a program embeds in part is flagged "symbolic", so only the
 * name is held against it, character map or not.
 */
const SYMBOL_FONT = /symbol|dingbats|wingdings|webdings/i;

/** An annotation, as the library reads it. */
interface Annotation {
  subtype?: string;
  annotationFlags: number;
  rect: number[];
  hasAppearance?: boolean;
  color?: ArrayLike<number> | null;
  borderStyle?: { width?: number; rawWidth?: number; horizontalCornerRadius?: number; verticalCornerRadius?: number };
}
const HIDDEN = 2, PRINT = 4, NO_VIEW = 32, TOGGLE_NO_VIEW = 256;

/**
 * Whether an annotation may be seen on or near these words in a viewer that shows
 * annotations. Every kind counts, with or without a stored appearance, since
 * viewers draw many without one. A link or a note's window with none shows
 * nothing over its area; a link's border is lines along its edges, and counts
 * where a thick one, or a line at its top or bottom, meets the words.
 */
function annotationOn(note: Annotation, box: Rect, core: Rect): boolean {
  const flags = note.annotationFlags;
  if (flags & HIDDEN || (flags & NO_VIEW && !(flags & (PRINT | TOGGLE_NO_VIEW)))) return false;
  const [ax, ay, bx, by] = note.rect as [number, number, number, number];
  const rect = { x0: Math.min(ax, bx), y0: Math.min(ay, by), x1: Math.max(ax, bx), y1: Math.max(ay, by) };
  if (!note.hasAppearance && note.subtype === "Popup") return false;
  if (!note.hasAppearance && note.subtype === "Link") {
    const border = note.borderStyle ?? {};
    if (border.width === 0 || !note.color) return false;
    // The library cuts a width too large for the link down to 1; another viewer may not, so the stated one counts.
    const width = Math.max(border.width ?? 1, border.rawWidth ?? 1);
    // Rounded corners take the lines inside the link's area.
    if (border.horizontalCornerRadius || border.verticalCornerRadius) return meet(rect, box);
    if (width > 1) {
      return meet({ x0: rect.x0 - width, y0: rect.y0 - width, x1: rect.x1 + width, y1: rect.y1 + width }, box)
        && !inside(core, { x0: rect.x0 + width, y0: rect.y0 + width, x1: rect.x1 - width, y1: rect.y1 - width }, 0);
    }
    return [rect.y0, rect.y1].some((y) => meet({ x0: rect.x0, y0: y - width, x1: rect.x1, y1: y + width }, core));
  }
  return meet(rect, box);
}

/** The outline's extent in text sizes, or nothing for a glyph that has none. */
function outlineOf(page: any, font: any, character: string, DRAW: { moveTo: number; lineTo: number; curveTo: number; quadraticCurveTo: number; closePath: number }): Rect | undefined {
  const id = `${font.loadedName}_path_${character}`;
  if (!page.commonObjs.has(id)) return undefined;
  const path = (page.commonObjs.get(id) as { path?: ArrayLike<number> }).path;
  if (!path) return undefined;
  let box: Rect | undefined;
  let drawn = false;
  for (let i = 0; i < path.length; ) {
    const op = path[i++]!;
    const pairs = op === DRAW.moveTo || op === DRAW.lineTo ? 1 : op === DRAW.curveTo ? 3 : op === DRAW.quadraticCurveTo ? 2 : 0;
    drawn ||= pairs > 0 && op !== DRAW.moveTo;
    for (let p = 0; p < pairs; p++) {
      const x = path[i++]!;
      const y = path[i++]!;
      box = box ? union(box, { x0: x, y0: y, x1: x, y1: y }) : { x0: x, y0: y, x1: x, y1: y };
    }
  }
  return drawn && box && area(box) > 0 ? box : undefined;
}

/** Whether a path is one rectangle with sides along the page's, once moved. */
function oneRectangle(data: ArrayLike<number> | null, m: Matrix, DRAW: { moveTo: number; lineTo: number; closePath: number }): boolean {
  if (!data || !(upright(m) || (m[0] === 0 && m[3] === 0))) return false;
  const points: [number, number][] = [];
  for (let i = 0; i < data.length; ) {
    const op = data[i++]!;
    if (op === DRAW.closePath) {
      if (i < data.length) return false;
    } else if ((op === DRAW.moveTo && points.length === 0) || (op === DRAW.lineTo && points.length > 0)) points.push([data[i++]!, data[i++]!]);
    else return false;
  }
  if (points.length === 5 && points[0]![0] === points[4]![0] && points[0]![1] === points[4]![1]) points.pop();
  if (points.length !== 4) return false;
  const across = points.map((p, i) => {
    const next = points[(i + 1) % 4]!;
    return Math.abs(p[1] - next[1]) < 1e-3 ? true : Math.abs(p[0] - next[0]) < 1e-3 ? false : undefined;
  });
  return across.every((a, i) => a !== undefined && a !== across[(i + 1) % 4]);
}

/** The glyphs and other paint of a page, in the order drawn. */
async function drawing(pdfjs: any, page: any): Promise<{ glyphs: Glyph[]; paints: Paint[] }> {
  const OPS = pdfjs.OPS as Record<string, number>;
  const name = new Map(Object.entries(OPS).map(([key, value]) => [value, key]));
  // The shapes of path steps, as the pinned library numbers them.
  const DRAW = { moveTo: 0, lineTo: 1, curveTo: 2, quadraticCurveTo: 3, closePath: 4 };
  const list = await page.getOperatorList({ annotationMode: pdfjs.AnnotationMode.DISABLE });
  if (list.fnArray.length > HIGHLIGHT_BOUNDS.operators) throw new Refused("too_much");
  const [vx0, vy0, vx1, vy1] = page.view as number[];
  let state: State = {
    ctm: IDENTITY, clip: { x0: vx0!, y0: vy0!, x1: vx1!, y1: vy1! }, shapedClip: false, fill: "#000000", fillAlpha: 1, normalBlend: true,
    lineWidth: 1, miter: 10, font: undefined, size: 0, direction: 1, charSpacing: 0, wordSpacing: 0, hScale: 1, leading: 0, rise: 0, mode: 0,
    text: IDENTITY, x: 0, y: 0, lineX: 0, lineY: 0,
  };
  const saved: State[] = [];
  const glyphs: Glyph[] = [];
  const paints: Paint[] = [];
  let clipping = false;
  const save = () => saved.push({ ...state });
  const restore = () => {
    const before = saved.pop();
    if (before) state = before;
  };
  const move = (x: number, y: number) => {
    state.x = state.lineX += x;
    state.y = state.lineY += y;
  };
  const image = (order: number) => paints.push({ box: intersection(around(state.ctm, 0, 0, 1, 1), state.clip), order, white: false, image: true });

  const show = (items: any[], order: number) => {
    const { font, size } = state;
    if (!font) throw new Refused("unknown_drawing");
    // Without the name nothing says which font this is.
    if (typeof font.name !== "string") throw new Refused("unknown_drawing");
    const symbols = SYMBOL_FONT.test(font.name);
    // Vertical glyphs are placed another way, so nothing on the page could be held against them.
    if (font.vertical) throw new Refused("vertical_text");
    if (size === 0) return;
    const h = state.hScale * state.direction;
    const whole = times(state.ctm, state.text);
    const unit = size * (font.fontMatrix?.[0] ?? 0.001);
    let along = 0;
    for (const glyph of items) {
      if (typeof glyph === "number") {
        along -= (glyph * size) / 1000;
        continue;
      }
      const width = glyph.width * unit;
      const advance = width + ((glyph.isSpace ? state.wordSpacing : 0) + state.charSpacing) * state.direction;
      const left = state.x + along * h;
      const base = state.y + state.rise;
      const outline = glyph.accent ? undefined : outlineOf(page, font, glyph.fontChar, DRAW);
      const ems = width / size;
      const at = (x0: number, y0: number, x1: number, y1: number) => around(whole, left + x0 * size * h, base + y0 * size, left + x1 * size * h, base + y1 * size);
      const [px, py] = point(whole, left, base);
      glyphs.push({
        unicode: String(glyph.unicode ?? ""),
        box: at(Math.min(0, outline?.x0 ?? 0), Math.min(-BOX.down, outline?.y0 ?? 0), Math.max(ems, outline?.x1 ?? 0), Math.max(BOX.up, outline?.y1 ?? 0)),
        core: at(0, -CORE.down, ems, CORE.up),
        x: px, y: py, advance: width * h * whole[0], span: Math.abs(width * h) * Math.hypot(whole[0], whole[1]), size: size * whole[3], upright: upright(whole) && h > 0 && state.direction > 0,
        toward: [whole[0] * Math.sign(h), whole[1] * Math.sign(h)],
        blank: !outline && !glyph.accent && /^\s*$/u.test(String(glyph.unicode ?? "")),
        space: /^\s*$/u.test(String(glyph.unicode ?? "")),
        order, mode: state.mode, fill: state.fill, fillAlpha: state.fillAlpha, normalBlend: state.normalBlend,
        clip: state.clip, shapedClip: state.shapedClip, symbols,
        // What the canvas does not paint, or shifts by what the browser measures, does not fit.
        fits: glyph.isInFont !== false && !font.missingFile && !font.remeasure && outline !== undefined && ems > 0 && outline.x0 >= -OUTLINE.before && outline.x1 <= ems + OUTLINE.after
          && outline.y0 >= -OUTLINE.down && outline.y1 <= OUTLINE.up,
      });
      if (glyphs.length > HIGHLIGHT_BOUNDS.glyphs) throw new Refused("too_much");
      along += advance;
    }
    state.x += along * h;
  };

  for (let order = 0; order < list.fnArray.length; order++) {
    const op = name.get(list.fnArray[order]);
    const args = list.argsArray[order];
    switch (op) {
      case "dependency": case "setLineCap": case "setLineJoin": case "setDash": case "setRenderingIntent": case "setFlatness":
      case "setStrokeRGBColor": case "setStrokeTransparent": case "setStrokeColorN": case "beginMarkedContent": case "endMarkedContent":
      case "endText":
        break;
      case "beginMarkedContentProps":
        // Optional content may or may not be shown.
        if (args[0] === "OC") throw new Refused("unknown_drawing");
        break;
      case "save": save(); break;
      case "restore": restore(); break;
      case "transform": state.ctm = times(state.ctm, [...args] as Matrix); break;
      case "paintFormXObjectBegin": {
        save();
        const [matrix, bbox] = args;
        if (matrix) state.ctm = times(state.ctm, Array.from(matrix as ArrayLike<number>) as Matrix);
        if (bbox) {
          if (!(upright(state.ctm) || (state.ctm[0] === 0 && state.ctm[3] === 0))) state.shapedClip = true;
          state.clip = intersection(state.clip, around(state.ctm, bbox[0], bbox[1], bbox[2], bbox[3]));
        }
        break;
      }
      case "paintFormXObjectEnd": restore(); break;
      case "setGState":
        for (const [key, value] of args[0] as [string, unknown][]) {
          if (key === "ca") state.fillAlpha = Number(value);
          else if (key === "BM") state.normalBlend = value === "source-over";
          else if (key === "LW") state.lineWidth = Number(value);
          else if (key === "ML") state.miter = Number(value);
          else if (key === "SMask" && value === false) continue;
          else if (key === "TR" && !value) continue;
          else if (!["CA", "LC", "LJ", "D", "RI", "FL"].includes(key)) throw new Refused("unknown_drawing");
        }
        break;
      case "setLineWidth": state.lineWidth = args[0]; break;
      case "setMiterLimit": state.miter = args[0]; break;
      case "setFillRGBColor": state.fill = typeof args[0] === "string" ? args[0] : null; break;
      case "setFillTransparent": case "setFillColorN": state.fill = null; break;
      case "beginText": state.text = IDENTITY; state.x = state.y = state.lineX = state.lineY = 0; break;
      case "setTextMatrix": state.text = Array.from(args[0] as ArrayLike<number>) as Matrix; state.x = state.y = state.lineX = state.lineY = 0; break;
      case "moveText": move(args[0], args[1]); break;
      case "setLeading": state.leading = -args[0]; break;
      case "setLeadingMoveText": state.leading = args[1]; move(args[0], args[1]); break;
      case "nextLine": move(0, state.leading); break;
      case "setCharSpacing": state.charSpacing = args[0]; break;
      case "setWordSpacing": state.wordSpacing = args[0]; break;
      case "setHScale": state.hScale = args[0] / 100; break;
      case "setTextRise": state.rise = args[0]; break;
      case "setTextRenderingMode":
        state.mode = args[0];
        // Text used as a clipping path changes what everything after it shows.
        if (state.mode >= 4) throw new Refused("unknown_drawing");
        break;
      case "setFont": {
        const font = page.commonObjs.get(args[0]);
        if (!font || font.isType3Font || font.isInvalidPDFjsFont) throw new Refused("unknown_drawing");
        state.font = font;
        state.direction = args[1] < 0 ? -1 : 1;
        state.size = Math.abs(args[1]);
        break;
      }
      case "showText":
        show(args[0], order);
        break;
      case "clip": case "eoClip": clipping = true; break;
      case "constructPath": {
        const [painted, data, minMax] = args;
        const kind = name.get(painted);
        const bounds = minMax ? around(state.ctm, minMax[0], minMax[1], minMax[2], minMax[3]) : undefined;
        const stroked = kind === "stroke" || kind === "closeStroke";
        const filled = kind === "fill" || kind === "eoFill";
        const both = kind === "fillStroke" || kind === "eoFillStroke" || kind === "closeFillStroke" || kind === "closeEOFillStroke";
        if (!stroked && !filled && !both && kind !== "endPath") throw new Refused("unknown_drawing");
        if (bounds && kind !== "endPath") {
          const scale = Math.max(Math.hypot(state.ctm[0], state.ctm[1]), Math.hypot(state.ctm[2], state.ctm[3]));
          // A stroke reaches past its path by half its width, and further at a sharp corner.
          const reach = filled ? 0.05 : Math.max(0.25, (state.lineWidth * scale * Math.max(1, state.miter)) / 2);
          const box = { x0: bounds.x0 - reach, y0: bounds.y0 - reach, x1: bounds.x1 + reach, y1: bounds.y1 + reach };
          paints.push({ box: intersection(box, state.clip), order, white: filled && (brightness(state.fill) ?? 0) >= WHITE, image: false });
        }
        if (clipping) {
          clipping = false;
          if (!bounds) state.clip = { x0: 0, y0: 0, x1: 0, y1: 0 };
          else {
            if (!oneRectangle(data?.[0] ?? null, state.ctm, DRAW)) state.shapedClip = true;
            state.clip = intersection(state.clip, bounds);
          }
        }
        break;
      }
      case "shadingFill": paints.push({ box: state.clip, order, white: false, image: false }); break;
      case "paintImageXObject": case "paintInlineImageXObject": case "paintImageMaskXObject": case "paintSolidColorImageMask":
        image(order);
        break;
      default:
        throw new Refused("unknown_drawing");
    }
  }
  return { glyphs, paints };
}

/** A string's characters as they count here: those of the page's lines that are not white space. */
const marks = (text: string): string[] => [...cleanText(text.replace(/[\f\0]/g, " "))].filter((c) => !/\s/u.test(c));

const RIGHT_TO_LEFT = /[֐-ࣿ‏‫‮⁧יִ-﷿ﹰ-ﻼ\u{10800}-\u{10fff}\u{1e800}-\u{1efff}]/u;
/** One glyph that stands for several letters: the presentation ligatures. */
const LIGATURE = /[ﬀ-ﭏ]/u;

interface Placed { glyph: Glyph; item: RawItem; offset: number }

/** What is read of the page once, however many times it is asked for. */
interface PageRead {
  content(): Promise<{ read: ReturnType<typeof readPageItems>; text: string }>;
  drawing(): ReturnType<typeof drawing>;
}

function pageRead(pdfjs: any, page: any): PageRead {
  let content: ReturnType<PageRead["content"]> | undefined;
  let drawn: ReturnType<PageRead["drawing"]> | undefined;
  return {
    content: () => (content ??= page.getTextContent({ disableNormalization: true }).then((got: { items: RawItem[] }) => {
      const read = readPageItems(got.items);
      // The part's text: every line that holds ink, as the converter writes them.
      return { read, text: read.lines.map((line) => cleanText(line.text).replace(/\n/g, " ")).join("\n") };
    })) as ReturnType<PageRead["content"]>,
    drawing: () => (drawn ??= drawing(pdfjs, page)),
  };
}

const viewOfPage = (page: any): Rect => {
  const [x0, y0, x1, y1] = page.view as number[];
  return { x0: x0!, y0: y0!, x1: x1!, y1: y1! };
};

/** The library's text content leaves out glyphs that begin off the page, by this rule of its own. */
const beginsOnPage = (g: Glyph, view: Rect): boolean => !(g.x + g.span < view.x0 || g.x > view.x1 || g.y < view.y0 || g.y > view.y1);

/**
 * The glyphs at the target's offsets in the page's text, which must be the
 * target's text: each character drawn is held against the text content, in
 * order, so that every quoted character has its glyph.
 */
function quotedGlyphs(
  { read, text }: Awaited<ReturnType<PageRead["content"]>>, glyphs: Glyph[], view: Rect, target: HighlightTarget,
): (Placed & { at: number })[] {
  const onPage = glyphs.filter((g) => beginsOnPage(g, view));

  // Every character the operators draw there, in order, against every character of the text content.
  const drawn = onPage.flatMap((glyph) => marks(glyph.unicode).map((character) => ({ character, glyph })));
  const given = read.items.flatMap((item, i) => marks(item.str).map((character) => ({
    character, item,
    // What a download stamp's removal changed is no longer tied to what is drawn.
    kept: read.kept[i] === item.str ? true : read.kept[i] === "" ? false : undefined,
  })));
  if (drawn.length !== given.length || drawn.some((d, i) => d.character !== given[i]!.character)) throw new Refused("unclear_positions");
  const inText = given.flatMap((g, i) => (g.kept === false ? [] : [{ character: g.character, item: g.item, glyph: g.kept === true ? drawn[i]!.glyph : undefined }]));

  // The characters of the page's text, by where each begins.
  const offsets: number[] = [];
  let offset = 0;
  let letters = "";
  for (const character of text) {
    if (!/\s/u.test(character)) {
      offsets.push(offset);
      letters += character;
    }
    offset += character.length;
  }
  if (inText.length !== offsets.length || inText.map((c) => c.character).join("") !== letters) throw new Refused("unclear_positions");

  const chosen: (Placed & { at: number })[] = [];
  let range = 0;
  for (const [at, begins] of offsets.entries()) {
    while (range < target.ranges.length && target.ranges[range]![1] <= begins) range++;
    if (range >= target.ranges.length) break;
    if (begins < target.ranges[range]![0]) continue;
    const found = inText[at]!;
    if (!found.glyph) throw new Refused("unclear_positions");
    chosen.push({ glyph: found.glyph, item: found.item, offset: begins, at });
  }
  if (chosen.length === 0) throw new Refused("unclear_positions");
  return chosen;
}

async function place(page: any, target: HighlightTarget, once: PageRead): Promise<Rect[]> {
  const content = await once.content();
  const { text } = content;
  if (sha256(text) !== target.text_sha256) throw new Refused("text_differs");
  if (page.rotate % 360 !== 0) throw new Refused("rotated_page");
  // Before anything is held against the drawing: the library reorders such text, so it would not agree.
  for (const [from, to] of target.ranges) {
    const end = text.indexOf("\n", to - 1);
    if (RIGHT_TO_LEFT.test(text.slice(text.lastIndexOf("\n", from) + 1, end < 0 ? text.length : end))) throw new Refused("right_to_left");
  }

  const { glyphs, paints } = await once.drawing();
  const view = viewOfPage(page);
  const chosen = quotedGlyphs(content, glyphs, view, target);
  const wanted = new Set(chosen.map((c) => c.glyph));

  // How the words are drawn, the most telling reason first.
  for (const { glyph } of chosen) {
    if (glyph.mode === 3) {
      throw new Refused(paints.some((p) => p.image && meet(p.box, glyph.box)) ? "recognition_layer" : "invisible_text");
    }
  }
  for (const { glyph, item } of chosen) {
    if (item.dir === "ttb") throw new Refused("vertical_text");
    if (item.dir !== "ltr") throw new Refused("right_to_left");
    if (!glyph.upright) throw new Refused("rotated_text");
    if (glyph.symbols) throw new Refused("symbol_font");
    const characters = marks(glyph.unicode);
    if (characters.length > 1 || LIGATURE.test(glyph.unicode)) throw new Refused("ligature");
    const light = brightness(glyph.fill);
    if (glyph.mode !== 0 || light === undefined || light > DARKEST_SEEN || glyph.fillAlpha < 1 || !glyph.normalBlend
      || glyph.size < LEAST_SIZE || !glyph.fits || glyph.shapedClip || !inside(glyph.box, glyph.clip, 0.5)) throw new Refused("hidden_text");
    // The same place, worked out by the library for its text content.
    const [a, b, c, d, x, y] = item.transform as number[];
    const slack = glyph.size * 0.2;
    if (!upright([a!, b!, c!, d!, x!, y!]) || Math.abs(glyph.y - y!) > slack || glyph.x < x! - slack || glyph.x + glyph.advance > x! + item.width! + slack) {
      throw new Refused("unclear_positions");
    }
  }

  // One box for each unbroken run of quoted glyphs on one baseline.
  const runs: { box: Rect; core: Rect; glyphs: Glyph[]; last: Glyph; at: number }[] = [];
  for (const { glyph, at } of chosen) {
    const run = runs.at(-1);
    if (run && run.last === glyph) continue;
    if (run && at === run.at + 1 && Math.abs(glyph.y - run.last.y) <= glyph.size * 0.02 && Math.abs(glyph.size - run.last.size) <= glyph.size * 0.02) {
      const gap = glyph.x - (run.last.x + run.last.advance);
      // Drawn back over the one before.
      if (gap < -0.5 * Math.min(glyph.advance, run.last.advance)) throw new Refused("overlapping_text");
      if (gap <= glyph.size) {
        Object.assign(run, { box: union(run.box, glyph.box), core: union(run.core, glyph.core), last: glyph, at });
        run.glyphs.push(glyph);
        continue;
      }
    }
    runs.push({ box: glyph.box, core: glyph.core, glyphs: [glyph], last: glyph, at });
  }
  if (runs.length > HIGHLIGHT_BOUNDS.boxes) throw new Refused("too_much");

  const others = glyphs.filter((g) => !wanted.has(g) && !g.blank);
  // Every one, hidden ones too: what is seen is decided here, not by the library.
  const annotations = (await page.getAnnotations({ intent: "any" })) as Annotation[];
  for (const [i, run] of runs.entries()) {
    if (!inside(run.box, view, 0.5)) throw new Refused("hidden_text");
    // Shrunk a little, so that paint which only comes near does not count.
    const trim = Math.min(0.5, (run.core.y1 - run.core.y0) * 0.05);
    const held = { x0: run.core.x0 + trim, y0: run.core.y0 + trim, x1: run.core.x1 - trim, y1: run.core.y1 - trim };
    const first = Math.min(...run.glyphs.map((g) => g.order));
    for (const paint of paints) {
      // White paint before the words is the paper under them.
      if (!(paint.white && paint.order < first) && meet(paint.box, held)) throw new Refused("covered");
    }
    const overlaps = (other: Rect) => area(intersection(other, held)) > 0.2 * Math.min(area(other), area(held));
    // A glyph whose shape is not where its width says is held by all its shape reaches. A space lies between
    // letters, and some fonts give it a shape, so it is held against each letter, not against the run it is part of.
    const covers = (g: Glyph) => (g.space
      ? run.glyphs.some((q) => area(intersection(g.box, q.core)) > 0.2 * Math.min(area(g.box), area(q.core)))
      : overlaps(g.fits ? g.core : g.box));
    if (others.some(covers) || runs.some((o, j) => j > i && overlaps(o.core))) throw new Refused("overlapping_text");
    if (annotations.some((note) => annotationOn(note, run.box, held))) throw new Refused("annotation");
  }
  return runs.map((run) => run.box);
}

/** The page as it is drawn, from its top left corner, in the units of its viewport at scale 1. */
function onViewport(viewport: any, box: Rect): LayerRect {
  const [ax, ay] = viewport.convertToViewportPoint(box.x0, box.y0) as [number, number];
  const [bx, by] = viewport.convertToViewportPoint(box.x1, box.y1) as [number, number];
  return { left: Math.min(ax, bx), top: Math.min(ay, by), right: Math.max(ax, bx), bottom: Math.max(ay, by) };
}

function fractions(viewport: any, rects: LayerRect[]): HighlightBox[] {
  const part = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 1e6) / 1e6;
  return rects.map((r) => {
    const left = part(r.left / viewport.width);
    const top = part(r.top / viewport.height);
    return { left, top, width: part(r.right / viewport.width - left), height: part(r.bottom / viewport.height - top) };
  });
}

/**
 * An estimate on a scan, where no highlight was placed for the reason given; or
 * that reason, where the page is not a scan whose text is invisible. Only the
 * invisible text over the page's images is read, so that a visible stamp on a
 * scan, or the words of a page that is not one, are never estimated.
 */
async function estimate(page: any,target: HighlightTarget, once: PageRead, why: NoHighlightReason): Promise<Highlight> {
  // The library reorders such text, so its order here says little.
  if (why === "right_to_left" || why === "page_count") return noHighlight(why);
  const [content, { glyphs, paints }] = [await once.content(), await once.drawing()];
  const view = viewOfPage(page);
  const images = paints.filter((p) => p.image);
  // Strips and layers of a scan are added up; one picture beside the text of an ordinary page does not make it a scan.
  if (images.reduce((sum, p) => sum + area(intersection(p.box, view)), 0) < SCAN.images * area(view)) return noHighlight(why);
  if (content.text.trim() === "") return noHighlight("no_text_layer");

  const shown = glyphs.filter((g) => !g.space && beginsOnPage(g, view));
  /** Not seen: drawn invisibly, or drawn before an image that covers it. */
  const unseen = (g: Glyph) => g.mode === 3 || images.some((p) => p.order > g.order && inside(g.core, p.box, 0.5));
  const behind = shown.filter((g) => unseen(g) && images.some((p) => meet(p.box, g.box)));
  if (behind.length === 0 || behind.length < SCAN.unseen * shown.length) return noHighlight(why);

  const viewport = page.getViewport({ scale: 1 });
  const layer = new Map<Glyph, LayerGlyph>(behind.map((glyph) => {
    const [x0, y0] = viewport.convertToViewportPoint(glyph.x, glyph.y) as [number, number];
    const [x1, y1] = viewport.convertToViewportPoint(glyph.x + glyph.toward[0], glyph.y + glyph.toward[1]) as [number, number];
    return [glyph, { text: glyph.unicode, ...onViewport(viewport, glyph.box), level: x1 > x0 && Math.abs(y1 - y0) <= (x1 - x0) * LEVEL }];
  }));

  // The recorded offsets, where the page's text is the source text's and each of its characters has its glyph.
  let exact: LayerGlyph[] | undefined;
  if (target.ranges.length > 0 && sha256(content.text) === target.text_sha256) {
    try {
      const chosen = quotedGlyphs(content, glyphs, view, target).filter((c) => !c.glyph.space);
      // Quoted words that are seen are not part of a scan's recognition text.
      if (chosen.some((c) => !layer.has(c.glyph))) return noHighlight(why);
      exact = chosen.map((c) => layer.get(c.glyph)!);
    } catch (error) {
      if (!(error instanceof Refused)) throw error;
    }
  }
  const made = estimatePlace([...layer.values()], { ...(exact ? { exact } : {}), ...(target.words ? { words: target.words } : {}) });
  if ("refused" in made) return noHighlight(made.refused);
  if (made.rects.length > HIGHLIGHT_BOUNDS.boxes) return noHighlight("too_much");
  const boxes = fractions(viewport, made.rects);
  // A layer that puts words off the page does not lie on the picture of it.
  if (boxes.some((box) => !(box.width > 0 && box.height > 0))) return noHighlight("scan_weak_match");
  return { state: "estimate", method: made.method, sha256: target.sha256, page: target.page, page_count: target.page_count, boxes };
}

/**
 * The boxes on the page the target names, from the bytes given, as a highlight or
 * as an estimate on a scan, or why there are none. The bytes must already be
 * known to have the target's digest.
 */
export async function locateOnPage(bytes: Uint8Array, target: HighlightTarget, assets = assetDirectory()): Promise<Highlight> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    cMapUrl: `${join(assets, "cmaps")}/`, cMapPacked: true, standardFontDataUrl: `${join(assets, "standard_fonts")}/`,
    useSystemFonts: false,
    // Each font's name.
    fontExtraProperties: true,
    // As the served page draws: each glyph's outline, which is then to be had here.
    disableFontFace: true,
    enableXfa: false, stopAtErrors: true,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });
  try {
    const document = await task.promise;
    if (document.numPages !== target.page_count || target.page < 1 || target.page > document.numPages) return noHighlight("page_count");
    const page = await document.getPage(target.page);
    const once = pageRead(pdfjs, page);
    let why: NoHighlightReason | undefined = target.refused;
    if (!why) {
      try {
        const rects = await place(page, target, once);
        const viewport = page.getViewport({ scale: 1 });
        return {
          state: "boxes", sha256: target.sha256, page: target.page, page_count: target.page_count,
          boxes: fractions(viewport, rects.map((r) => onViewport(viewport, r))),
        };
      } catch (error) {
        if (!(error instanceof Refused)) throw error;
        why = error.reason;
      }
    }
    try {
      return await estimate(page, target, once, why);
    } catch (error) {
      // A page whose drawing is not understood keeps the reason it already has.
      return noHighlight(why ?? (error instanceof Refused ? error.reason : "unreadable"));
    }
  } catch (error) {
    return noHighlight(error instanceof Refused ? error.reason : "unreadable");
  } finally {
    await task.destroy();
  }
}

// The served page's own look at its drawing under the boxes (CONTRACT-005 M,
// "What the page checks"). It can only remove a mark, and cannot tell which
// words are under a box. Each box is read once, into counts, and the boxes
// together are bounded, so that no answer can hold up the tab.
import type { HighlightBox } from "../../core/src/highlight.ts";

/** The most pixels all boxes may hold, in drawings. Marks along lines come nowhere near one. */
const MOST_DRAWINGS = 3;

export interface Drawn {
  width: number;
  height: number;
  getContext(kind: "2d"): { getImageData(x: number, y: number, width: number, height: number): { data: ArrayLike<number> } } | null;
}

/** Whether each box passes, given its pixels as red, green, blue, and opacity. A box with no pixel does not. */
function inEveryBox(canvas: Drawn, boxes: HighlightBox[], passes: (data: ArrayLike<number>) => boolean): boolean {
  const context = canvas.getContext("2d");
  if (!context) return false;
  const places = boxes.map((box) => {
    const left = Math.max(0, Math.floor(box.left * canvas.width));
    const top = Math.max(0, Math.floor(box.top * canvas.height));
    return { left, top, width: Math.min(canvas.width - left, Math.ceil(box.width * canvas.width)), height: Math.min(canvas.height - top, Math.ceil(box.height * canvas.height)) };
  });
  if (places.some((p) => p.width < 1 || p.height < 1)) return false;
  if (places.reduce((sum, p) => sum + p.width * p.height, 0) > MOST_DRAWINGS * canvas.width * canvas.height) return false;
  return places.every((p) => passes(context.getImageData(p.left, p.top, p.width, p.height).data));
}

const brightness = (data: ArrayLike<number>, at: number): number => 0.2126 * data[at]! + 0.7152 * data[at + 1]! + 0.0722 * data[at + 2]!;

/**
 * Whether the drawing has both dark and light pixels in every box, as words on
 * paper have. A box that has not means that the two readings of the file differ.
 */
export const drawnIn = (canvas: Drawn, boxes: HighlightBox[]): boolean => inEveryBox(canvas, boxes, (data) => {
  let dark = 0;
  let light = 0;
  for (let i = 0; i < data.length; i += 4) {
    const found = brightness(data, i);
    if (found < 175) dark++;
    else if (found > 215) light++;
  }
  const pixels = data.length / 4;
  return dark > pixels * 0.01 && light > pixels * 0.2;
});

/**
 * The same for an estimate on a scan, whose paper may be dim or tinted: in every
 * box there are marks much darker than the box's own paper, and paper around
 * them. It removes an estimate that lies on blank paper or a flat patch.
 */
export const markedIn = (canvas: Drawn, boxes: HighlightBox[]): boolean => inEveryBox(canvas, boxes, (data) => {
  // How many pixels have each brightness, to the nearest of 0 to 255.
  const counts = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) counts[Math.min(255, Math.round(brightness(data, i)))]!++;
  const pixels = data.length / 4;
  // The paper: the brightness that 9 pixels in 10 are no brighter than.
  let paper = 0;
  for (let seen = counts[0]!; seen <= Math.floor(pixels * 0.9); seen += counts[++paper]!);
  let ink = 0;
  let around = 0;
  for (let level = 0; level < 256; level++) {
    if (level < paper - 60) ink += counts[level]!;
    if (level > paper - 30) around += counts[level]!;
  }
  return ink > pixels * 0.02 && around > pixels * 0.2;
});

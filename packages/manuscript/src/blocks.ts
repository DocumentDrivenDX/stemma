// The block structure of the CommonMark subset in CONTRACT-006 E. Anything
// outside it is refused with its position, never dropped or passed through.
import { isRecordId } from "@stemma/records";
import { type Attributes, readAttributes } from "./attributes.ts";
import { malformed, type Position, unsupported } from "./model.ts";

/** One line of a block's content, with where its first character lies in the file. */
export interface Line extends Position { text: string }

export interface QuoteGroup extends Position { attributes?: Attributes }

export interface RawBlock extends Position {
  kind: "heading" | "paragraph" | "unconverted";
  lines: Line[];
  level?: number;
  id?: string;
  /** The outermost block quote holding this block. */
  quote?: QuoteGroup;
  list: boolean;
  note?: string;
}

export interface RawChapter { blocks: RawBlock[]; notes: Map<string, { at: Position; blocks: RawBlock[] }> }

interface Context { quote?: QuoteGroup; list: boolean; note?: string }

const HEADING = /^ {0,3}(#+)(?:[ \t]+|$)/;
const QUOTE = /^ {0,3}>[ \t]?/;
const LIST = /^( {0,3})([-+*]|\d{1,9}[.)])(?:( +)|$)/;
const NOTE = /^\[\^([^\]\s]+)\]:[ \t]*/;
const THEMATIC = /^ {0,3}([-*_])[ \t]*(\1[ \t]*){2,}$/;
const FENCE = /^ {0,3}(```|~~~)/;
const SETEXT = /^ {0,3}(=+|-+)[ \t]*$/;
const TABLE_RULE = /^ {0,3}\|?[ \t]*:?-{2,}:?[ \t]*\|/;
const ATTRIBUTE_LINE = /^ {0,3}\{.*\}[ \t]*$/;

const blank = (line: Line) => /^[ \t]*$/.test(line.text);
const indentOf = (text: string) => /^ */.exec(text)![0].length;
const cut = (line: Line, n: number): Line => ({ text: line.text.slice(n), line: line.line, column: line.column + n });
const where = (line: Line): Position => ({ line: line.line, column: line.column + indentOf(line.text) });

/** Whether a line starts a block that ends the paragraph before it. */
function interrupts(text: string): boolean {
  if (HEADING.test(text) || QUOTE.test(text) || text.startsWith(":::") || NOTE.test(text)) return true;
  const item = LIST.exec(text);
  // As in CommonMark, an empty item or a list not starting at 1 continues the paragraph.
  return item !== null && item[3] !== undefined && (/^[-+*]$/.test(item[2]!) || /^1[.)]$/.test(item[2]!));
}

function refuseOtherSyntax(line: Line, afterParagraph: boolean): void {
  const { text } = line;
  if (/\t/.test(/^[ \t]*/.exec(text)![0])) throw unsupported("tab indentation", where(line));
  if (afterParagraph && SETEXT.test(text)) throw unsupported("underlined heading", where(line));
  if (THEMATIC.test(text)) throw unsupported("thematic break", where(line));
  if (FENCE.test(text)) throw unsupported("code block", where(line));
  if (TABLE_RULE.test(text)) throw unsupported("table", where(line));
}

export function readBlocks(source: Line[]): RawChapter {
  const chapter: RawChapter = { blocks: [], notes: new Map() };
  parse(source, { list: false }, chapter, chapter.blocks);
  return chapter;
}

function parse(lines: Line[], context: Context, chapter: RawChapter, out: RawBlock[]): void {
  let i = 0;
  let pending: { attributes: Attributes; at: Position } | undefined;
  const block = (kind: RawBlock["kind"], at: Position, content: Line[], extra: Partial<RawBlock> = {}) =>
    out.push({ kind, line: at.line, column: at.column, lines: content, list: context.list,
      ...(context.quote ? { quote: context.quote } : {}), ...(context.note ? { note: context.note } : {}), ...extra });

  while (i < lines.length) {
    const line = lines[i]!;
    if (blank(line)) {
      i++;
      continue;
    }
    if (pending && !QUOTE.test(line.text)) throw malformed("an attribute line must stand directly before a block quote", pending.at);

    // An attribute line names the quotation or language of the block quote below it.
    if (ATTRIBUTE_LINE.test(line.text)) {
      if (!lines[i + 1] || !QUOTE.test(lines[i + 1]!.text)) throw malformed("an attribute line must stand directly before a block quote", where(line));
      const at = where(line);
      const { attributes, end } = readAttributes(line.text.trimEnd(), indentOf(line.text), at);
      if (end !== line.text.trimEnd().length) throw malformed("text after an attribute line", at);
      pending = { attributes, at };
      i++;
      continue;
    }
    refuseOtherSyntax(line, false);
    if (indentOf(line.text) >= 4) throw unsupported("indented code block", where(line));

    if (line.text.startsWith(":::")) {
      const open = /^::: +unconverted +\{id="([^"]*)"\}[ \t]*$/.exec(line.text);
      if (!open) throw unsupported("fenced block other than `::: unconverted {id=\"itm-…\"}`", where(line));
      if (!isRecordId("intake_item", open[1]!)) throw malformed("an unconverted block needs an intake item ID", where(line));
      let end = i + 1;
      while (end < lines.length && !/^:::[ \t]*$/.test(lines[end]!.text)) end++;
      if (end === lines.length) throw malformed("an unconverted block is not closed", where(line));
      block("unconverted", where(line), lines.slice(i + 1, end), { id: open[1]! });
      i = end + 1;
      continue;
    }

    const note = NOTE.exec(line.text);
    if (note) {
      if (context.note || context.quote || context.list) throw unsupported("footnote definition inside another block", where(line));
      const label = note[1]!;
      if (label.startsWith("en-")) throw unsupported("endnote", where(line));
      if (chapter.notes.has(label)) throw malformed("a footnote is defined twice", where(line));
      const content = [cut(line, note[0].length)];
      for (i++; i < lines.length; i++) {
        const next = lines[i]!;
        if (blank(next)) {
          const after = lines.slice(i + 1).find((l) => !blank(l));
          if (!after || indentOf(after.text) < 2) break;
          content.push({ ...next, text: "" });
        } else if (indentOf(next.text) >= 2) content.push(next);
        else if (interrupts(next.text)) break;
        else throw unsupported("footnote continuation line that is not indented", where(next));
      }
      // Continuation lines share one indentation; the first line has already lost its label.
      const indent = Math.min(...content.slice(1).filter((l) => !blank(l)).map((l) => indentOf(l.text)));
      const body = content.map((l, n) => (n === 0 || blank(l) ? l : cut(l, indent)));
      const blocks: RawBlock[] = [];
      chapter.notes.set(label, { at: where(line), blocks });
      parse(body, { list: false, note: label }, chapter, blocks);
      continue;
    }

    const heading = HEADING.exec(line.text);
    if (heading) {
      const level = heading[1]!.length;
      if (level > 4) throw unsupported("heading below level 4", where(line));
      let content = cut(line, heading[0].length);
      const id = /[ \t]+\{#(sec-[^\s{}"]+)\}[ \t]*$/.exec(content.text);
      content = { ...content, text: (id ? content.text.slice(0, id.index) : content.text).replace(/(?:^|[ \t]+)#+[ \t]*$/, "").trimEnd() };
      block("heading", where(line), [content], { level, ...(id ? { id: id[1]! } : {}) });
      i++;
      continue;
    }

    if (QUOTE.test(line.text)) {
      const inner: Line[] = [];
      for (; i < lines.length && QUOTE.test(lines[i]!.text); i++) inner.push(cut(lines[i]!, QUOTE.exec(lines[i]!.text)![0].length));
      const next = lines[i];
      if (next && !blank(next) && !interrupts(next.text)) throw unsupported("line continuing a block quote without `>`", where(next));
      if (pending && context.quote) throw unsupported("attribute line inside a block quote", pending.at);
      const group: QuoteGroup = context.quote ?? { ...where(line), ...(pending ? { attributes: pending.attributes } : {}) };
      pending = undefined;
      parse(inner, { ...context, quote: group }, chapter, out);
      continue;
    }

    const item = LIST.exec(line.text);
    if (item) {
      const spaces = item[3]?.length ?? 1;
      // Five or more spaces after the marker would start a code block inside the item.
      if (spaces > 4) throw unsupported("indented code block", where(line));
      const width = item[1]!.length + item[2]!.length + spaces;
      const content = [cut(line, Math.min(width, line.text.length))];
      for (i++; i < lines.length; i++) {
        const next = lines[i]!;
        if (blank(next)) {
          const after = lines.slice(i + 1).find((l) => !blank(l));
          if (!after || indentOf(after.text) < width) break;
          content.push({ ...next, text: "" });
        } else if (indentOf(next.text) >= width) content.push(cut(next, width));
        else if (LIST.test(next.text) || interrupts(next.text)) break;
        else throw unsupported("line continuing a list item without indentation", where(next));
      }
      parse(content, { ...context, list: true }, chapter, out);
      continue;
    }

    const paragraph = [line];
    for (i++; i < lines.length; i++) {
      const next = lines[i]!;
      if (blank(next)) break;
      refuseOtherSyntax(next, true);
      if (ATTRIBUTE_LINE.test(next.text) && lines[i + 1] && QUOTE.test(lines[i + 1]!.text)) break;
      if (interrupts(next.text)) break;
      paragraph.push(next);
    }
    block("paragraph", where(line), paragraph.map((l) => cut(l, indentOf(l.text))));
  }
  if (pending) throw malformed("an attribute line must stand directly before a block quote", pending.at);
}

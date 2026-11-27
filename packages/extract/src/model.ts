// What every converter returns, and the builder that divides markup and text
// into pages (where the source marks them) or sections (CONTRACT-007 I).
import { type Block, encodeText } from "@stemma/records";
import type { Removal } from "./stamps.ts";

export interface Identity {
  title?: string; subtitle?: string; contributors?: string[]; issued?: string; edition?: string; publisher?: string;
  place?: string; venue?: string; identifiers?: { scheme: string; value: string }[]; title_pages?: number[]; basis?: string;
}

export interface Label { status: "labelled" | "none" | "unreadable" | "undetermined" | "unpaged"; label?: string; basis?: string }

export interface ConvertedPart {
  index: number;
  label: Label;
  section?: string;
  chapter?: string;
  columns: "1" | "2" | "undetermined";
  undetermined: string[];
  blocks: Block[];
  note?: string;
  /** What a rule removed from this part, never the words removed. */
  removed?: Removal[];
}

export interface Converted {
  paged: boolean;
  coverage: "all" | "partial";
  page_count?: number;
  parts: ConvertedPart[];
  identity: Identity;
  method: "born_text" | "text_layer" | "markup" | "ocr" | "manual";
  tools: { name: string; version: string }[];
  recognition?: string;
  /** The release or version the source states about itself. */
  version?: string;
  notes: string[];
}

export class Unconvertible extends Error {}

/** Version of Stemma's own converter rules; recorded as a tool of every conversion. */
export const CONVERTER_VERSION = "1";
export const converterTool = { name: "stemma-convert", version: CONVERTER_VERSION };

export const block = (role: string, content: string, more: Partial<Block> = {}): Block => ({ role, content, ...more });
/** A block of plain, unescaped text. */
export const textBlock = (role: string, text: string, more: Partial<Block> = {}): Block => block(role, encodeText(text), more);

/** Control characters other than tab and line feed never enter source text. */
export const cleanText = (text: string): string =>
  text.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000e-\u001f\u007f]/g, " ").replace(/\ufeff/g, "");

const CHAPTER = /^(?:chapter|chap\.)\s+([ivxlc]+|\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i;
export const chapterOf = (heading: string): string | undefined => CHAPTER.exec(heading.trim())?.[1];

interface Draft { blocks: Block[]; section?: string; chapter?: string; label?: string }

/**
 * Collects blocks. With page markers, a part is a page; without, a part is a
 * section that starts at a level 1 or 2 heading or where the caller says one does.
 */
export class PartBuilder {
  private readonly drafts: Draft[] = [{ blocks: [] }];
  private paged = false;
  private chapter: string | undefined;
  constructor(private readonly pages: boolean) {}

  private get current(): Draft {
    return this.drafts.at(-1)!;
  }

  newSection(): void {
    if (!this.pages && this.current.blocks.length > 0) this.drafts.push({ blocks: [], ...(this.chapter ? { chapter: this.chapter } : {}) });
  }

  /** A page marker the source carries. What follows is that page. */
  pageBreak(label: string): void {
    if (!this.pages) return;
    this.paged = true;
    this.drafts.push({ blocks: [], label });
  }

  heading(content: Block, plain: string): void {
    const level = Number(content.level ?? 2);
    if (level <= 2) {
      this.newSection();
      const chapter = chapterOf(plain);
      if (chapter) this.chapter = chapter;
      // A new top heading that is not a chapter ends the chapter before it.
      else if (level === 1) this.chapter = undefined;
      if (!this.pages) {
        this.current.section ??= plain;
        if (this.chapter) this.current.chapter = this.chapter;
        else delete this.current.chapter;
      }
    }
    this.add(content);
  }

  add(content: Block): void {
    if (content.content.trim() !== "") this.current.blocks.push(content);
  }

  build(undetermined: string[] = []): { paged: boolean; parts: ConvertedPart[] } {
    const drafts = this.drafts.filter((d, i) => d.blocks.length > 0 || (this.paged && i > 0));
    if (!drafts.some((d) => d.blocks.length > 0)) throw new Unconvertible("There is no machine-readable text in it.");
    return {
      paged: this.paged,
      parts: drafts.map((d, index) => ({
        index,
        label: !this.paged ? { status: "unpaged" } : d.label !== undefined ? { status: "labelled", label: d.label, basis: "source_marker" } : { status: "undetermined" },
        ...(d.section && !this.paged ? { section: d.section } : {}),
        ...(d.chapter && !this.paged ? { chapter: d.chapter } : {}),
        columns: "1",
        undetermined,
        blocks: d.blocks,
      })),
    };
  }
}

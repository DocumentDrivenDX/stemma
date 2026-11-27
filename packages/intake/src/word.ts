// The Word reader (FR-71, reading part; CONTRACT-003 F, "The Word reader";
// SD-015 BR-1502 and BR-1503). It takes a .docx file's bytes and returns the
// neutral document and everything beside it that it reports. It writes nothing,
// fetches nothing, and treats all file text as data.
//
// Every element is converted, removed by the revision view, or reported. An
// element it does not know is reported with the text it holds. At the end it
// checks that every text value in the parts it examined has one of those ends.
import { createHash } from "node:crypto";
import type { Paragraph } from "./document.ts";
import { instructionKind, tagKind } from "./word-fields.ts";
import {
  type PartReport, type Place, type Revision, type RevisionKind, WORD_COVERAGE, WORD_REVISION_VIEW,
  type WordAccount, type WordComment, type WordField, type WordItem, type WordItemKind, type WordReading,
} from "./word-reading.ts";
import {
  childElements, childNamed, descendants, type Disposition, isElement, parseXml, pathOf, textNodes,
  type XmlElement, type XmlText,
} from "./word-xml.ts";
import { openWordZip, overLimit, unreadable, WORD_LIMITS, type WordLimits, type WordZip } from "./word-zip.ts";

export { WORD_LIMITS, WordError, type WordLimits } from "./word-zip.ts";

type NoteKind = "footnote" | "endnote";

interface Format { level?: number; caption?: boolean; numbered?: boolean }

/** A paragraph being built. */
interface Building {
  text: string;
  bytes: number;
  /** Places in this paragraph, which get their index when it ends. */
  places: Place[];
  notes: { kind: NoteKind; id: string; label: string; at: number }[];
  format: Format;
  element?: XmlElement;
}

interface OpenField { instruction: string; bytes: number; data?: string; from?: Place }

/**
 * A run of content with its own paragraphs. `document` content becomes document
 * paragraphs, `comment` content a comment's text, and `collect` content the text
 * of one reported item.
 */
interface Story {
  part: string;
  mode: "document" | "comment" | "collect";
  location: "body" | NoteKind;
  note?: string;
  building?: Building;
  lines: string[];
  fields: OpenField[];
  tables: { table: number; row: number; cell: number }[];
  /** For content inside the document's flow, the story whose paragraph holds it. */
  host?: Story;
  comment?: string;
}

interface Anchor { start?: Place; end?: Place; mark?: Place; removed?: true }

const set = (names: string): Set<string> => new Set(names.split(" ").map((n) => (n.includes(":") ? n : `w:${n}`)));

const CONTAINERS = set("document body sdtContent smartTag customXml dir bdo rubyBase");
/** Elements that hold settings and no text. A text value inside one is reported. */
const PROPERTIES = set("pPr rPr tblPr tblPrEx trPr tcPr sectPr sdtPr sdtEndPr tblGrid smartTagPr customXmlPr rubyPr altChunkPr background");
const MARKERS = set(
  "bookmarkEnd proofErr permStart permEnd moveFromRangeStart moveFromRangeEnd moveToRangeStart moveToRangeEnd " +
  "customXmlInsRangeStart customXmlInsRangeEnd customXmlDelRangeStart customXmlDelRangeEnd customXmlMoveFromRangeStart " +
  "customXmlMoveFromRangeEnd customXmlMoveToRangeStart customXmlMoveToRangeEnd lastRenderedPageBreak footnoteRef endnoteRef " +
  "annotationRef separator continuationSeparator",
);
const GENERATED = set("pgNum dayShort dayLong monthShort monthLong yearShort yearLong");
const REMOVED = set("del moveFrom");
/** Elements whose text is read exactly, spaces included. */
const INLINE_TEXT = new Set(["w:t", "a:t", "m:t"]);
/** Elements whose value places a drawing and is not text. */
const LAYOUT = new Set(["wp:posOffset", "wp:align", "wp14:pctWidth", "wp14:pctHeight", "wp14:pctPosHOffset", "wp14:pctPosVOffset"]);
/** Namespaces whose alternative form the reader takes. */
const UNDERSTOOD = new Set(["w", "a", "pic", "m", "v", "o", "wp", "wp14", "wps", "wpg", "wpc", "wpi", "w14", "w15"]);

const blank = (text: string): boolean => !/\S/.test(text);
const mark = (node: XmlText, disposition: Disposition): void => {
  node.disposition ??= disposition;
};
const on = (element: XmlElement | undefined): boolean =>
  element !== undefined && !["0", "false", "off", "none"].includes(element.attrs["w:val"] ?? "");
/** Whether settings say that what they belong to is deleted or moved away. */
const marksRemoval = (settings: XmlElement | undefined): boolean =>
  settings !== undefined && childElements(settings).some((c) => REMOVED.has(c.name));
const value = (element: XmlElement | undefined, name: string): string | undefined => childNamed(element, name)?.attrs["w:val"];
const stated = (attrs: Record<string, string>) => ({
  ...(attrs["w:author"] !== undefined ? { author: attrs["w:author"] } : {}),
  ...(attrs["w:date"] !== undefined ? { date: attrs["w:date"] } : {}),
});

// ---- Styles ----

/** What a paragraph style gives, its own or from the styles it is based on. */
function styleReader(styles: Map<string, XmlElement>): (id: string | undefined) => Format {
  const known = new Map<string, Format>();
  return (id) => {
    if (id === undefined) return {};
    const cached = known.get(id);
    if (cached) return cached;
    const found: Format = {};
    let decided = false;
    let numbering: string | undefined;
    for (let at: string | undefined = id, depth = 0; at !== undefined && depth < 20; depth++) {
      const style = styles.get(at);
      const name = value(style, "w:name") ?? at;
      const properties = childNamed(style, "w:pPr");
      numbering ??= value(childNamed(properties, "w:numPr"), "w:numId");
      if (!decided) {
        const heading = /^heading ?([1-9])$/i.exec(name)?.[1];
        const outline = value(properties, "w:outlineLvl");
        if (/^caption$/i.test(name)) found.caption = decided = true;
        else if (outline !== undefined) {
          decided = true;
          if (Number(outline) < 9) found.level = Number(outline) + 1;
        } else if (heading || /^title$/i.test(name)) {
          decided = true;
          found.level = Number(heading ?? 1);
        }
      }
      at = value(style, "w:basedOn");
    }
    if (numbering !== undefined && numbering !== "0") found.numbered = true;
    known.set(id, found);
    return found;
  };
}

// ---- The reader ----

class Reader {
  readonly paragraphs: Paragraph[] = [];
  readonly items: WordItem[] = [];
  readonly fields: WordField[] = [];
  readonly revisions: Revision[] = [];
  readonly anchors = new Map<string, Anchor>();
  readonly notes: Record<NoteKind, Map<string, XmlElement>> = { footnote: new Map(), endnote: new Map() };
  readonly noteParts: Record<NoteKind, string> = { footnote: "", endnote: "" };
  readonly usedNotes = new Set<XmlElement>();
  /** Notes referred to by text the revision view removes. */
  readonly removedNotes = new Set<XmlElement>();
  private readonly labels: Record<NoteKind, number> = { footnote: 0, endnote: 0 };
  private tables = 0;
  format: (id: string | undefined) => Format = () => ({});
  /** Targets of the main document's relationships, by ID. */
  targets = new Map<string, string>();

  constructor(private readonly limits: WordLimits) {}

  story(part: string, mode: Story["mode"], extra: Partial<Story> = {}): Story {
    return { part, mode, location: "body", lines: [], fields: [], tables: [], ...extra };
  }

  /** A story for content gathered into one item, at the current place of `parent`. */
  private gathering(parent: Story, fields: OpenField[] = []): Story {
    const host = parent.mode === "document" ? parent : parent.host;
    return this.story(parent.part, "collect", {
      fields, location: parent.location,
      ...(host ? { host } : {}), ...(parent.comment !== undefined ? { comment: parent.comment } : {}),
    });
  }

  /** Reads what stands in a notes or comments part outside any note or comment. */
  readOutside(root: XmlElement, entries: Set<XmlElement>, story: Story): void {
    for (const child of root.children) {
      if (!isElement(child)) this.loose(root, child, story);
      else if (!entries.has(child)) this.visit(child, story);
    }
    this.finish(story);
  }

  /** Reads a whole story and returns its text. Its fields must close. */
  read(element: XmlElement, story: Story): string {
    this.walk(element, story);
    return this.finish(story);
  }

  private finish(story: Story): string {
    this.flush(story);
    if (story.fields.length > 0) unreadable("a field is not closed");
    return story.lines.join("\n");
  }

  place(story: Story, element: XmlElement): Place {
    const place: Place = { part: story.part, path: pathOf(element), ...(story.comment !== undefined ? { comment: story.comment } : {}) };
    const flow = story.mode === "document" ? story : story.host;
    if (flow?.building) {
      place.start = place.end = flow.building.text.length;
      flow.building.places.push(place);
    } else if (flow) place.after = this.paragraphs.length;
    return place;
  }

  item(kind: WordItemKind, text: string, place: Place, detail?: string): void {
    this.items.push({ kind, text, place, ...(detail !== undefined ? { detail } : {}) });
  }

  private revision(kind: RevisionKind, element: XmlElement, story: Story): void {
    this.revisions.push({ kind, ...stated(element.attrs), place: this.place(story, element) });
  }

  private building(story: Story): Building {
    return (story.building ??= { text: "", bytes: 0, places: [], notes: [], format: {} });
  }

  /** Ends the paragraph being built. Each note it refers to follows it. */
  private flush(story: Story): void {
    const built = story.building;
    if (!built) return;
    delete story.building;
    if (story.mode !== "document") {
      if (!blank(built.text)) story.lines.push(built.text);
      return;
    }
    if (blank(built.text) && built.notes.length === 0) {
      for (const place of built.places) {
        delete place.start;
        delete place.end;
        place.after = this.paragraphs.length;
      }
      return;
    }
    const table = story.tables.at(-1);
    const location = table ? "table" : story.location === "body" && built.format.caption ? "caption" : story.location;
    const index = this.paragraphs.length;
    this.paragraphs.push({
      text: built.text, location,
      ...(location === "body" && built.format.level !== undefined && !blank(built.text) ? { headingLevel: built.format.level } : {}),
      ...(story.note !== undefined ? { note: story.note } : {}),
      ...(built.notes.length ? { noteRefs: built.notes.map((n) => ({ at: n.at, location: n.kind, note: n.label })) } : {}),
      ...(table ? { table: { ...table } } : {}),
    });
    for (const place of built.places) place.paragraph = index;
    if (built.format.numbered && built.element) {
      this.item("list_number", "", { part: story.part, path: pathOf(built.element), paragraph: index, start: 0, end: 0 });
    }
    for (const note of built.notes) {
      const element = this.notes[note.kind].get(note.id)!;
      this.read(element, this.story(this.noteParts[note.kind], "document", { location: note.kind, note: note.label }));
    }
  }

  /** Adds visible text. Inside a field's instruction it is part of the instruction. */
  private write(story: Story, text: string, source?: XmlText): void {
    const instruction = story.fields.findLast((f) => f.from === undefined);
    if (instruction) {
      this.extend(instruction, text);
      if (source) mark(source, "reported");
      return;
    }
    if (source) mark(source, story.mode === "collect" ? "reported" : "converted");
    if (!text) return;
    const built = this.building(story);
    built.text += text;
    built.bytes += Buffer.byteLength(text);
    if (built.bytes > this.limits.text_value_bytes) overLimit("the size of one paragraph");
  }

  private extend(field: OpenField, text: string): void {
    field.instruction += text;
    field.bytes += Buffer.byteLength(text);
    if (field.bytes > this.limits.embedded_bytes) overLimit("the size of one embedded field");
  }

  walk(element: XmlElement, story: Story, except?: XmlElement): void {
    for (const child of element.children) {
      if (!isElement(child)) this.loose(element, child, story);
      else if (child !== except) this.visit(child, story);
    }
  }

  /** A text value that stands where the reader expects no converted text. */
  private loose(parent: XmlElement, node: XmlText, story: Story): void {
    if (INLINE_TEXT.has(parent.name) && story.mode === "collect") {
      this.write(story, node.text, node);
    } else if (!blank(node.text)) {
      if (LAYOUT.has(parent.name)) mark(node, "layout");
      else if (story.mode === "collect") {
        // In gathered content each other value stands on its own line.
        this.flush(story);
        this.write(story, node.text, node);
        this.flush(story);
      } else {
        mark(node, "reported");
        this.item("unexpected_text", node.text, this.place(story, parent), parent.name);
      }
    }
  }

  /** The text of an element that only holds text, such as `w:t`. */
  private textElement(element: XmlElement, story: Story, take: (node: XmlText) => void): void {
    for (const child of element.children) {
      if (isElement(child)) this.visit(child, story);
      else take(child);
    }
  }

  private visit(element: XmlElement, story: Story): void {
    const { name, attrs } = element;
    if (CONTAINERS.has(name)) return this.walk(element, story);
    if (PROPERTIES.has(name)) return this.properties(element, story);
    if (MARKERS.has(name)) return this.walk(element, story);
    if (REMOVED.has(name)) {
      this.revision(name === "w:del" ? "deletion" : "move_from", element, story);
      return this.remove(element, story);
    }
    if (GENERATED.has(name)) {
      this.item("generated_text", "", this.place(story, element), name);
      return this.walk(element, story);
    }
    switch (name) {
      case "w:p": return this.paragraph(element, story);
      case "w:r": return this.run(element, story);
      case "w:t": return this.textElement(element, story, (node) => this.write(story, node.text, node));
      case "w:tab": case "w:ptab": this.write(story, " "); return this.walk(element, story);
      case "w:br": this.write(story, attrs["w:type"] === "page" ? " " : "\n"); return this.walk(element, story);
      case "w:cr": this.write(story, "\n"); return this.walk(element, story);
      case "w:noBreakHyphen": this.write(story, "-"); return this.walk(element, story);
      case "w:softHyphen": return this.walk(element, story);
      case "w:ins": case "w:moveTo":
        this.revision(name === "w:ins" ? "insertion" : "move_to", element, story);
        return this.walk(element, story);
      // Removed text outside a tracked change is still removed text.
      case "w:delText": case "w:delInstrText": return this.remove(element, story);
      case "w:hyperlink":
        if (attrs["w:tooltip"]) this.item("attribute_text", attrs["w:tooltip"], this.place(story, element), "w:tooltip");
        return this.walk(element, story);
      case "w:tbl": return this.table(element, story);
      case "w:tr": return this.row(element, story);
      case "w:tc": return this.cell(element, story);
      case "w:sdt": return this.contentControl(element, story);
      case "w:fldSimple": return this.simpleField(element, story);
      case "w:fldChar": return this.fieldCharacter(element, story);
      case "w:instrText": return this.textElement(element, story, (node) => {
        const field = story.fields.at(-1);
        if (field && field.from === undefined) {
          this.extend(field, node.text);
          mark(node, "reported");
        } else if (!blank(node.text)) {
          mark(node, "reported");
          this.item("unexpected_text", node.text, this.place(story, element), name);
        }
      });
      case "w:fldData": {
        const field = story.fields.at(-1);
        if (!field) break;
        return this.textElement(element, story, (node) => {
          field.data = (field.data ?? "") + node.text;
          mark(node, "reported");
        });
      }
      case "w:ffData":
        for (const inner of descendants(element)) {
          const typed = inner.name === "w:default" && inner.parent?.name === "w:textInput" || inner.name === "w:listEntry";
          if (typed && inner.attrs["w:val"]) this.item("attribute_text", inner.attrs["w:val"], this.place(story, inner), inner.name);
        }
        return this.properties(element, story);
      case "w:bookmarkStart":
        if (/^ZOTERO_/i.test(attrs["w:name"] ?? "")) {
          const place = this.place(story, element);
          this.fields.push({ kind: "zotero", form: "bookmark", instruction: attrs["w:name"]!, decoded: false, from: place, to: place });
        }
        return this.walk(element, story);
      case "w:commentRangeStart": this.anchor(element, story, "start"); return this.walk(element, story);
      case "w:commentRangeEnd": this.anchor(element, story, "end"); return this.walk(element, story);
      case "w:commentReference": this.anchor(element, story, "mark"); return this.walk(element, story);
      case "w:footnoteReference": this.noteReference(element, story, "footnote"); return this.walk(element, story);
      case "w:endnoteReference": this.noteReference(element, story, "endnote"); return this.walk(element, story);
      case "w:sym":
        this.item("symbol", "", this.place(story, element), `font ${attrs["w:font"] ?? "not stated"}, character ${attrs["w:char"] ?? "not stated"}`);
        return this.walk(element, story);
      case "w:ruby": {
        for (const child of element.children) {
          if (!isElement(child)) this.loose(element, child, story);
          else if (child.name === "w:rt") this.reported(child, story, "ruby_text");
          else this.visit(child, story);
        }
        return;
      }
      case "w:drawing": case "w:pict": return this.graphic(element, story, "drawing");
      case "w:txbxContent": return this.textBox(element, story);
      case "w:object": return this.graphic(element, story, "embedded_object");
      case "mc:AlternateContent": return this.alternate(element, (branch) => this.walk(branch, story), story);
      case "a:p": this.walk(element, story); if (story.mode === "collect") this.flush(story); return;
      case "w:altChunk": {
        this.item("imported_chunk", "", this.place(story, element), this.targets.get(attrs["r:id"] ?? "") ?? "target not found");
        return this.walk(element, story);
      }
    }
    // Gathered content takes everything under it. Elsewhere, what is not known is reported.
    if (story.mode === "collect") return this.walk(element, story);
    if (name === "m:oMath" || name === "m:oMathPara") return this.reported(element, story, "equation");
    this.reported(element, story, "unknown_element", name);
  }

  /** Reports an element with the text under it, none of it converted. */
  private reported(element: XmlElement, story: Story, kind: WordItemKind, detail?: string): void {
    const place = this.place(story, element);
    // A field may begin or end inside such an element, so its fields are the surrounding ones.
    const inner = this.gathering(story, story.fields);
    this.walk(element, inner);
    this.flush(inner);
    this.item(kind, inner.lines.join("\n"), place, detail);
  }

  /** Records the tracked changes in a settings element, and reports any text in it. */
  private properties(element: XmlElement, story: Story): void {
    const visit = (node: XmlElement) => {
      for (const child of childElements(node)) {
        if (child.name.startsWith("w:") && child.name.endsWith("Change")) {
          this.revision("formatting", child, story);
          continue;
        }
        const inRunSettings = node.name === "w:rPr" && node.parent?.name === "w:pPr";
        const inserted = child.name === "w:ins" || child.name === "w:moveTo";
        const removed = REMOVED.has(child.name);
        if (inRunSettings && (inserted || removed)) this.revision(inserted ? "paragraph_mark_inserted" : "paragraph_mark_removed", child, story);
        else if (node.name === "w:trPr" && (inserted || removed)) this.revision(inserted ? "row_inserted" : "row_deleted", child, story);
        else if (child.name === "w:cellIns") this.revision("cell_inserted", child, story);
        else if (child.name === "w:cellDel") this.revision("cell_deleted", child, story);
        else if (child.name === "w:cellMerge") this.revision("cell_merged", child, story);
        else visit(child);
      }
    };
    visit(element);
    const held = [...textNodes(element)].filter((n) => n.disposition === undefined && !blank(n.text));
    if (held.length > 0) {
      for (const node of held) mark(node, "reported");
      this.item("unexpected_text", held.map((n) => n.text).join("\n"), this.place(story, element), element.name);
    }
  }

  /** Content the revision view removes. Only where its notes and comments were is kept. */
  private remove(element: XmlElement, story: Story): void {
    for (const node of textNodes(element)) mark(node, "removed");
    for (const inner of descendants(element)) {
      if (inner.name === "w:footnoteReference" || inner.name === "w:endnoteReference") {
        const note = this.notes[inner.name === "w:footnoteReference" ? "footnote" : "endnote"].get(inner.attrs["w:id"] ?? "");
        if (note) this.removedNotes.add(note);
      } else if (inner.name === "w:commentRangeStart") this.anchor(inner, story, "start", true);
      else if (inner.name === "w:commentRangeEnd") this.anchor(inner, story, "end", true);
      else if (inner.name === "w:commentReference") this.anchor(inner, story, "mark", true);
    }
  }

  private paragraph(element: XmlElement, story: Story): void {
    const properties = childNamed(element, "w:pPr");
    // Opened first, so that a change in the settings is placed in this paragraph.
    const built = this.building(story);
    if (properties) this.properties(properties, story);
    const style = this.format(value(properties, "w:pStyle"));
    const outline = value(properties, "w:outlineLvl");
    const numbering = value(childNamed(properties, "w:numPr"), "w:numId");
    const level = outline === undefined ? style.level : Number(outline) < 9 ? Number(outline) + 1 : undefined;
    const numbered = numbering === undefined ? style.numbered : numbering !== "0";
    built.format = { ...(level !== undefined ? { level } : {}), ...(style.caption ? { caption: true } : {}), ...(numbered ? { numbered } : {}) };
    built.element = element;
    this.walk(element, story, properties);
    // A paragraph whose mark is removed stays open, and the next one joins it.
    if (!marksRemoval(childNamed(properties, "w:rPr"))) this.flush(story);
  }

  private run(element: XmlElement, story: Story): void {
    const hidden = story.mode === "document" && on(childNamed(childNamed(element, "w:rPr"), "w:vanish"));
    const before = story.building;
    const from = before?.text.length ?? 0;
    this.walk(element, story);
    const built = story.building;
    if (hidden && built && (before === undefined || built === before) && built.text.length > from) {
      const place = this.place(story, element);
      place.start = from;
      this.item("hidden_text", built.text.slice(from), place);
    }
  }

  private table(element: XmlElement, story: Story): void {
    this.flush(story);
    story.tables.push({ table: story.mode === "document" ? ++this.tables : 0, row: 0, cell: 0 });
    this.walk(element, story);
    this.flush(story);
    story.tables.pop();
  }

  private row(element: XmlElement, story: Story): void {
    const properties = childNamed(element, "w:trPr");
    if (marksRemoval(properties)) {
      this.properties(properties!, story);
      return this.remove(element, story);
    }
    const table = story.tables.at(-1);
    if (table) {
      table.row++;
      table.cell = 0;
    }
    this.walk(element, story);
  }

  private cell(element: XmlElement, story: Story): void {
    const properties = childNamed(element, "w:tcPr");
    if (childNamed(properties, "w:cellDel")) {
      this.properties(properties!, story);
      return this.remove(element, story);
    }
    this.flush(story);
    const table = story.tables.at(-1);
    if (table) table.cell++;
    this.walk(element, story);
    this.flush(story);
  }

  private contentControl(element: XmlElement, story: Story): void {
    const properties = childNamed(element, "w:sdtPr");
    const tag = value(properties, "w:tag");
    const kind = (tag === undefined ? undefined : tagKind(tag)) ??
      (childNamed(properties, "w:citation") ? "word_citation" : childNamed(properties, "w:bibliography") ? "word_bibliography" : undefined);
    const placeholder = on(childNamed(properties, "w:showingPlcHdr"));
    const from = kind ? this.place(story, element) : undefined;
    for (const child of element.children) {
      if (!isElement(child)) this.loose(element, child, story);
      else if (placeholder && child.name === "w:sdtContent") this.reported(child, story, "placeholder_text");
      else this.visit(child, story);
    }
    if (kind) this.fields.push({ kind, form: "content_control", instruction: tag ?? "", decoded: false, from: from!, to: this.place(story, element) });
  }

  private simpleField(element: XmlElement, story: Story): void {
    const instruction = element.attrs["w:instr"] ?? "";
    const data = childNamed(element, "w:fldData");
    let stored: string | undefined;
    if (data) {
      stored = "";
      for (const node of textNodes(data)) {
        stored += node.text;
        mark(node, "reported");
      }
    }
    const from = this.place(story, element);
    this.walk(element, story, data);
    this.fields.push({
      kind: instructionKind(instruction), form: "simple_field", instruction,
      ...(stored !== undefined ? { data: stored } : {}), decoded: false, from, to: this.place(story, element),
    });
  }

  private fieldCharacter(element: XmlElement, story: Story): void {
    const type = element.attrs["w:fldCharType"];
    const open = story.fields.at(-1);
    if (type === "begin") {
      if (story.fields.length >= this.limits.open_fields) overLimit("the number of fields inside one another");
      story.fields.push({ instruction: "", bytes: 0 });
      return this.walk(element, story);
    }
    if ((type !== "separate" && type !== "end") || !open || (type === "separate" && open.from)) {
      unreadable("a field does not open and close in order");
    }
    this.walk(element, story);
    if (type === "separate") open!.from = this.place(story, element);
    else {
      story.fields.pop();
      const to = this.place(story, element);
      this.fields.push({
        kind: instructionKind(open!.instruction), form: "field", instruction: open!.instruction,
        ...(open!.data !== undefined ? { data: open!.data } : {}), decoded: false, from: open!.from ?? to, to,
      });
    }
  }

  private anchor(element: XmlElement, story: Story, which: "start" | "end" | "mark", removed = false): void {
    if (story.mode === "comment") return;
    const id = element.attrs["w:id"] ?? "";
    let anchor = this.anchors.get(id);
    if (!anchor) this.anchors.set(id, (anchor = {}));
    anchor[which] ??= this.place(story, element);
    if (removed) anchor.removed = true;
  }

  private noteReference(element: XmlElement, story: Story, kind: NoteKind): void {
    const id = element.attrs["w:id"] ?? "";
    const note = this.notes[kind].get(id);
    const unread = (item: WordItemKind) => this.item(item, "", this.place(story, element), `${kind} ${id}`);
    if (!note) return unread("missing_note");
    // Only body text may bring a note into the document.
    if (story.mode !== "document" || story.location !== "body" || story.fields.some((f) => f.from === undefined)) {
      return unread("unread_note_reference");
    }
    if (this.usedNotes.has(note)) return unread("repeated_note_reference");
    this.usedNotes.add(note);
    const built = this.building(story);
    built.notes.push({ kind, id, label: String(++this.labels[kind]), at: built.text.length });
  }

  /** A text box is a story of its own: its fields open and close inside it. */
  private textBox(element: XmlElement, story: Story): void {
    const place = this.place(story, element);
    this.item("text_box", this.read(element, this.gathering(story)), place);
  }

  /** A drawing, shape, or object: its text boxes and other text are reported. */
  private graphic(element: XmlElement, story: Story, kind: "drawing" | "embedded_object"): void {
    const place = this.place(story, element);
    const before = this.items.length;
    const described = new Set<string>();
    let shape = "";
    const scan = (node: XmlElement) => {
      for (const child of node.children) {
        if (!isElement(child)) {
          if (LAYOUT.has(node.name)) mark(child, "layout");
          else if (node.name === "a:t" || !blank(child.text)) {
            shape += child.text;
            mark(child, "reported");
          }
        } else if (child.name === "w:txbxContent") this.textBox(child, story);
        else if (child.name === "mc:AlternateContent") this.alternate(child, scan, story);
        else if (REMOVED.has(child.name)) this.visit(child, story);
        else {
          for (const key of ["descr", "title", "alt", "o:title", ...(child.name === "v:textpath" ? ["string"] : [])]) {
            const text = child.attrs[key];
            if (text && !blank(text) && !described.has(text)) {
              described.add(text);
              this.item("attribute_text", text, this.place(story, child), `${child.name} ${key}`);
            }
          }
          scan(child);
          if (child.name === "a:p") shape += "\n";
        }
      }
    };
    scan(element);
    if (!blank(shape)) this.item("shape_text", shape.trim(), place);
    if (kind === "embedded_object" || this.items.length === before) this.item(kind, "", place);
  }

  /**
   * One element offered in several forms. The reader takes the first whose
   * requirements it knows, else the fallback. Another form is reported when its
   * text differs, so that nothing it alone holds is dropped.
   */
  private alternate(element: XmlElement, take: (branch: XmlElement) => void, story: Story): void {
    const branches = childElements(element).filter((c) => c.name === "mc:Choice" || c.name === "mc:Fallback");
    const chosen = branches.find((b) => b.name === "mc:Choice" && b.requires!.every((r) => UNDERSTOOD.has(r))) ??
      branches.find((b) => b.name === "mc:Fallback") ?? branches[0];
    for (const child of element.children) {
      if (!isElement(child)) this.loose(element, child, story);
      else if (!branches.includes(child)) this.visit(child, story);
    }
    if (!chosen) return;
    const squashed = (text: string) => text.replace(/\s+/g, "");
    const expected = squashed(plainText(chosen));
    take(chosen);
    for (const branch of branches) {
      if (branch === chosen) continue;
      const text = plainText(branch);
      const differs = squashed(text) !== "" && squashed(text) !== expected;
      for (const node of textNodes(branch)) mark(node, differs ? "reported" : "duplicate");
      if (differs) this.item("alternate_content", text.trim(), this.place(story, branch));
    }
  }
}

/** The text values under an element in the revision view, to compare alternative forms. */
function plainText(element: XmlElement): string {
  let text = "";
  const visit = (node: XmlElement) => {
    for (const child of node.children) {
      if (!isElement(child)) {
        if (!LAYOUT.has(node.name) && (INLINE_TEXT.has(node.name) || !blank(child.text))) text += child.text;
      } else if (REMOVED.has(child.name)) {
        for (const removed of textNodes(child)) mark(removed, "removed");
      } else {
        visit(child);
        if (child.name === "w:p" || child.name === "a:p") text += "\n";
      }
    }
  };
  visit(element);
  return text;
}

// ---- The package ----

interface Relationship { id: string; type: string; target: string }

/** Parts that are taken to hold no document text. */
const SUPPORT = /^(?:\[Content_Types\]\.xml|(?:.*\/)?_rels\/[^/]*\.rels|word\/(?:styles|stylesWithEffects|settings|fontTable|webSettings|numbering|people|commentsExtended|commentsIds|commentsExtensible)\.xml|word\/theme\/[^/]+\.xml|customXml\/itemProps\d*\.xml)$/;
const TEXT_PART = /\.(?:html?|xhtml|mht|mhtml|rtf|txt)$/i;

const PART_KINDS: [RegExp, WordItemKind][] = [
  [/(?:^|\/)header\d*\.xml$/i, "header"],
  [/(?:^|\/)footer\d*\.xml$/i, "footer"],
  [/^docProps\//i, "metadata"],
  [/^customXml\//i, "custom_data"],
  [/(?:^|\/)glossary\//i, "glossary"],
  [/(?:^|\/)charts?\//i, "chart"],
  [/(?:^|\/)diagrams?\//i, "diagram"],
];

/** The relationships of a part, or undefined when it has no relationship part. */
function relationships(source: string, zip: WordZip, parse: (name: string) => XmlElement): Relationship[] | undefined {
  const slash = source.lastIndexOf("/") + 1;
  const folder = source.slice(0, slash);
  const name = `${folder}_rels/${source.slice(slash)}.rels`;
  if (!zip.names.includes(name)) return undefined;
  const found: Relationship[] = [];
  for (const element of childElements(parse(name))) {
    const { Id: id, Type: type, Target: target, TargetMode: mode } = element.attrs;
    // An external target is never fetched.
    if (!id || !type || !target || mode === "External") continue;
    const steps: string[] = [];
    for (const step of (target.startsWith("/") ? target.slice(1) : folder + target).split("/")) {
      if (step === "..") {
        if (steps.pop() === undefined) unreadable("a relationship leads outside the package");
      } else if (step !== "." && step !== "") steps.push(step);
    }
    found.push({ id, type, target: steps.join("/") });
  }
  return found;
}

/** Entries with an ID under a part's root, such as notes or comments. */
function byId(root: XmlElement, name: string): { entries: Map<string, XmlElement>; others: XmlElement[] } {
  const entries = new Map<string, XmlElement>();
  const others: XmlElement[] = [];
  for (const element of childElements(root)) {
    const type = element.attrs["w:type"];
    if (element.name !== name) continue;
    if (type !== undefined && type !== "normal") others.push(element);
    else {
      const id = element.attrs["w:id"] ?? "";
      if (entries.has(id)) unreadable("two notes or comments have one ID");
      entries.set(id, element);
    }
  }
  return { entries, others };
}

/**
 * Reads one Word file. `file` is the name the document is known by. Throws
 * `WordError` (`docx_unreadable` or `input_limit`); a failed read returns
 * nothing. `limits` may only be lowered, for tests.
 */
export function readWord(file: string, bytes: Uint8Array, limits: WordLimits = WORD_LIMITS): WordReading {
  const zip = openWordZip(bytes, limits);
  const budget = { elements: 0 };
  const parsed = new Map<string, XmlElement>();
  const parse = (name: string): XmlElement => {
    let root = parsed.get(name);
    if (!root) parsed.set(name, (root = parseXml(zip.bytes(name), limits, budget)));
    return root;
  };
  const has = new Set(zip.names);
  const needed = (name: string) => (has.has(name) ? name : unreadable("a part its relationships name is missing"));

  const packaged = relationships("", zip, parse);
  const named = packaged?.find((r) => r.type.endsWith("/officeDocument"))?.target;
  const main = named !== undefined ? needed(named) : packaged === undefined && has.has("word/document.xml") ? "word/document.xml" : unreadable("it names no main document");
  const related = relationships(main, zip, parse);
  const folder = main.slice(0, main.lastIndexOf("/") + 1);
  const partOf = (kind: string, usual: string): string | undefined => {
    if (related) {
      const found = related.find((r) => r.type.endsWith(`/${kind}`));
      return found && needed(found.target);
    }
    return has.has(folder + usual) ? folder + usual : undefined;
  };

  const root = parse(main);
  if (root.name !== "w:document" || !childNamed(root, "w:body")) unreadable("the main part is not a Word document");

  const reader = new Reader(limits);
  reader.targets = new Map((related ?? []).map((r) => [r.id, r.target]));
  const stylesPart = partOf("styles", "styles.xml");
  reader.format = styleReader(new Map((stylesPart ? childElements(parse(stylesPart)) : [])
    .filter((e) => e.name === "w:style").map((e) => [e.attrs["w:styleId"] ?? "", e])));

  const examined = new Set<string>([main]);
  const noteLists = (["footnote", "endnote"] as const).map((kind) => {
    const name = partOf(`${kind}s`, `${kind}s.xml`);
    if (!name) return undefined;
    examined.add(name);
    const found = byId(parse(name), `w:${kind}`);
    reader.notes[kind] = found.entries;
    reader.noteParts[kind] = name;
    return { kind, name, ...found };
  });

  reader.read(root, reader.story(main, "document"));

  for (const list of noteLists) {
    if (!list) continue;
    const all = new Set([...list.entries.values(), ...list.others]);
    reader.readOutside(parse(list.name), all, reader.story(list.name, "comment"));
    for (const note of all) {
      if (reader.usedNotes.has(note)) continue;
      if (reader.removedNotes.has(note)) {
        for (const node of textNodes(note)) mark(node, "removed");
        continue;
      }
      const text = reader.read(note, reader.story(list.name, "collect"));
      if (!blank(text)) {
        reader.item("unreferenced_note", text, { part: list.name, path: pathOf(note) }, note.attrs["w:type"] ?? `${list.kind} ${note.attrs["w:id"] ?? ""}`);
      }
    }
  }

  const commentsPart = partOf("comments", "comments.xml");
  if (commentsPart) examined.add(commentsPart);

  const chunks = new Set((related ?? []).filter((r) => r.type.endsWith("/aFChunk")).map((r) => r.target));
  // Every other part. Comment places inside them are found before comments are read.
  const parts: PartReport[] = zip.names.map((name) => {
    if (examined.has(name)) return { name, disposition: "read" };
    // An imported chunk is text wherever it is kept.
    if (name === stylesPart || (SUPPORT.test(name) && !chunks.has(name))) return { name, disposition: "support" };
    const kind = PART_KINDS.find(([pattern]) => pattern.test(name))?.[1] ?? "other_part";
    if (/\.xml$/i.test(name)) {
      const part = parse(name);
      examined.add(name);
      const text = reader.read(part, reader.story(name, "collect"));
      if (!blank(text)) reader.item(kind, text, { part: name, path: pathOf(part) });
      return { name, disposition: "reported" };
    }
    if (TEXT_PART.test(name)) {
      // A part in another text format, such as an imported chunk. Its source is reported
      // as it stands. It may be in another encoding, which is not damage.
      const text = new TextDecoder().decode(zip.bytes(name));
      if (!blank(text)) reader.item(kind, text, { part: name, path: "" });
      return { name, disposition: "reported" };
    }
    return { name, disposition: "not_read" };
  });

  const comments: WordComment[] = [];
  if (commentsPart) {
    const part = parse(commentsPart);
    const { entries, others } = byId(part, "w:comment");
    reader.readOutside(part, new Set([...entries.values(), ...others]), reader.story(commentsPart, "comment"));
    for (const other of others) {
      const text = reader.read(other, reader.story(commentsPart, "collect"));
      reader.item("other_part", text, { part: commentsPart, path: pathOf(other) }, "w:comment");
    }
    for (const [id, element] of entries) {
      const text = reader.read(element, reader.story(commentsPart, "comment", { comment: id }));
      const anchor = reader.anchors.get(id);
      const from = anchor?.start ?? anchor?.mark ?? anchor?.end;
      const to = anchor?.end ?? anchor?.mark ?? anchor?.start;
      const range = anchor?.start !== undefined && anchor.end !== undefined;
      const initials = element.attrs["w:initials"];
      const paragraph = range && from!.paragraph !== undefined && from!.paragraph === to!.paragraph ? reader.paragraphs[from!.paragraph] : undefined;
      comments.push({
        id, ...stated(element.attrs), ...(initials !== undefined ? { initials } : {}), text,
        anchor: range ? "range" : from ? "point" : "none",
        ...(from ? { from, to: to! } : {}),
        ...(paragraph ? { anchoredText: paragraph.text.slice(from!.start, to!.end) } : {}),
        ...(anchor?.removed ? { onRemovedText: true as const } : {}),
      });
    }
  }
  const known = new Set(comments.map((c) => c.id));
  for (const [id, anchor] of reader.anchors) {
    if (!known.has(id)) reader.item("missing_comment", "", (anchor.start ?? anchor.mark ?? anchor.end)!, `comment ${id}`);
  }

  return {
    file, sha256: createHash("sha256").update(bytes).digest("hex"), size: bytes.length,
    support: "untested", revisionView: WORD_REVISION_VIEW, coverage: [...WORD_COVERAGE],
    document: { file, paragraphs: reader.paragraphs },
    comments, fields: reader.fields, revisions: reader.revisions, items: reader.items, parts,
    account: account([...examined].map((name) => [name, parse(name)])),
  };
}

/** Fails unless every text value in the parts examined has exactly one end (BR-1502). */
export function account(parts: [string, XmlElement][]): WordAccount {
  const counts: WordAccount = { values: 0, converted: 0, removed: 0, reported: 0, layout: 0, duplicate: 0 };
  for (const [name, root] of parts) {
    for (const node of textNodes(root)) {
      if (blank(node.text)) continue;
      if (!node.disposition) throw new Error(`the Word account does not add up: a text value in ${name} has no end`);
      counts.values++;
      counts[node.disposition]++;
    }
  }
  return counts;
}

// DOCX: paragraph styles give roles, notes are kept apart with their markers,
// and tracked deletions and field instructions are left out. A DOCX has no fixed
// pages, so no page number is given.
import { type Block, encodeText, inline } from "@stemma/records";
import { type Element, find, localName, textOf, tree } from "./markup.ts";
import { type Converted, converterTool, type Identity, PartBuilder, block, cleanText, textBlock, Unconvertible } from "./model.ts";
import { readZip } from "./zip.ts";

const SKIPPED = new Set(["w:del", "w:deltext", "w:instrtext", "w:movefrom", "w:ppr", "w:rpr"]);

const child = (node: Element, name: string): Element | undefined =>
  node.children.find((c): c is Element => typeof c !== "string" && c.name === name);

export function convertDocx(bytes: Uint8Array): Converted {
  const zip = readZip(bytes);
  const main = zip.text("word/document.xml");
  if (!main) throw new Unconvertible("The DOCX has no document part.");
  const noteTexts = (part: string, element: string) => {
    const xml = zip.text(part);
    return new Map((xml ? find(tree(xml), element) : []).filter((e) => !e.attrs["w:type"]).map((e) => [e.attrs["w:id"]!, e]));
  };
  const footnotes = noteTexts("word/footnotes.xml", "footnote");
  const endnotes = noteTexts("word/endnotes.xml", "endnote");
  const builder = new PartBuilder(false);
  const notes: Block[] = [];
  let figures: Block[] = [];
  let number = 0;

  const phrase = (node: Element): string => node.children.map((c) => {
    if (typeof c === "string" || SKIPPED.has(c.name)) return "";
    if (c.name === "w:t") return encodeText(cleanText(textOf(c)));
    if (c.name === "w:tab") return " ";
    if (c.name === "w:br" || c.name === "w:cr") return c.attrs["w:type"] === "page" ? "" : "\n";
    if (c.name === "w:nobreakhyphen") return "-";
    if (c.name === "w:softhyphen") return "­";
    if (c.name === "w:footnotereference" || c.name === "w:endnotereference") {
      const note = (c.name === "w:footnotereference" ? footnotes : endnotes).get(c.attrs["w:id"]!);
      if (!note) return "";
      const label = String(++number);
      const content = find(note, "p").map(phrase).join("\n").trim();
      notes.push(block("footnote", content, { label, basis: "markup" }));
      return inline("fnref", { label }, label);
    }
    if (c.name === "wp:docpr") {
      const described = (c.attrs.descr ?? "").trim();
      figures.push(textBlock("figure", described ? `Image with the alternative text: ${described}` : "Image with no alternative text.", { by: "software:stemma-convert", basis: "markup" }));
      return "";
    }
    return phrase(c);
  }).join("");

  const paragraph = (p: Element) => {
    const properties = child(p, "w:ppr");
    const style = (properties && child(properties, "w:pstyle")?.attrs["w:val"]) ?? "";
    const content = phrase(p).trim();
    const heading = /^heading\s?([1-6])$/i.exec(style)?.[1] ?? (/^title$/i.test(style) ? "1" : undefined);
    if (content) {
      if (heading) builder.heading(block("heading", content, { level: heading, basis: "markup" }), textOf(p).trim());
      else {
        const role = /quote/i.test(style) ? "blockquote" : /caption/i.test(style) ? "caption"
          : properties && child(properties, "w:numpr") ? "list-item" : "paragraph";
        builder.add(block(role, content, { basis: "markup" }));
      }
    }
    for (const figure of figures.splice(0)) builder.add(figure);
    for (const note of notes.splice(0)) builder.add(note);
  };

  const walk = (node: Element) => {
    for (const c of node.children) {
      if (typeof c === "string" || SKIPPED.has(c.name)) continue;
      if (c.name === "w:p") paragraph(c);
      else if (c.name === "w:tbl") {
        const rows = find(c, "tr").map((tr) => `| ${tr.children.filter((x): x is Element => typeof x !== "string" && localName(x.name) === "tc")
          .map((tc) => find(tc, "p").map(phrase).join(" ").trim().replace(/\n/g, " ").replace(/\|/g, "\\|")).join(" | ")} |`);
        builder.add(block("table", rows.join("\n"), { basis: "markup" }));
        for (const note of notes.splice(0)) builder.add(note);
      } else walk(c);
    }
  };
  walk(tree(main));
  const core = zip.text("docProps/core.xml");
  const properties = core ? tree(core) : undefined;
  const stated = (name: string) => (properties ? find(properties, name).map((e) => textOf(e).trim()).find(Boolean) : undefined);
  const [title, creator, created] = [stated("title"), stated("creator"), stated("created")];
  const identity: Identity = {
    ...(title ? { title } : {}), ...(creator ? { contributors: [creator] } : {}),
    ...(title || creator ? { basis: `the DOCX core properties${created ? `; file created ${created}` : ""}` } : {}),
  };
  return {
    ...builder.build(), coverage: "all", identity, method: "markup", tools: [converterTool],
    notes: ["A DOCX has no fixed pages, so none are numbered. Tracked deletions and field codes are left out."],
  };
}

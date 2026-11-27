// Plain text, a library's plain text with its header (Project Gutenberg), and
// Markdown.
import { type Block, encodeText, inline } from "@stemma/records";
import { type Converted, converterTool, type Identity, PartBuilder, block, chapterOf, cleanText, textBlock, Unconvertible } from "./model.ts";

const START = /^\*\*\* ?START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*$/im;
const END = /^\*\*\* ?END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*$/im;

function gutenbergHeader(header: string): { identity: Identity; version?: string; notes: string[] } {
  const fields = new Map<string, string>();
  let last: string | undefined;
  for (const line of header.split("\n")) {
    const field = /^(Title|Author|Editor|Translator|Illustrator|Release date|Release Date|Most recently updated|Language|Credits|Original publication)\s*:\s*(.*)$/i.exec(line);
    if (field) {
      last = field[1]!.toLowerCase();
      fields.set(last, field[2]!.trim());
    } else if (last && /^\s+\S/.test(line)) fields.set(last, `${fields.get(last)} ${line.trim()}`.trim());
    else last = undefined;
  }
  const release = fields.get("release date");
  const number = /\[\s*e(?:book|text)\s*#\s*(\d+)\s*\]/i.exec(header)?.[1];
  const people = ["author", "editor", "translator", "illustrator"].flatMap((f) => (fields.get(f) ? [fields.get(f)!] : []));
  const title = fields.get("title");
  const released = release?.replace(/\s*\[.*$/, "").trim();
  const version = [released ? `Released ${released}` : "", fields.get("most recently updated") ? `most recently updated ${fields.get("most recently updated")}` : ""].filter(Boolean).join("; ");
  return {
    identity: {
      ...(title ? { title } : {}), ...(people.length > 0 ? { contributors: people } : {}),
      ...(number ? { identifiers: [{ scheme: "gutenberg", value: number }] } : {}),
      basis: "the Project Gutenberg header in the file",
    },
    ...(version ? { version } : {}),
    notes: [
      ...(fields.get("credits") ? [`Credits stated by the library: ${fields.get("credits")}`] : []),
      ...(fields.get("language") ? [`Language stated by the library: ${fields.get("language")}`] : []),
      ...(fields.get("original publication") ? [`Original publication as the library states it: ${fields.get("original publication")}`] : []),
    ],
  };
}

const paragraphs = (text: string): string[] => text.split(/\n[ \t]*\n/).map((p) => p.replace(/^\n+|\s+$/g, "")).filter((p) => p.trim() !== "");

export function convertText(input: string): Converted {
  const text = cleanText(input);
  if (!/\S/u.test(text)) throw new Unconvertible("There is no machine-readable text: it is empty or only white space.");
  const start = START.exec(text);
  const end = END.exec(text);
  const library = start && end && end.index > start.index;
  if (text.includes("\f") && !library) {
    const pages = text.split("\f");
    if (pages.length > 1 && !/\S/u.test(pages.at(-1)!)) pages.pop();
    return {
      paged: true, coverage: "all", page_count: pages.length, identity: {}, method: "born_text", tools: [converterTool],
      notes: ["Pages are divided at the form feeds in the text."],
      parts: pages.map((page, index) => {
        const trimmed = page.replace(/^\n+|\n+$/g, "");
        return {
          index, label: { status: "undetermined" }, columns: "undetermined",
          undetermined: ["paragraphs", "headings", "footnotes", "block-quotes", "tables", "captions", "figures", "running-heads", "folio"],
          blocks: trimmed.trim() ? [textBlock("undetermined", trimmed)] : [],
        };
      }),
    };
  }
  const header = library ? text.slice(0, start.index + start[0].length) : "";
  const footer = library ? text.slice(end.index) : "";
  const body = library ? text.slice(start.index + start[0].length, end.index) : text;
  const builder = new PartBuilder(false);
  const blank = { basis: "blank-line" };
  if (header) builder.add(textBlock("boilerplate", header.trim(), { basis: "boundary-mark" }));
  const all = paragraphs(body);
  // Notes are paired only where the text gives both a "[Footnote N: …]" block and the same marker.
  const noteLabels = new Set(all.flatMap((p) => /^\s*\[Footnote ([0-9]{1,4}|[A-Z]):/.exec(p)?.[1] ?? []));
  const used = new Set<string>();
  for (const paragraph of all) {
    const single = !paragraph.includes("\n");
    const note = /^\s*\[Footnote ([0-9]{1,4}|[A-Z]):[\s\S]*\]\s*$/.exec(paragraph);
    if (note) builder.add(textBlock("footnote", paragraph, { label: note[1]!, basis: "boundary-mark" }));
    else if (single && chapterOf(paragraph)) builder.heading(textBlock("heading", paragraph.trim(), { level: "2", basis: "chapter-line" }), paragraph.trim());
    else if (/^\s*\[Illustration[^\]]*\]\s*$/.test(paragraph)) builder.add(textBlock("figure", paragraph.trim(), { by: "software:stemma-convert", basis: "boundary-mark" }));
    else {
      const content = encodeText(paragraph).replace(/\[([0-9]{1,4}|[A-Z])\]/g, (whole, label: string) => {
        if (!noteLabels.has(label)) return whole;
        used.add(label);
        return inline("fnref", { label }, whole);
      });
      builder.add(block("paragraph", content, blank));
    }
  }
  if (footer) builder.add(textBlock("boilerplate", footer.trim(), { basis: "boundary-mark" }));
  const built = builder.build(["headings", "block-quotes", "tables", "captions"]);
  const found = library ? gutenbergHeader(header) : { identity: {} as Identity, notes: [] as string[] };
  return {
    ...built, coverage: "all", identity: found.identity, method: "born_text", tools: [converterTool],
    ...("version" in found && found.version ? { version: found.version } : {}),
    notes: [
      "A plain text has no pages here and is given none. Paragraphs are divided at blank lines; headings are recognized only as chapter lines.",
      ...(library ? ["The library's text before and after the work is kept and marked as boilerplate."] : []),
      ...found.notes,
    ],
  };
}

const plainInline = (line: string): string => line
  .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
  .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  .replace(/(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g, "$2")
  .replace(/(?<![\w*])\*(?=\S)(.+?)(?<=\S)\*(?![\w*])/g, "$1")
  .replace(/(?<![\w_])_(?=\S)(.+?)(?<=\S)_(?![\w_])/g, "$1")
  .replace(/`([^`]*)`/g, "$1");

export function convertMarkdown(input: string): Converted {
  let text = cleanText(input);
  if (!/\S/u.test(text)) throw new Unconvertible("There is no machine-readable text: it is empty or only white space.");
  const identity: Identity = {};
  const front = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (front) {
    text = text.slice(front[0].length);
    for (const line of front[1]!.split("\n")) {
      const [, key, raw] = /^([A-Za-z_]+)\s*:\s*(.*)$/.exec(line) ?? [];
      const value = raw?.trim().replace(/^(["'])(.*)\1$/, "$2");
      if (!key || !value) continue;
      if (key === "title") identity.title = value;
      if (key === "author") identity.contributors = [value];
      if (key === "date") identity.issued = value;
      if (key === "publisher") identity.publisher = value;
      if (key === "doi" || key === "isbn") identity.identifiers = [...(identity.identifiers ?? []), { scheme: key, value }];
    }
    if (Object.keys(identity).length > 0) identity.basis = "the file's front matter";
  }
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  const defined = new Set([...text.matchAll(/^\[\^([^\]\s]+)\]:/gm)].map((m) => m[1]!));
  const phrase = (value: string): string => {
    const figures = [...value.matchAll(/!\[([^\]]*)\]\([^)]*\)/g)].map((m) => m[1]!);
    for (const alt of figures) pendingFigures.push(textBlock("figure", alt ? `Image with the alternative text: ${alt}` : "Image with no alternative text.", { by: "software:stemma-convert", basis: "markup" }));
    return encodeText(plainInline(value)).replace(/\[\^([^\]\s]+)\]/g, (whole, label: string) =>
      defined.has(label) ? inline("fnref", { label }, encodeText(label)) : whole);
  };
  const pendingFigures: Block[] = [];
  const builder = new PartBuilder(false);
  const lines = text.split("\n");
  const emit = (b: Block) => {
    builder.add(b);
    for (const figure of pendingFigures.splice(0)) builder.add(figure);
  };
  for (let i = 0; i < lines.length; ) {
    const line = lines[i]!;
    const markup = { basis: "markup" };
    const take = (test: (l: string) => boolean): string[] => {
      const taken = [lines[i++]!];
      while (i < lines.length && test(lines[i]!)) taken.push(lines[i++]!);
      return taken;
    };
    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    const note = /^\[\^([^\]\s]+)\]:\s*(.*)$/.exec(line);
    const starts = (l: string) => /^(#{1,6}\s|>|\||\[\^[^\]]+\]:|\s*(?:[-*+]|\d+[.)])\s|```)/.test(l);
    if (line.trim() === "") i++;
    else if (heading) {
      i++;
      builder.heading(block("heading", phrase(heading[2]!), { level: String(heading[1]!.length), ...markup }), plainInline(heading[2]!));
      for (const figure of pendingFigures.splice(0)) builder.add(figure);
    } else if (note) {
      const rest = take((l) => /^\s{2,}\S/.test(l)).slice(1);
      emit(block("footnote", phrase([note[2]!, ...rest.map((l) => l.trim())].join("\n")), { label: note[1]!, ...markup }));
    } else if (line.startsWith("```")) {
      i++;
      const code: string[] = [];
      while (i < lines.length && !lines[i]!.startsWith("```")) code.push(lines[i++]!);
      i++;
      emit(block("paragraph", encodeText(code.join("\n")), markup));
    } else if (line.startsWith(">")) {
      emit(block("blockquote", phrase(take((l) => l.startsWith(">")).map((l) => l.replace(/^>\s?/, "")).join("\n")), markup));
    } else if (line.startsWith("|")) {
      emit(block("table", take((l) => l.startsWith("|")).map(phrase).join("\n"), markup));
    } else if (/^\s*(?:[-*+]|\d+[.)])\s/.test(line)) {
      const item = take((l) => /^\s{2,}\S/.test(l) && !/^\s*(?:[-*+]|\d+[.)])\s/.test(l));
      emit(block("list-item", phrase(item.map((l, n) => (n === 0 ? l.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "") : l.trim())).join("\n")), markup));
    } else {
      const content = phrase(take((l) => l.trim() !== "" && !starts(l)).join("\n")).trim();
      emit(block("paragraph", content, markup));
    }
  }
  return {
    ...builder.build(), coverage: "all", identity, method: "markup", tools: [converterTool],
    notes: ["Markdown syntax gives the structure; emphasis, link, and code marks are removed from the text, and images are described by their alternative text."],
  };
}

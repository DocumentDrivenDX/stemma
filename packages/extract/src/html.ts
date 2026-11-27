// HTML and XHTML: roles come from elements, which state them (basis "markup").
// Page markers the source carries make pages; otherwise there are no pages.
import { type Block, encodeText, inline } from "@stemma/records";
import { type Element, elements, find, localName, textOf, tree } from "./markup.ts";
import { type Converted, type Identity, PartBuilder, block, cleanText, converterTool, textBlock } from "./model.ts";

const SKIP = new Set(["script", "style", "noscript", "template", "head", "iframe", "object", "svg", "form", "button", "select"]);
const CONTAINERS = new Set(["#root", "html", "body", "div", "section", "article", "main", "header", "footer", "aside", "nav", "figure", "ul", "ol", "dl"]);
const BLOCKS: Record<string, string> = {
  p: "paragraph", blockquote: "blockquote", li: "list-item", dt: "paragraph", dd: "paragraph", pre: "paragraph",
  figcaption: "caption", caption: "caption",
};

const tokensOf = (value: string | undefined): string[] => (value ?? "").split(/\s+/).filter(Boolean);
const has = (e: Element, attr: string, ...values: string[]) => tokensOf(e.attrs[attr]).some((t) => values.includes(t));

const isBoilerplate = (e: Element) => /^pg-(header|footer|machine-header)$/.test(e.attrs.id ?? "") || has(e, "class", "pg-boilerplate", "pgheader", "pgfooter");
const isPageMarker = (e: Element) =>
  has(e, "epub:type", "pagebreak") || e.attrs.role === "doc-pagebreak" || has(e, "class", "pagenum", "pageno", "page-number");
const isNoteBody = (e: Element) =>
  has(e, "epub:type", "footnote", "endnote", "rearnote") || e.attrs.role === "doc-footnote" || has(e, "class", "footnote", "footnote-item");
const isNoteRef = (e: Element) => e.name === "a" && (has(e, "epub:type", "noteref") || e.attrs.role === "doc-noteref" || has(e, "class", "footnote-ref", "fnanchor", "noteref"));

const markerLabel = (e: Element): string => {
  const stated = e.attrs.title ?? e.attrs["aria-label"] ?? textOf(e);
  return stated.replace(/[[\]{}()]/g, " ").replace(/\b(?:pg|page|p)\b\.?/gi, " ").trim();
};

const squeeze = (text: string) => text.replace(/[ \t\n\r\f]+/g, " ");

/** The text of an element with note markers marked, and page markers reported as they pass. */
function phrase(node: Element, onPage: (label: string) => void, figures: Block[]): string {
  let out = "";
  for (const child of node.children) {
    if (typeof child === "string") out += encodeText(squeeze(cleanText(child)));
    else if (SKIP.has(child.name)) continue;
    else if (child.name === "br") out += "\n";
    else if (child.name === "img") figures.push(figureOf(child));
    else if (isPageMarker(child)) onPage(markerLabel(child));
    else if (isNoteRef(child)) {
      const text = squeeze(textOf(child)).trim();
      const label = text.replace(/^\[|\]$/g, "");
      out += inline("fnref", { label }, encodeText(text));
    } else out += phrase(child, onPage, figures);
  }
  return out;
}

const figureOf = (image: Element): Block => {
  const alt = squeeze(cleanText(image.attrs.alt ?? "")).trim();
  return textBlock("figure", alt ? `Image with the alternative text: ${alt}` : "Image with no alternative text.", { by: "software:stemma-convert", basis: "markup" });
};

const tidy = (content: string) => content.split("\n").map((l) => l.trim()).join("\n").trim();

/** Walks one document into the builder. */
export function walkHtml(document: Element, builder: PartBuilder): void {
  let loose: string[] = [];
  let figures: Block[] = [];
  const pending: string[] = [];
  const onPage = (label: string) => {
    if (label) pending.push(label);
  };
  const breakNow = () => {
    for (const label of pending.splice(0)) builder.pageBreak(label);
  };
  const emit = (content: Block, plain?: string) => {
    if (content.role === "heading") builder.heading(content, plain!);
    else builder.add(content);
    for (const figure of figures.splice(0)) builder.add(figure);
  };
  const flush = (role: string) => {
    const content = tidy(loose.join(""));
    loose = [];
    if (content) emit(block(role, content, { basis: "markup" }));
    breakNow();
  };
  const walk = (node: Element, role: string) => {
    for (const child of node.children) {
      if (typeof child === "string") {
        if (child.trim() !== "" || loose.length > 0) loose.push(encodeText(squeeze(cleanText(child))));
        continue;
      }
      if (SKIP.has(child.name)) continue;
      if (isBoilerplate(child)) {
        flush(role);
        const text = tidy(phrase(child, () => {}, []));
        if (text) emit(block("boilerplate", text, { basis: "markup" }));
      } else if (isPageMarker(child)) {
        flush(role);
        onPage(markerLabel(child));
        breakNow();
      } else if (isNoteBody(child)) {
        flush(role);
        const text = tidy(phrase(child, onPage, figures));
        const first = /^\[?([0-9]{1,4}|[*†‡§])\]?[.:)]?\s/.exec(text)?.[1] ?? find(child, "a").map((a) => squeeze(textOf(a)).trim().replace(/^\[|\]$/g, "")).find(Boolean);
        emit(block("footnote", text, { ...(first ? { label: first } : {}), basis: "markup" }));
      } else if (/^h[1-6]$/.test(child.name)) {
        flush(role);
        const content = tidy(phrase(child, onPage, figures));
        breakNow();
        if (content) emit(block("heading", content, { level: child.name.slice(1), basis: "markup" }), squeeze(textOf(child)).trim());
      } else if (child.name === "table") {
        flush(role);
        for (const caption of find(child, "caption")) emit(block("caption", tidy(phrase(caption, onPage, figures)), { basis: "markup" }));
        const rows = find(child, "tr").map((tr) => `| ${tr.children.filter((c): c is Element => typeof c !== "string" && (c.name === "td" || c.name === "th"))
          .map((c) => tidy(phrase(c, onPage, figures)).replace(/\n/g, " ").replace(/\|/g, "\\|")).join(" | ")} |`);
        emit(block("table", rows.join("\n"), { basis: "markup" }));
        breakNow();
      } else if (Object.hasOwn(BLOCKS, child.name)) {
        flush(role);
        const mine = BLOCKS[child.name]!;
        // A quotation or list item that holds paragraphs keeps its own role.
        if ([...elements(child)].some((e) => Object.hasOwn(BLOCKS, e.name))) {
          walk(child, mine);
          flush(mine);
        } else {
          loose.push(phrase(child, onPage, figures));
          flush(mine === "paragraph" ? role : mine);
        }
      } else if (CONTAINERS.has(child.name)) {
        flush(role);
        walk(child, role);
        flush(role);
      } else if (child.name === "img") figures.push(figureOf(child));
      else if (child.name === "br") loose.push("\n");
      else if (isNoteRef(child) || child.name === "a" || child.name === "sup" || child.name === "span" || child.name === "em" || child.name === "i" || child.name === "b" || child.name === "strong") {
        loose.push(phrase({ name: "#inline", attrs: {}, children: [child] }, onPage, figures));
      } else walk(child, role);
    }
  };
  walk(document, "paragraph");
  flush("paragraph");
  for (const figure of figures.splice(0)) builder.add(figure);
}

export const hasPageMarkers = (document: Element): boolean => [...elements(document)].some((e) => isPageMarker(e) && markerLabel(e) !== "");

function htmlIdentity(document: Element): Identity {
  const meta = new Map<string, string[]>();
  for (const element of find(document, "meta")) {
    const name = (element.attrs.name ?? element.attrs.property ?? "").toLowerCase();
    if (name && element.attrs.content) meta.set(name, [...(meta.get(name) ?? []), squeeze(element.attrs.content).trim()]);
  }
  const first = (...names: string[]) => names.map((n) => meta.get(n)?.[0]).find(Boolean);
  const title = first("citation_title", "dc.title", "dcterms.title", "og:title") ?? (squeeze(find(document, "title").map(textOf)[0] ?? "").trim() || undefined);
  const contributors = ["citation_author", "dc.creator", "dcterms.creator", "author"].map((n) => meta.get(n)).find(Boolean);
  const doi = first("citation_doi", "dc.identifier.doi");
  const issued = first("citation_publication_date", "dc.date", "dcterms.date");
  const venue = first("citation_journal_title");
  const publisher = first("citation_publisher", "dc.publisher");
  const found: Identity = {
    ...(title ? { title } : {}), ...(contributors ? { contributors } : {}), ...(issued ? { issued } : {}),
    ...(venue ? { venue } : {}), ...(publisher ? { publisher } : {}), ...(doi ? { identifiers: [{ scheme: "doi", value: doi }] } : {}),
  };
  return Object.keys(found).length > 0 ? { ...found, basis: "the document's title and meta elements" } : {};
}

export function convertHtml(source: string): Converted {
  const document = tree(source, true);
  const builder = new PartBuilder(hasPageMarkers(document));
  walkHtml(document, builder);
  const built = builder.build();
  return {
    ...built, coverage: "all", identity: htmlIdentity(document), method: "markup", tools: [converterTool],
    notes: ["Images are described by their alternative text; scripts, styles and linked files were neither run nor fetched."],
  };
}

export { localName };

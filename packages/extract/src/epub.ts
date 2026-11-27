// EPUB: the package document gives the metadata and the reading order; each
// document in it is read as XHTML.
import { posix } from "node:path";
import { hasPageMarkers, walkHtml } from "./html.ts";
import { elements, find, localName, textOf, tree } from "./markup.ts";
import { type Converted, converterTool, type Identity, PartBuilder, Unconvertible } from "./model.ts";
import { readZip } from "./zip.ts";

export function convertEpub(bytes: Uint8Array): Converted {
  const zip = readZip(bytes);
  const container = zip.text("META-INF/container.xml");
  const rootPath = container && find(tree(container), "rootfile")[0]?.attrs["full-path"];
  const packageText = rootPath ? zip.text(rootPath) : undefined;
  if (!rootPath || !packageText) throw new Unconvertible("The EPUB has no package document.");
  const document = tree(packageText);
  const metadata = (name: string) => [...elements(document)].filter((e) => e.name === `dc:${name}`).map((e) => textOf(e).trim()).filter(Boolean);
  const items = new Map(find(document, "item").map((e) => [e.attrs.id, e.attrs]));
  const chapters = find(document, "itemref").flatMap((ref) => {
    const item = items.get(ref.attrs.idref);
    if (!item?.href || (item.properties ?? "").split(/\s+/).includes("nav")) return [];
    const path = posix.join(posix.dirname(rootPath), decodeURIComponent(item.href.split("#")[0]!));
    const text = zip.text(path);
    if (text === undefined) throw new Unconvertible("The EPUB's reading order names a document it does not hold.");
    return [tree(text, true)];
  });
  if (chapters.length === 0) throw new Unconvertible("The EPUB has no documents in its reading order.");
  const builder = new PartBuilder(chapters.some(hasPageMarkers));
  for (const chapter of chapters) {
    builder.newSection();
    walkHtml(find(chapter, "body")[0] ?? chapter, builder);
  }
  const identifiers = metadata("identifier").flatMap((value) => {
    const isbn = /(?:isbn[: ]*)?(97[89][-0-9]{10,14}|\d{9}[\dXx])$/i.exec(value);
    const doi = /(10\.\d{4,9}\/\S+)$/.exec(value);
    const gutenberg = /gutenberg\.org\/(?:ebooks\/)?(\d+)$/.exec(value);
    return doi ? [{ scheme: "doi", value: doi[1]! }] : gutenberg ? [{ scheme: "gutenberg", value: gutenberg[1]! }]
      : isbn ? [{ scheme: "isbn", value: isbn[1]! }] : [{ scheme: "uri", value }];
  });
  const [title] = metadata("title");
  const identity: Identity = {
    ...(title ? { title } : {}),
    ...(metadata("creator").length > 0 ? { contributors: metadata("creator") } : {}),
    ...(metadata("date")[0] ? { issued: metadata("date")[0] } : {}),
    ...(metadata("publisher")[0] ? { publisher: metadata("publisher")[0] } : {}),
    ...(identifiers.length > 0 ? { identifiers } : {}),
    basis: "the EPUB package document",
  };
  return {
    ...builder.build(), coverage: "all", identity, method: "markup", tools: [converterTool],
    notes: ["Images are described by their alternative text and stay with the original."],
  };
}

export { localName };

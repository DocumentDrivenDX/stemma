// A small tag reader for HTML, XHTML, and the XML inside EPUB and DOCX. It
// decodes character references only: no entity declarations, no external
// references, nothing run or fetched.
export type Token =
  | { type: "open"; name: string; attrs: Record<string, string>; closed: boolean }
  | { type: "close"; name: string }
  | { type: "text"; text: string };

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", shy: "­", mdash: "—", ndash: "–",
  hellip: "…", lsquo: "‘", rsquo: "’", sbquo: "‚", ldquo: "“", rdquo: "”", bdquo: "„",
  laquo: "«", raquo: "»", copy: "©", reg: "®", trade: "™", sect: "§", para: "¶",
  deg: "°", times: "×", divide: "÷", plusmn: "±", middot: "·", bull: "•",
  dagger: "†", Dagger: "‡", prime: "′", Prime: "″", frac12: "½", frac14: "¼",
  frac34: "¾", pound: "£", euro: "€", cent: "¢", yen: "¥", thinsp: " ",
  ensp: " ", emsp: " ", aelig: "æ", AElig: "Æ", oelig: "œ", OElig: "Œ", szlig: "ß",
  agrave: "à", aacute: "á", acirc: "â", atilde: "ã", auml: "ä", aring: "å", ccedil: "ç",
  egrave: "è", eacute: "é", ecirc: "ê", euml: "ë", igrave: "ì", iacute: "í", icirc: "î",
  iuml: "ï", ntilde: "ñ", ograve: "ò", oacute: "ó", ocirc: "ô", otilde: "õ", ouml: "ö",
  oslash: "ø", ugrave: "ù", uacute: "ú", ucirc: "û", uuml: "ü", yacute: "ý", Eacute: "É",
  Auml: "Ä", Ouml: "Ö", Uuml: "Ü", minus: "−", larr: "←", rarr: "→", iexcl: "¡",
};

export const decodeReferences = (text: string): string =>
  text.replace(/&(#x[0-9a-fA-F]{1,6}|#\d{1,7}|[A-Za-z][A-Za-z0-9]{1,10});/g, (whole, name: string) => {
    if (name[0] !== "#") return Object.hasOwn(NAMED, name) ? NAMED[name]! : whole;
    const code = name[1] === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : "\ufffd";
  });

const RAW = new Set(["script", "style"]);

export function* tokens(source: string): Generator<Token> {
  let at = 0;
  const length = source.length;
  while (at < length) {
    const next = source.indexOf("<", at);
    if (next < 0) {
      yield { type: "text", text: decodeReferences(source.slice(at)) };
      return;
    }
    if (next > at) yield { type: "text", text: decodeReferences(source.slice(at, next)) };
    const skip = (until: string) => {
      const end = source.indexOf(until, next);
      at = end < 0 ? length : end + until.length;
    };
    if (source.startsWith("<!--", next)) skip("-->");
    else if (source.startsWith("<![CDATA[", next)) {
      const end = source.indexOf("]]>", next);
      yield { type: "text", text: source.slice(next + 9, end < 0 ? length : end) };
      at = end < 0 ? length : end + 3;
    } else if (source.startsWith("<!", next) || source.startsWith("<?", next)) skip(">");
    else {
      const tag = /<(\/?)([A-Za-z][^\s/>]*)((?:"[^"]*"|'[^']*'|[^"'>])*)>/y;
      tag.lastIndex = next;
      const found = tag.exec(source);
      if (!found) {
        yield { type: "text", text: "<" };
        at = next + 1;
        continue;
      }
      at = tag.lastIndex;
      const name = found[2]!.toLowerCase();
      if (found[1]) yield { type: "close", name };
      else {
        const attrs: Record<string, string> = Object.create(null);
        for (const [, key, a, b, c] of found[3]!.matchAll(/([^\s=/"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
          attrs[key!.toLowerCase()] = decodeReferences(a ?? b ?? c ?? "");
        }
        const closed = /\/\s*$/.test(found[3]!);
        yield { type: "open", name, attrs, closed };
        if (RAW.has(name) && !closed) {
          const end = source.toLowerCase().indexOf(`</${name}`, at);
          at = end < 0 ? length : end;
        }
      }
    }
  }
}

export interface Element { name: string; attrs: Record<string, string>; children: (Element | string)[] }

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

/** A forgiving tree: an unmatched end tag is ignored, and depth is bounded. */
export function tree(source: string, html = false): Element {
  const root: Element = { name: "#root", attrs: {}, children: [] };
  const stack: Element[] = [root];
  for (const token of tokens(source)) {
    const top = stack.at(-1)!;
    if (token.type === "text") top.children.push(token.text);
    else if (token.type === "open") {
      // HTML closes an open paragraph or list item when the next one starts.
      if (html && (token.name === "p" || token.name === "li") && stack.at(-1)!.name === token.name) stack.pop();
      const element: Element = { name: token.name, attrs: token.attrs, children: [] };
      stack.at(-1)!.children.push(element);
      if (!token.closed && !(html && VOID.has(token.name)) && stack.length < 200) stack.push(element);
    } else {
      const index = stack.map((e) => e.name).lastIndexOf(token.name);
      if (index > 0) stack.length = index;
    }
  }
  return root;
}

export function* elements(node: Element): Generator<Element> {
  for (const child of node.children) {
    if (typeof child !== "string") {
      yield child;
      yield* elements(child);
    }
  }
}

export const textOf = (node: Element): string => node.children.map((c) => (typeof c === "string" ? c : textOf(c))).join("");
export const localName = (name: string): string => name.slice(name.indexOf(":") + 1);
export const find = (node: Element, name: string): Element[] => [...elements(node)].filter((e) => localName(e.name) === name);

// TeX source to plain text, by a fixed table, to map a BibLaTeX value (SD-003).
// Nothing is expanded or run. A command or math outside the table gives no text,
// so the value stays preserved and unmapped.

/** Accent commands and the combining character each adds. */
const ACCENTS: Record<string, string> = {
  "'": "́", "`": "̀", "^": "̂", '"': "̈", "~": "̃", "=": "̄", ".": "̇",
  c: "̧", v: "̌", u: "̆", H: "̋", k: "̨", r: "̊", d: "̣", b: "̱",
};
const SYMBOLS: Record<string, string> = {
  ss: "ß", ae: "æ", AE: "Æ", oe: "œ", OE: "Œ", o: "ø", O: "Ø", aa: "å", AA: "Å", l: "ł", L: "Ł", i: "i", j: "j",
  textendash: "–", textemdash: "—", "&": "&", "%": "%", $: "$", "#": "#", _: "_", "{": "{", "}": "}", " ": " ",
};
/** Commands that only change how text looks. Their text is kept. */
const FORMATTING = new Set(["emph", "textit", "textbf", "textsc", "textsl", "textsf", "texttt", "textrm", "textup", "mbox"]);
const LIGATURES: [string, string][] = [["---", "—"], ["--", "–"], ["``", "“"], ["''", "”"]];

export interface PlainText {
  text: string;
  /** True when formatting was dropped. */
  approximated: boolean;
}

export function texToText(source: string): PlainText | undefined {
  const out: string[] = [];
  let approximated = false;
  /** An accent waiting for its letter. */
  let accents: string[] = [];
  const emit = (s: string) => {
    if (accents.length === 0 || s === "") {
      out.push(s);
      return;
    }
    out.push((s[0]! + accents.reverse().join("") + s.slice(1)).normalize("NFC"));
    accents = [];
  };
  const command = /\\(?:([A-Za-z]+)[ \t\r\n]*|([\s\S]))/y;
  for (let at = 0; at < source.length;) {
    const c = source[at]!;
    if (c === "\\") {
      command.lastIndex = at;
      const found = command.exec(source);
      if (!found) return undefined;
      at = command.lastIndex;
      const name = found[1] ?? found[2]!;
      if (Object.hasOwn(ACCENTS, name)) accents.push(ACCENTS[name]!);
      else if (Object.hasOwn(SYMBOLS, name)) emit(SYMBOLS[name]!);
      else if (FORMATTING.has(name) && source[at] === "{") approximated = true;
      else return undefined;
      if (accents.length > 4) return undefined;
      continue;
    }
    if (c === "$") return undefined;
    if (c === "{" || c === "}") {
      at++;
      continue;
    }
    if (c === "%") return undefined;
    const ligature = LIGATURES.find(([from]) => source.startsWith(from, at));
    if (ligature) {
      emit(ligature[1]);
      at += ligature[0].length;
      continue;
    }
    if (/\s/.test(c) && accents.length > 0) {
      at++;
      continue;
    }
    const code = String.fromCodePoint(source.codePointAt(at)!);
    emit(code === "~" ? " " : code);
    at += code.length;
  }
  if (accents.length > 0) return undefined;
  return { text: out.join("").replace(/[ \t\r\n\f]+/g, " ").replace(/^ | $/g, ""), approximated };
}

/** Split at brace depth 0 wherever the sticky `separator` matches. The parser has already bounded depth. */
export function splitOuter(source: string, separator: RegExp): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let at = 0; at < source.length; at++) {
    const c = source[at]!;
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (depth === 0) {
      separator.lastIndex = at;
      const found = separator.exec(source);
      if (found && found[0].length > 0) {
        parts.push(source.slice(start, at));
        at += found[0].length - 1;
        start = at + 1;
      }
    }
  }
  parts.push(source.slice(start));
  return parts;
}

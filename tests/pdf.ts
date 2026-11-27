// Builds small synthetic PDFs for tests and the install check. Every word in them
// is invented. Fonts are named, never embedded, so reading them exercises the
// font and character-map data that ships with the plugin.

/** A line with its own place or size, or made of pieces such as a raised note marker. */
export interface PdfLineSpec { segments: { text: string; size?: number; rise?: number }[]; x?: number; y?: number; size?: number }

export interface PdfOptions {
  /** Printed lines of each page; an empty list is a page with no text. */
  pages: (string | PdfLineSpec)[][];
  /** A page-label dictionary body, for example `/Nums [0 << /S /r >> 1 << /S /D >>]`. */
  labels?: string;
  /**
   * "latin" uses non-embedded Helvetica. "japanese" uses a non-embedded CID font
   * with a predefined character map, which cannot be read without that map.
   */
  font?: "latin" | "japanese";
  /** Marks the file as encrypted with a password nobody has. */
  encrypted?: boolean;
  /** Pictures drawn on pages, each a square 200 units wide at the given place. */
  images?: PdfImage[];
  /**
   * Adds everything a viewer must leave alone: scripts run on opening, on the
   * page and from a link, links to this address, a form with a field that has a
   * script, an XFA entry, a launch action, and an attached file.
   */
  hostile?: { address: string };
}

/** An image of a PDF page; `data` is what `filter` decodes, written in hexadecimal. */
export interface PdfImage { page: number; x: number; y: number; width: number; height: number; filter: string; entries: string; data: Uint8Array }

/** WinAnsi codes for the dash and curly quotation marks, as octal escapes. */
const WIN_ANSI: Record<string, string> = { "\u2014": "\\227", "\u2018": "\\221", "\u2019": "\\222", "\u201c": "\\223", "\u201d": "\\224" };
const latin = (text: string) => `(${text.replace(/[\\()]/g, "\\$&").replace(/[\u2014\u2018\u2019\u201c\u201d]/g, (c) => WIN_ANSI[c]!)})`;
const ucs2 = (text: string) => `<${[...text].map((c) => c.charCodeAt(0).toString(16).padStart(4, "0")).join("")}>`;

export function makePdf(options: PdfOptions): Uint8Array {
  const japanese = options.font === "japanese";
  const objects: string[] = [];
  const add = (body: string) => objects.push(body);
  const catalog = add("");
  const tree = add("");
  const font = add("");
  if (japanese) {
    const descendant = objects.length + 1;
    add("<< /Type /Font /Subtype /CIDFontType0 /BaseFont /HeiseiMin-W3 /CIDSystemInfo << /Registry (Adobe) /Ordering (Japan1) /Supplement 2 >> /FontDescriptor " +
      `${descendant + 1} 0 R >>`);
    add("<< /Type /FontDescriptor /FontName /HeiseiMin-W3 /Flags 6 /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 700 /StemV 80 >>");
    objects[font - 1] = `<< /Type /Font /Subtype /Type0 /BaseFont /HeiseiMin-W3 /Encoding /UniJIS-UCS2-H /DescendantFonts [${descendant} 0 R] >>`;
  } else {
    objects[font - 1] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  }
  /** The annotations of the first page, when the file is hostile. */
  let annotations = "";
  let catalogEntries = "";
  if (options.hostile) {
    const { address } = options.hostile;
    const script = (code: string) => `<< /S /JavaScript /JS ${latin(code)} >>`;
    const alarm = script(`app.alert("ran"); this.submitForm("${address}/js"); app.launchURL("${address}/launched", true);`);
    const attached = add("<< /Type /EmbeddedFile /Length 15 >>\nstream\nATTACHED-SECRET\nendstream");
    const spec = add(`<< /Type /Filespec /F (attached.html) /EF << /F ${attached} 0 R >> >>`);
    const rect = "/Rect [0 0 600 800]";
    const annots = [
      add(`<< /Type /Annot /Subtype /Link ${rect} /A << /S /URI /URI ${latin(`${address}/link`)} >> >>`),
      add(`<< /Type /Annot /Subtype /Link ${rect} /A ${alarm} >>`),
      add(`<< /Type /Annot /Subtype /Link ${rect} /A << /S /Launch /F (calc) >> >>`),
      add(`<< /Type /Annot /Subtype /Widget /FT /Tx /T (field) /V (FORM-VALUE) /DA (/F1 40 Tf 0 g) /Rect [20 20 580 200] /AA << /Fo ${alarm} /K ${alarm} >> >>`),
      add(`<< /Type /Annot /Subtype /FileAttachment /FS ${spec} 0 R /Rect [500 500 520 520] >>`),
    ];
    annotations = ` /Annots [${annots.map((n) => `${n} 0 R`).join(" ")}] /AA << /O ${alarm} >>`;
    const xfa = add("<< /Length 35 >>\nstream\n<xdp:xdp><script/></xdp:xdp>        \nendstream");
    catalogEntries = ` /OpenAction ${alarm} /AA << /WC ${alarm} >> /AcroForm << /Fields [${annots[3]} 0 R] /XFA ${xfa} 0 R /NeedAppearances true >> /Names << /JavaScript << /Names [(a) ${alarm}] >> /EmbeddedFiles << /Names [(attached.html) ${spec} 0 R] >> >>`;
  }
  const kids = options.pages.map((lines, number) => {
    const encode = japanese ? ucs2 : latin;
    const stream = lines.map((line, i) => {
      if (typeof line === "string") return `BT /F1 10 Tf 40 ${760 - i * 20} Td ${encode(line)} Tj ET`;
      const size = line.size ?? 10;
      const pieces = line.segments.map((s) => `/F1 ${s.size ?? size} Tf ${s.rise ?? 0} Ts ${encode(s.text)} Tj`).join(" ");
      return `BT ${line.x ?? 40} ${line.y ?? 760 - i * 20} Td ${pieces} ET`;
    }).join("\n");
    const pictures = (options.images ?? []).filter((image) => image.page === number).map((image, i) => {
      const hex = `${Buffer.from(image.data).toString("hex")}>`;
      const object = add(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} ${image.entries} /Filter [/ASCIIHexDecode /${image.filter}] /Length ${hex.length} >>\nstream\n${hex}\nendstream`);
      return { object, name: `Im${i}`, draw: `q 200 0 0 200 ${image.x} ${image.y} cm /Im${i} Do Q` };
    });
    const drawn = [stream, ...pictures.map((p) => p.draw)].join("\n");
    const content = add(`<< /Length ${drawn.length} >>\nstream\n${drawn}\nendstream`);
    const shown = pictures.length > 0 ? ` /XObject << ${pictures.map((p) => `/${p.name} ${p.object} 0 R`).join(" ")} >>` : "";
    return add(`<< /Type /Page /Parent ${tree} 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 ${font} 0 R >>${shown} >> /Contents ${content} 0 R${number === 0 ? annotations : ""} >>`);
  });
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${tree} 0 R${options.labels ? ` /PageLabels << ${options.labels} >>` : ""}${catalogEntries} >>`;
  objects[tree - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  const encrypt = options.encrypted
    ? add(`<< /Filter /Standard /V 1 /R 2 /P -4 /O <${"11".repeat(32)}> /U <${"22".repeat(32)}> >>`) : undefined;

  let out = "%PDF-1.6\n";
  const offsets = objects.map((body, i) => {
    const at = out.length;
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return at;
  });
  const start = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  const secured = encrypt ? ` /Encrypt ${encrypt} 0 R /ID [<${"33".repeat(16)}> <${"33".repeat(16)}>]` : "";
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R${secured} >>\nstartxref\n${start}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

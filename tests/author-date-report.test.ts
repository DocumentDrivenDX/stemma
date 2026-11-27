// The developer script over DOCX files built here from invented text.
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { docxDocument, inRepository, report } from "../scripts/author-date-report.ts";
import { ROOT, temporary, zip } from "./helpers.ts";

const run = (text: string) => `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>`;
const p = (inner: string, style = "") => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}${inner}</w:p>`;
const textBox = p(run("In a box (Boxed 1999)."));

const docx = zip({
  "word/document.xml": `<w:document><w:body>
    ${p(run("Rivers"), "berschrift1")}
    ${p(`${run("A claim (Adair ")}<w:del><w:r><w:delText>2099</w:delText></w:r></w:del><w:ins>${run("2017")}</w:ins>${run(").")}<w:r><w:footnoteReference w:id="2"/></w:r>`)}
    ${p(`<w:r><mc:AlternateContent><mc:Choice><w:txbxContent>${textBox}</w:txbxContent></mc:Choice><mc:Fallback><w:txbxContent>${textBox}</w:txbxContent></mc:Fallback></mc:AlternateContent></w:r>${run("Beside it.")}`)}
    <w:tbl><w:tr><w:tc>${p(run("(Adair 2017)"))}</w:tc></w:tr></w:tbl>
    ${p(run("A weir (Adair 2017)."), "Caption")}
    ${p(run("References"), "berschrift1")}
    ${p(run("Adair, J. 2017. Rivers."))}
  </w:body></w:document>`,
  "word/styles.xml": `<w:styles><w:style w:styleId="berschrift1"><w:name w:val="heading 1"/></w:style><w:style w:styleId="Caption"><w:name w:val="caption"/></w:style></w:styles>`,
  "word/footnotes.xml": `<w:footnotes><w:footnote w:id="0" w:type="separator">${p("")}</w:footnote><w:footnote w:id="2">${p(run("See Adair (2017)."))}</w:footnote></w:footnotes>`,
  "word/comments.xml": `<w:comments><w:comment w:id="1">${p(run("(Comment 2001)"))}</w:comment></w:comments>`,
});

describe("author-date developer script", () => {
  test("reads body, headings, notes, tables, and captions in order, and counts what it does not read", () => {
    const { document, coverage } = docxDocument("a.docx", docx);
    expect(document.paragraphs).toEqual([
      { text: "Rivers", location: "body", headingLevel: 1 },
      { text: "A claim (Adair 2017).", location: "body" },
      { text: "See Adair (2017).", location: "footnote", note: "1" },
      { text: "Beside it.", location: "body" },
      { text: "(Adair 2017)", location: "table" },
      { text: "A weir (Adair 2017).", location: "caption" },
      { text: "References", location: "body", headingLevel: 1 },
      { text: "Adair, J. 2017. Rivers.", location: "body" },
    ]);
    expect(coverage).toMatchObject({ comments: 1, textBoxes: 1, textBoxBracketedYears: 1, trackedDeletions: 1, unreferencedNotes: 0 });
  });

  test("the report holds the limits, counts, and items, and is the same on two runs", () => {
    const first = report([{ file: "a.docx", bytes: docx }]);
    expect(report([{ file: "a.docx", bytes: docx }]).text).toBe(first.text);
    const made = JSON.parse(first.text);
    expect(made.counts).toMatchObject({ examined: 4, linked: 3, unresolved: 0, unlinked: 1 });
    expect([made.linked.length, made.unlinked[0].reason, made.coverageLimits.length > 5]).toEqual([3, "in_table", true]);
  });

  test("writes only the report, outside any repository, over nothing, and prints no manuscript text", () => {
    const dir = temporary();
    const input = join(dir, "in.docx");
    writeFileSync(input, docx);
    const digest = () => createHash("sha256").update(readFileSync(input)).digest("hex");
    const before = digest();
    const call = (out: string) => spawnSync(process.execPath, [join(ROOT, "scripts/author-date-report.ts"), "--out", out, input], { encoding: "utf8" });
    const out = join(dir, "report.json");
    const done = call(out);
    expect(done.status).toBe(0);
    expect(done.stdout).toContain("bracketed years 4: linked 3, unresolved 0, left unlinked 1");
    expect(done.stdout).not.toContain("Adair");
    expect(digest()).toBe(before);
    expect(call(out).status).toBe(2);
    expect(call(input).status).toBe(2);
    expect(digest()).toBe(before);
    const inside = join(ROOT, "tests/report-must-not-exist.json");
    expect(inRepository(inside)).toBe(true);
    expect(call(inside).status).toBe(2);
    expect(existsSync(inside)).toBe(false);
  });
});

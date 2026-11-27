// Download stamps (CONTRACT-007 I). Every stamp here is invented; the network
// addresses are from ranges reserved for documentation, put together at run time
// so that no address stands in the repository.
import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { CheckReport } from "@stemma/core";
import { removeFromPieces, removeStamps, stampSpans } from "@stemma/extract";
import { ISOLATION_FLAGS } from "../packages/cli/src/runtime.ts";
import { builtCli, temporary } from "./helpers.ts";
import { makePdf } from "./pdf.ts";

const V4 = [192, 0, 2, 77].join(".");
const V6 = ["2001", "db8", "", "4f"].join(":");
const READER = "Invented Reader";

const STAMPS = {
  annual_reviews: `Downloaded from www.annualreviews.org. Guest (guest) IP: ${V4} On: Tue, 02 Jan 2001 11:22:33`,
  jstor: `This content downloaded from ${V6} on Wed, 03 Jan 2001 01:02:03 UTC\nAll use subject to https://about.jstor.org/terms`,
  taylor_francis: `Downloaded by [${READER}] at 12:34 05 May 2015`,
  wiley: `Downloaded from https://onlinelibrary.wiley.com/doi/10.0000/invented by ${READER} - Invented University, Wiley Online Library on [03/01/2001]. See the Terms and Conditions`,
};
const PRIVATE = [V4, V6, READER];

describe("download stamp rules", () => {
  test("each rule removes its whole form and leaves the words around it", () => {
    for (const [rule, stamp] of Object.entries(STAMPS)) {
      const done = removeStamps(`Before the stamp. ${stamp}After the stamp.`);
      expect(done.text, rule).toBe("Before the stamp. After the stamp.");
      expect(done.rules as string[], rule).toEqual([rule]);
    }
  });

  test("a work's own words about downloading, addresses and dates are left alone", () => {
    for (const prose of [
      "The tables were downloaded from the archive on Monday, 4 November 2024.",
      "Each host was given an IP: address, as the chapter on networks explains.",
      "Downloaded from a ship by the crew at 12:34, the cargo lay on the quay.",
      "This content downloaded from the server was never dated.",
      "Downloaded from www.annualreviews.org, the review was read twice.",
    ]) {
      expect(stampSpans(prose), prose).toEqual([]);
      expect(removeStamps(prose).text).toBe(prose);
    }
  });

  test("a stamp in pieces, or sharing a piece with the work's words, is taken out of each", () => {
    const [head, tail] = STAMPS.annual_reviews.split(" On: ") as [string, string];
    const done = removeFromPieces([
      { text: "First line.", after: "\n" }, { text: `${head} `, after: "" }, { text: `On: ${tail}The title`, after: "\n" },
    ]);
    expect(done.texts).toEqual(["First line.", "", "The title"]);
    expect(done.rules).toEqual(["annual_reviews"]);
  });
});

describe("download stamps in a captured source", () => {
  let cli = "";
  beforeAll(async () => {
    cli = await builtCli(join(temporary(), "dist"));
  });
  const base = temporary();
  const project = join(base, "book");
  const run = (...args: string[]) => {
    const done = Bun.spawnSync([process.execPath, ...ISOLATION_FLAGS, cli, ...args], { cwd: dirname(dirname(cli)), env: { PATH: process.env.PATH ?? "", HOME: temporary() } });
    return { code: done.exitCode, out: done.stdout.toString(), err: done.stderr.toString() };
  };
  const AUTHOR = ["--actor", "person:author"];
  const everything = () => [...new Bun.Glob("**/*").scanSync({ cwd: project, dot: true, onlyFiles: true })]
    // The cache of originals is ignored by git and holds the original as it was served.
    .filter((f) => !f.startsWith(".stemma/originals/"))
    .map((f) => readFileSync(join(project, f), "utf8")).join("\n");
  const file = (name: string, content: string | Uint8Array) => {
    writeFileSync(join(base, name), content);
    return join(base, name);
  };
  const source = (key: string) => {
    const done = run("record", "add", "source", "--input", file("source.json", JSON.stringify({ citation_key: key, title: { value: "The Invented Reef" } })), ...AUTHOR, "--project", project, "--format", "json");
    return JSON.parse(done.out).added.id as string;
  };
  const convert = (original: string, id: string, ...more: string[]) => {
    const done = run("source", "convert", original, "--source", id, "--acquired-at", "2026-01-05T09:00:00Z", ...AUTHOR, ...more, "--project", project, "--format", "json");
    expect(done.code, done.err).toBeLessThan(2);
    return JSON.parse(done.out) as { text: string; directory: string };
  };

  test("a PDF's stamp is left out, the page says by which rule, and converting the original again agrees", () => {
    expect(run("init", "--project", project).code).toBe(0);
    const pages = [1, 2, 3, 4].map((n) => [
      { segments: [{ text: STAMPS.annual_reviews, size: 6 }], x: 10, y: 20 },
      `${n}`, `Page ${n} tells of the invented reef.`,
    ]);
    const original = file("stamped.pdf", makePdf({ pages }));
    const made = convert(original, source("stamped1850"), "--auto-pages");
    const page = readFileSync(join(project, made.directory, "pages/p0001.md"), "utf8");
    expect(page).toContain("Page 2 tells of the invented reef.");
    expect(page).toContain('"kind": "download_stamp"');
    expect(page).toContain('"rule": "annual_reviews"');
    expect(page).toContain('"rules_version": "1"');

    const again = run("source", "verify", made.text, "--original", original, ...AUTHOR, "--project", project);
    expect(again.code, again.out + again.err).toBe(0);
    expect(again.out).toContain("4 of 4 parts agree");
    const report = JSON.parse(run("check", "--project", project, "--format", "json").out) as CheckReport;
    for (const check of ["source.pages", "source.original", "record.valid"]) {
      expect(report.body.results.filter((r) => r.check === check && r.open), check).toEqual([]);
    }
    for (const value of PRIVATE) expect(everything()).not.toContain(value);
    expect(everything()).not.toContain("Downloaded from");
  });

  test("supplied text, plain text and a text to compare with are cleaned before anything is written", () => {
    const id = source("typed1850");
    const typed = `The reef was old.\n${STAMPS.taylor_francis}\n\f${STAMPS.jstor}\nThe water was deep.\n`;
    const made = convert(file("original.pdf", makePdf({ pages: [[], []] })), id, "--text-layer", file("typed.txt", typed), "--method", "manual");
    expect(readFileSync(join(project, made.directory, "pages/p0000.md"), "utf8")).toContain('"rule": "taylor_francis"');
    expect(readFileSync(join(project, made.directory, "pages/p0001.md"), "utf8")).toContain('"rule": "jstor"');
    const plain = convert(file("notes.txt", `CHAPTER I\n\nThe lagoon was shallow.\n\n${STAMPS.wiley}.\n`), source("plain1850"));
    const compared = run("source", "compare", made.text, "--with", file("other.txt", `${STAMPS.annual_reviews}\nThe reef was new.\n\fThe water was deep.\n`), "--against", "another export", ...AUTHOR, "--project", project);
    expect(compared.code, compared.err).toBe(0);
    for (const value of PRIVATE) {
      expect(everything()).not.toContain(value);
      expect(compared.out).not.toContain(value);
    }
    expect(plain.directory).toBe("sources/plain1850");
    expect(everything()).toContain("The lagoon was shallow.");
  });
});

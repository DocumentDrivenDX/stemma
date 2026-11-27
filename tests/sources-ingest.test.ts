// Ingest, and what it may fetch, run through the built
// command line. Every source here is invented, and nothing uses the network.
import { describe, expect, test } from "bun:test";
import { cpSync, readdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { type CheckReport } from "@stemma/core";
import { fetchBytes, FetchRefused } from "@stemma/workspace";
import { AUTHOR, Book, bundleCli, reefPdf, run, verdicts } from "./sources-book.ts";

bundleCli();

describe("ingest (FR-86)", () => {
  const plan = (source: string) => ({
    captures: [{ source, file: "reef.pdf", url: "https://library.invalid/reef.pdf", retrieved_at: "2026-01-05T09:00:00Z" }],
  });

  test("US-110 one command captures, converts, compares with the original, and checks; running it again adds nothing", () => {
    const book = new Book();
    const source = book.source("author1850", { issued: { edtf: "1850" } });
    book.file("reef.pdf", reefPdf());
    const planFile = book.file("plan.json", JSON.stringify(plan(source)));
    const first = book.run("ingest", "--plan", planFile, ...AUTHOR);
    expect(first.code).toBe(0);
    for (const line of ["5 pages written to sources/author1850/ (text_layer, 4 labelled)", "converted again; 5 of 5 parts agree", "== 4. Check", "CHECKED CLEAN", "not compared with a catalogue"]) {
      expect(first.out).toContain(line);
    }
    expect(first.out).not.toContain("NOT CHECKED");
    const files = book.files();
    const second = book.run("ingest", "--plan", planFile, ...AUTHOR);
    expect(second.out).toContain("0 source file(s) converted again, 1 already had a current comparison");
    expect(book.files()).toEqual(files);
    // --reconvert converts again all the same, and records nothing that repeats what is recorded.
    const third = book.run("ingest", "--reconvert", ...AUTHOR);
    expect(third.out).toContain("converted again; 5 of 5 parts agree, as already recorded");
    expect(third.out).toContain("1 source file(s) converted again, 0 already had a current comparison");
    expect(book.files()).toEqual(files);
    const report = book.check();
    expect(verdicts(report, "source.original")).toEqual(["pass"]);

    // PIP-02: a clone without the originals gives the same results.
    const clone = join(book.base, "clone");
    cpSync(book.project, clone, { recursive: true });
    rmSync(join(clone, ".stemma"), { recursive: true });
    const again = JSON.parse(run(["check", "--project", clone, "--format", "json"]).out) as CheckReport;
    expect(again.body.results).toEqual(report.body.results);
    expect(again.body.inputs).toEqual(report.body.inputs);
  });

  test("without --fetch nothing is fetched; originals can be given by directory and are matched by digest", () => {
    const book = new Book();
    const source = book.source("author1850");
    book.file("reef.pdf", reefPdf());
    book.run("ingest", "--plan", book.file("plan.json", JSON.stringify(plan(source))), ...AUTHOR);
    rmSync(join(book.project, ".stemma"), { recursive: true });
    for (const f of readdirSync(join(book.project, "records/comparison-runs"))) rmSync(join(book.project, "records/comparison-runs", f));
    renameSync(join(book.base, "reef.pdf"), join(book.base, "renamed.bin"));
    const without = book.run("ingest", ...AUTHOR);
    expect(without.out).toContain("No original was available for: author1850");
    const given = book.run("ingest", "--originals", book.base, ...AUTHOR);
    expect(given.out).toContain("converted again; 5 of 5 parts agree");
  });

  test("SEC-013 only https to public addresses is fetched", async () => {
    for (const address of ["http://example.org/a", "file:///etc/passwd", "https://127.0.0.1/a", "https://[::1]/a", "https://10.0.0.8/a", "https://192.168.1.1/", "https://169.254.169.254/latest", "https://user:pw@example.org/", "not an address"]) {
      await expect(fetchBytes(address, "stemma/test")).rejects.toThrow(FetchRefused);
    }
  });
});

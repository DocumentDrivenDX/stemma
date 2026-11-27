// The committed worked example. Its copy and text are not committed, so what a
// check can say about it depends on the private store being there.
import { describe, expect, test } from "bun:test";
import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";
import { NO_STORE, referencedBlobs, runChecks } from "@stemma/core";
import { loadCorpus } from "@stemma/records";
import { BlobStore, readProject } from "@stemma/workspace";
import { ROOT, temporary } from "./helpers.ts";

const load = () => {
  const dir = join(temporary(), "coral-reefs");
  cpSync(join(ROOT, "examples/coral-reefs"), dir, { recursive: true });
  return loadCorpus(readProject(dir));
};
const store = new BlobStore(join(ROOT, "examples/.sources/store"));
const present = [...referencedBlobs(load()).keys()].every((d) => store.has(d)) && existsSync(store.root);

describe("examples/coral-reefs", () => {
  test("without its store every citation and quotation is could-not-check, and nothing else is open", () => {
    const { body } = runChecks(load(), {}, NO_STORE);
    expect(body.results.filter((r) => r.open).map((r) => [r.check, r.outcome, r.reason_code])).toEqual([
      ...Array(4).fill(["quote.present", "unverifiable", "text_unavailable"]),
      ...Array(4).fill(["source.held", "unverifiable", "copy_missing"]),
    ]);
    // The page map is in the records, so the page range is still checked.
    expect(body.results.filter((r) => r.check === "locator.extent").map((r) => r.outcome)).toEqual(Array(4).fill("pass"));
    expect(body.label).toBe("open_findings");
  });

  test.skipIf(!present)("with the local store (skipped where it is absent) the four citations and quotations pass", () => {
    const { body } = runChecks(load(), {}, store);
    for (const check of ["source.held", "quote.present", "locator.extent", "source.changed"]) {
      expect(body.results.filter((r) => r.check === check).map((r) => r.outcome)).toEqual(Array(4).fill("pass"));
    }
    expect(body.results.filter((r) => r.open)).toEqual([]);
    const joins = body.results.flatMap((r) => r.evidence.filter((e) => e.name === "joined_at_line_end").map((e) => e.value));
    expect(joins).toEqual(["deny-|ing"]);
    expect(body.not_run.filter((n) => n.reason === "not_implemented").map((n) => n.check))
      .toEqual(["meta.resolver", "meta.source", "number.present"]);
  });

  test("committed quotations stay short", () => {
    const quotations = load().records.flatMap((f) => (typeof f.data?.quotation === "string" ? [f.data.quotation] : []));
    expect(quotations).toHaveLength(4);
    expect(quotations.every((q) => q.split(/\s+/).length <= 20)).toBe(true);
  });

  test("no committed file holds the source's text", () => {
    const files = Bun.spawnSync(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard", "examples"], { cwd: ROOT })
      .stdout.toString().split("\0").filter(Boolean);
    expect(files.filter((f) => /\.(pdf|txt|jpe?g|png)$/i.test(f))).toEqual([]);
    expect(files.some((f) => f.startsWith("examples/.sources/"))).toBe(false);
  });
});

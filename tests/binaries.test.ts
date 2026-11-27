// A project holds text: binary files in its repository are reported and the
// common original formats are ignored (CONTRACT-001 B, project.binary).
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runChecks } from "@stemma/core";
import { loadCorpus } from "@stemma/records";
import { initProject, readProject } from "@stemma/workspace";
import { temporary } from "./helpers.ts";

function project(git: boolean): string {
  const root = temporary();
  if (git) expect(spawnSync("git", ["init", "-q", root]).status).toBe(0);
  initProject(root);
  mkdirSync(join(root, "import/old drafts"), { recursive: true });
  writeFileSync(join(root, "import/old drafts/scan.png"), new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0]));
  writeFileSync(join(root, "import/old drafts/chapter.DocX"), "PK\u0003\u0004 invented");
  writeFileSync(join(root, "import/old drafts/chapter.md"), "Invented text.\n");
  return root;
}

const findings = (root: string) => runChecks(loadCorpus(readProject(root)), {}).body.results
  .filter((r) => r.check === "project.binary" && r.open).map((r) => r.subject);

describe("project.binary", () => {
  test("in git, an ignored original is left alone and any other binary is reported", () => {
    const root = project(true);
    expect(findings(root)).toEqual(["import/old drafts/scan.png"]);
    expect(spawnSync("git", ["-C", root, "check-ignore", "-q", "import/old drafts/chapter.DocX"]).status).toBe(0);
  });

  test("a binary that is already tracked is reported even though it is now ignored", () => {
    const root = project(true);
    expect(spawnSync("git", ["-C", root, "add", "-f", "import/old drafts/chapter.DocX"]).status).toBe(0);
    expect(findings(root)).toEqual(["import/old drafts/chapter.DocX", "import/old drafts/scan.png"]);
  });

  test("without git, every binary outside hidden and build directories is reported", () => {
    const root = project(false);
    mkdirSync(join(root, "build"), { recursive: true });
    writeFileSync(join(root, "build/book.pdf"), "%PDF-1.7 invented");
    expect(findings(root)).toEqual(["import/old drafts/chapter.DocX", "import/old drafts/scan.png"]);
  });
});

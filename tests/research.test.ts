// Research notes (CONTRACT-001 L): the derived index, and what checks read.
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { researchIndex, runChecks } from "@stemma/core";
import { loadCorpus } from "@stemma/records";
import { initProject, readProject } from "@stemma/workspace";
import { ROOT, temporary } from "./helpers.ts";

const project = (notes: Record<string, string> = {}) => {
  const root = temporary();
  initProject(root);
  for (const [path, text] of Object.entries(notes)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
};
const load = (root: string) => loadCorpus(readProject(root));

describe("research index", () => {
  test("lists Markdown notes by path with the date and first heading, whatever their names", () => {
    const root = project({
      "research/2026-02-03-second.md": "\uFEFF# Second\r\n\r\ntext\r\n",
      "research/2026-01-05-first.md": "```sh\n# not a title\n```\n## Sub\n# First\n",
      "research/My Notes/Idea (old).md": "no heading\n",
      "research/2026-13-40-no-such-day.md": "# Odd date\n",
      "research/table.csv": "a,b\n",
    });
    expect(researchIndex(load(root))).toEqual([
      { path: "research/2026-01-05-first.md", date: "2026-01-05", title: "First" },
      { path: "research/2026-02-03-second.md", date: "2026-02-03", title: "Second" },
      { path: "research/2026-13-40-no-such-day.md", title: "Odd date" },
      { path: "research/My Notes/Idea (old).md" },
    ]);
  });

  test("cuts a long heading, withholds one with a coordinate, and names an unreadable note", () => {
    const root = project({ "research/a.md": `# ${"x".repeat(300)}\n`, "research/b.md": "# Wreck at 12.34567, 98.76543\n" });
    writeFileSync(join(root, "research/c.md"), new Uint8Array([0xff, 0xfe, 0x00]));
    expect(researchIndex(load(root))).toEqual([
      { path: "research/a.md", title: "x".repeat(200) },
      { path: "research/b.md", problem: "title_withheld" },
      { path: "research/c.md", problem: "cannot_read" },
    ]);
  });

  test("a project without research/ has an empty index, and init keeps note line endings stable", () => {
    const root = project();
    expect(researchIndex(load(root))).toEqual([]);
    expect(readFileSync(join(root, ".gitattributes"), "utf8")).toContain("research/**/*.md text eol=lf");
  });

  test("research list prints the index, strips control characters, and writes nothing", () => {
    const root = project({ "research/2026-01-05-first.md": "# First\u001b[2J title\n" });
    const run = (...args: string[]) => execFileSync(process.execPath, [
      "--no-install", "--no-env-file", "--config=/dev/null", join(ROOT, "dist/stemma.js"), ...args, "--project", root,
    ], { encoding: "utf8" });
    const text = run("research", "list");
    expect(text).toContain("2026-01-05  research/2026-01-05-first.md");
    expect(text).toContain("First [2J title");
    expect(text).not.toContain("\u001b");
    expect(JSON.parse(run("research", "list", "--format", "json")).notes).toHaveLength(1);
    expect(() => readFileSync(join(root, ".stemma/reports/check.json"))).toThrow();
  });
});

describe("checks and research notes", () => {
  test("coordinate.stray reads notes and never repeats the value", () => {
    const root = project({ "research/2026-01-05-site.md": "# Site\n\nThe wreck lies at 12.34567, 98.76543.\n" });
    const { body } = runChecks(load(root), {});
    const found = body.results.filter((r) => r.open && r.subject === "research/2026-01-05-site.md");
    expect(found.map((r) => r.check)).toEqual(["coordinate.stray"]);
    expect(JSON.stringify(found)).not.toContain("12.34567");
  });

  test("an oddly named note draws no finding, and notes change report inputs but not the corpus digest", () => {
    const root = project();
    const before = runChecks(load(root), {}).body;
    mkdirSync(join(root, "research"));
    writeFileSync(join(root, "research/Loose Notes.md"), "no heading\n");
    const after = runChecks(load(root), {}).body;
    expect(after.results.filter((r) => r.open)).toEqual(before.results.filter((r) => r.open));
    expect(after.label).toBe(before.label);
    expect(after.inputs.corpus_sha256).toBe(before.inputs.corpus_sha256);
    expect(after.inputs.research.map((f) => f.path)).toEqual(["research/Loose Notes.md"]);
  });
});

// `graph export` and `graph status` through the built command line (CONTRACT-005
// B, C and its error table; US-094), and the page it makes for the worked
// example, opened from a local file.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { appendFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { type Browser, chromium } from "@playwright/test";
import { canonical } from "@stemma/records";
import { bundle } from "../scripts/build.ts";
import { ISOLATION_FLAGS } from "../packages/cli/src/runtime.ts";
import { ROOT, temporary } from "./helpers.ts";

let built = "";
beforeAll(async () => {
  built = await bundle(temporary());
}, 60_000);

/** git with no configuration from the caller. */
const GIT_ENV = { PATH: process.env.PATH ?? "", HOME: "/nonexistent", GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" };
const git = (cwd: string, ...args: string[]) => {
  const done = Bun.spawnSync(["git", ...args], { cwd, env: GIT_ENV });
  expect([args, done.exitCode, done.stderr.toString()]).toEqual([args, 0, expect.any(String)]);
  return done.stdout.toString();
};

function cli(args: string[], script = built) {
  const done = Bun.spawnSync([process.execPath, ...ISOLATION_FLAGS, script, ...args], { cwd: ROOT, env: { PATH: process.env.PATH ?? "", HOME: temporary() } });
  const out = done.stdout.toString();
  return { code: done.exitCode, out, err: done.stderr.toString(), json: () => JSON.parse(out) };
}

/** A new project made by `init`, in its own repository, with one source and one claim, committed. */
function project(repository = true): string {
  const dir = join(temporary(), "book");
  expect(cli(["init", "--project", dir]).code).toBe(0);
  const record = (path: string, value: object) => {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), canonical({ schema: "stemma.record/0", created: { at: "2026-01-05T09:00:00Z", by: { kind: "person", name: "P" } }, ...value }));
  };
  record("records/sources/src-graphclisource1.json", { id: "src-graphclisource1", kind: "source", citation_key: "one", type: "book", intake: "raw", admission: "candidate", title: { value: "One book" } });
  record("records/claims/clm-graphcliclaim01.json", { id: "clm-graphcliclaim01", kind: "claim", text: "A first wording", role: "claim", review: { state: "unreviewed" } });
  if (repository) {
    git(dir, "init", "--quiet");
    git(dir, "add", "--all");
    git(dir, "commit", "--quiet", "--message", "start");
  }
  return dir;
}

const exportTo = (dir: string, ...more: string[]) => cli(["graph", "export", "--audience", "author", "--project", dir, ...more]);
const everyFile = (dir: string): string[] => readdirSync(dir, { recursive: true }).map(String).filter((f) => !f.startsWith(".git/")).sort();

describe("graph export", () => {
  test("what is not built is refused, and nothing is written", () => {
    const dir = project();
    const before = everyFile(dir);
    for (const [args, code, words] of [
      [["--audience", "reviewer"], 2, "not implemented"],
      [["--audience", "author", "--chapter", "chp-aaaaaaaaaaaa"], 2, "not implemented"],
      [[], 2, "--audience is author"],
      [["--audience", "everyone"], 2, "--audience is author"],
    ] as const) {
      const done = cli(["graph", "export", ...args, "--project", dir]);
      expect([done.code, done.err.includes(words)]).toEqual([code, true]);
    }
    expect(everyFile(dir)).toEqual(before);
  });

  test("no finding blocks an export: what is bad is left out, counted, warned about, and the exit says something is open", () => {
    const dir = project();
    const claim = join(dir, "records/claims/clm-graphcliclaim01.json");
    const whole = readFileSync(claim, "utf8");
    // Not in canonical form and with a field Stemma does not know: warnings only.
    writeFileSync(claim, JSON.stringify({ ...JSON.parse(whole), unheard_of: true }));
    expect(exportTo(dir).code).toBe(0);
    writeFileSync(join(dir, "records/README.md"), "# Notes\n");
    writeFileSync(claim, whole.replace('"role": "claim"', '"role": "nonsense"'));
    const done = exportTo(dir, "--page");
    expect(done.code).toBe(1);
    expect(done.out).toContain("WARNING records_left_out: 2 file(s) are not in this graph");
    expect(done.out).toContain("Files: records/README.md, records/claims/clm-graphcliclaim01.json.");
    expect(readFileSync(join(dir, "build/graph/author/stemma.graph.json"), "utf8")).not.toContain("A first wording");
    expect(cli(["graph", "status", "--project", dir]).code).toBe(0);
  });

  test("a records directory that cannot be listed exits 3 with no export", () => {
    const dir = project(false);
    rmSync(join(dir, "records"), { recursive: true });
    writeFileSync(join(dir, "records"), "not a directory\n");
    const done = exportTo(dir, "--format", "json");
    expect([done.code, done.json().error.code, done.json().error.paths, existsSync(join(dir, "build"))]).toEqual([3, "project_unreadable", ["records"], false]);
  });

  test("--out never overwrites or removes a file that no export manifest there lists as its own", () => {
    const dir = project();
    const names = ["explorer.html", "stemma.export.json", "stemma.graph.json", "stemma.umf.json", "arras-static.json", "stemma.states.json", "stemma.sourceviews.json", "stemma.manuscript.json"];
    const contents = (out: string) => Object.fromEntries(readdirSync(out).map((name) => [name, readFileSync(join(out, name), "utf8")]));
    for (const [i, name] of names.entries()) {
      const out = join(temporary(), `taken${i}`);
      mkdirSync(out);
      writeFileSync(join(out, name), "someone else's\n");
      for (const more of [[], ["--page"]]) {
        const done = exportTo(dir, "--out", out, ...more);
        expect([name, done.code, done.err.includes("Nothing was written"), done.err.includes(name)]).toEqual([name, 5, true, true]);
        expect(contents(out)).toEqual({ [name]: "someone else's\n" });
      }
    }
    // A manifest that is Stemma's own owns only what it lists.
    const out = join(temporary(), "partly");
    expect(exportTo(dir, "--out", out).code).toBe(0);
    writeFileSync(join(out, "explorer.html"), "my own page\n");
    expect(exportTo(dir, "--out", out).code).toBe(5);
    expect(readFileSync(join(out, "explorer.html"), "utf8")).toBe("my own page\n");
    // A directory or a link with an output name is not an export's file either.
    rmSync(join(out, "explorer.html"));
    mkdirSync(join(out, "explorer.html"));
    expect(exportTo(dir, "--out", out).code).toBe(5);
    rmSync(join(out, "explorer.html"), { recursive: true });
    // An export cut short, its manifest written and a file not, can be made again.
    rmSync(join(out, "stemma.graph.json"));
    expect(cli(["graph", "status", "--project", dir, "--out", out]).code).toBe(1);
    expect(exportTo(dir, "--out", out).code).toBe(0);
  });

  test("a restricted location holding exact geometry is left out, warned about, and the export still made", () => {
    const dir = project();
    const stamp = { at: "2026-01-05T09:00:00Z", by: { kind: "person", name: "P" } };
    const write = (path: string, value: object) => {
      mkdirSync(join(dir, path, ".."), { recursive: true });
      writeFileSync(join(dir, path), canonical({ schema: "stemma.record/0", created: stamp, ...value }));
    };
    write("records/places/plc-graphcliplace01.json", { id: "plc-graphcliplace01", kind: "place", label: "A cave" });
    write("records/place-locations/loc-graphcliloc0001.json", {
      id: "loc-graphcliloc0001", kind: "place_location", place: "plc-graphcliplace01", certainty: "certain", method: "surveyed", evidence: ["src-graphclisource1"],
      review: { state: "unreviewed" }, sensitivity: { class: "restricted", release: "withhold", decided: stamp }, geometry: { type: "Point", positions: [{ lon: "12.345678", lat: "45.678912" }] },
    });
    const done = exportTo(dir, "--page");
    expect(done.code).toBe(1);
    expect(done.out).toContain("WARNING restricted_in_project");
    expect(done.out).toContain("loc-graphcliloc0001");
    const out = join(dir, "build/graph/author");
    for (const name of readdirSync(out)) expect(readFileSync(join(out, name), "utf8")).not.toMatch(/12\.345678|45\.678912/);
  });

  test("--out refuses every place git would take it in, and writes nothing there", () => {
    const dir = project();
    appendFileSync(join(dir, ".gitignore"), "!tracked/\n");
    mkdirSync(join(dir, "tracked"));
    const outer = join(dir, "..", "shared");
    mkdirSync(outer);
    const before = everyFile(dir);
    for (const out of ["tracked/graph", ".", "..", "graph", "records/graph", "manuscript/graph", ".git/graph", join(dir, "export")]) {
      const done = exportTo(dir, "--out", out);
      expect([out, done.code, done.err.includes("Nothing was written")]).toEqual([out, 5, true]);
    }
    // A link under build/ that leads back among tracked files is followed, then refused.
    mkdirSync(join(dir, "build"));
    symlinkSync(join(dir, "tracked"), join(dir, "build/link"));
    expect(exportTo(dir, "--out", "build/link").code).toBe(5);
    rmSync(join(dir, "build"), { recursive: true });
    expect(everyFile(dir)).toEqual(before);
  });

  test("--out accepts what git ignores, a file already tracked there excepted, and places outside any repository", () => {
    const dir = project();
    expect(exportTo(dir, "--out", "build/elsewhere").code).toBe(0);
    const outside = join(temporary(), "outside");
    expect(exportTo(dir, "--out", outside).code).toBe(0);
    expect(existsSync(join(outside, "stemma.export.json"))).toBe(true);
    mkdirSync(join(dir, "build/forced"), { recursive: true });
    writeFileSync(join(dir, "build/forced/stemma.graph.json"), "kept\n");
    git(dir, "add", "--force", "build/forced/stemma.graph.json");
    expect(exportTo(dir, "--out", "build/forced").code).toBe(5);
    expect(readFileSync(join(dir, "build/forced/stemma.graph.json"), "utf8")).toBe("kept\n");
  });

  test("a project in no repository is exported to build/ or outside itself only", () => {
    const dir = project(false);
    expect(exportTo(dir).code).toBe(0);
    expect(exportTo(dir, "--out", join(temporary(), "g")).code).toBe(0);
    const done = exportTo(dir, "--out", "graph");
    expect([done.code, done.err.includes("not in a git repository"), existsSync(join(dir, "graph"))]).toEqual([5, true, false]);
  });

  test("US-094-AC6 a fresh clone is exported from its records alone, an edit shows after export, and git tracks none of it", () => {
    const origin = project();
    const clone = join(temporary(), "clone");
    git(origin, "clone", "--quiet", origin, clone);
    const missing = cli(["graph", "status", "--project", clone]);
    expect([missing.code, missing.out.includes("No export")]).toEqual([1, true]);
    const first = exportTo(clone, "--page");
    expect(first.code).toBe(0);
    const graph = () => readFileSync(join(clone, "build/graph/author/stemma.graph.json"), "utf8");
    expect(graph()).toContain("A first wording");
    expect(git(clone, "status", "--porcelain")).toBe("");
    expect(cli(["graph", "status", "--audience", "author", "--project", clone]).code).toBe(0);

    const claim = join(clone, "records/claims/clm-graphcliclaim01.json");
    writeFileSync(claim, readFileSync(claim, "utf8").replace("A first wording", "A second wording"));
    const stale = cli(["graph", "status", "--project", clone, "--format", "json"]);
    expect([stale.code, stale.json().state, stale.json().reasons]).toEqual([1, "stale", ["data_changed"]]);
    const second = exportTo(clone, "--page", "--format", "json");
    expect(graph()).toContain("A second wording");
    expect(graph()).not.toContain("A first wording");
    expect(readFileSync(second.json().page, "utf8")).toContain("A second wording");
    expect(second.json().manifest.data_identity).toBe(stale.json().data_identity);
    expect(git(clone, "status", "--porcelain")).toBe(" M records/claims/clm-graphcliclaim01.json\n");

    // A manuscript edit alone makes an export stale. A clone holds no empty directory.
    mkdirSync(join(clone, "manuscript"), { recursive: true });
    writeFileSync(join(clone, "manuscript/one.md"), "# One\n");
    expect(cli(["graph", "status", "--project", clone]).code).toBe(1);
  });

  test("an export without a page removes the page an earlier one left, and the same input gives the same bytes", () => {
    const dir = project();
    const out = join(dir, "build/graph/author");
    exportTo(dir, "--page");
    const read = () => Object.fromEntries(readdirSync(out).map((name) => [name, readFileSync(join(out, name), "utf8")]));
    const first = read();
    expect(Object.keys(first).sort()).toEqual(["arras-static.json", "explorer.html", "stemma.export.json", "stemma.graph.json", "stemma.manuscript.json", "stemma.sourceviews.json", "stemma.states.json", "stemma.umf.json"]);
    exportTo(dir, "--page");
    expect(read()).toEqual(first);
    exportTo(dir);
    expect(existsSync(join(out, "explorer.html"))).toBe(false);
    expect(cli(["graph", "status", "--project", dir]).code).toBe(0);
  });

  test("a built copy without its page template says so and writes nothing", async () => {
    const copy = temporary();
    const script = await bundle(copy);
    rmSync(join(copy, "explorer.template.html"));
    const dir = project();
    const done = cli(["graph", "export", "--audience", "author", "--page", "--project", dir], script);
    expect([done.code, done.err.includes("lacks its explorer page template"), existsSync(join(dir, "build"))]).toEqual([70, true, false]);
  }, 60_000);

  test("it also runs from this repository's source", () => {
    const dir = project();
    const done = cli(["graph", "export", "--audience", "author", "--page", "--project", dir], join(ROOT, "packages/cli/src/main.ts"));
    expect([done.code, done.err]).toEqual([0, ""]);
    expect(existsSync(join(dir, "build/graph/author/explorer.html"))).toBe(true);
  }, 60_000);
});

let browser: Browser | undefined;
try {
  browser = await chromium.launch();
} catch (error) {
  if (!String(error).includes("Executable doesn't exist")) throw error;
  console.warn("SKIPPED the worked example's browser test: headless Chromium is not fetched (./scripts/dev.sh browsers).");
}
afterAll(async () => browser?.close());

describe.skipIf(!browser)("the worked example's page, as the built command line makes it", () => {
  test("US-094-AC2, AC3 offline: search, open a record, follow a link and its reverse, go back, with no request", async () => {
    const dir = join(temporary(), "coral-reefs");
    cpSync(join(ROOT, "examples/coral-reefs"), dir, { recursive: true, filter: (path) => !path.endsWith("/build") });
    const done = cli(["graph", "export", "--audience", "author", "--page", "--project", dir]);
    expect([done.code, done.err]).toEqual([0, ""]);
    const identity = /Data identity ([0-9a-f]{12})/.exec(done.out)![1]!;
    const page = await (await browser!.newContext({ offline: true })).newPage();
    const outside: string[] = [];
    const errors: string[] = [];
    page.on("request", (request) => {
      if (!/^(file|data):/.test(request.url())) outside.push(request.url());
    });
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(String(error)));
    const url = pathToFileURL(join(dir, "build/graph/author/explorer.html")).href;
    await page.goto(url);
    expect(await page.getByTestId("data-identity").innerText()).toBe(identity);
    const box = page.getByRole("textbox", { name: /Search/ });
    await box.fill("Darwin atolls");
    await box.press("Enter");
    const main = page.getByRole("main");
    await main.getByRole("link", { name: /^(Passage|Citation|Source) / }).first().waitFor();
    await box.fill("theory most generally received");
    await box.press("Enter");
    // The example holds two passages of this quotation; either one carries the flow.
    await main.getByRole("link", { name: /^Passage .*theory most generally/i }).first().click();
    await page.waitForURL(/\/Passage\/psg-/);
    const passage = new URL(page.url()).hash;
    const links = page.getByRole("complementary").getByRole("listitem").getByRole("link");
    await links.filter({ hasText: "src-darwinreefs1842" }).first().click();
    await page.waitForURL(/\/Source\/src-darwinreefs1842$/);
    await main.getByRole("heading", { level: 1, name: /Structure and Distribution of Coral Reefs/ }).waitFor();
    // The same link the other way round.
    await links.filter({ hasText: passage.split("/").at(-1)! }).first().click();
    await page.waitForURL((u) => u.hash === passage);
    await page.goBack();
    await page.waitForURL(/\/Source\/src-darwinreefs1842$/);
    await page.goBack();
    await page.waitForURL((u) => u.hash === passage);
    expect(outside).toEqual([]);
    expect(errors).toEqual([]);
  }, 60_000);
});

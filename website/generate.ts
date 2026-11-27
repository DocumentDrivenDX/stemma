// Regenerates website/generated/ from real runs of the built command line: the
// demo, and check runs over the fixtures the tests assert on. Machine-specific
// paths and values are replaced, so the same code gives the same bytes.
//   ./scripts/dev.sh docs         rewrite transcripts, reports, check list, screenshots
//   ./scripts/dev.sh docs-check   fail if the committed content is stale
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { IMPLEMENTED_CHECKS, TEMPLATES } from "@stemma/core";
import { bundle } from "../scripts/build.ts";
import { ISOLATION_FLAGS } from "../packages/cli/src/runtime.ts";
import { FIXTURES } from "./lib/fixtures.ts";
import { screenshotPlan, sha } from "./lib/screens.ts";

export const ROOT = join(import.meta.dir, "..");
export const GENERATED = join(ROOT, "website/generated");

/** What each check covers, and what it does not. */
const NOTES: Record<string, { summary: string; limits: string }> = {
  "record.valid": {
    summary: "Reads stemma.json, every record file and the rule headings in rules.md.",
    limits: "For some record kinds, rules beyond the record shape are not checked. A report says so when such a record is present.",
  },
  "cite.key": {
    summary: "Each citation record's key must name exactly one source record.",
    limits: "Reads citation records only, not manuscript files. It does not show that a source supports a sentence.",
  },
  "bib.uncited": {
    summary: "Each source listed in bibliography_include must be cited by a citation record.",
    limits: "It does not read manuscript files. For a project that has them, it reports that it could not check.",
  },
  "source.held": {
    summary: "Each cited source must have a stored copy and extracted text, both in the private content store and both matching their recorded SHA-256 digests.",
    limits: "It does not show that the text is a faithful reading of the copy, and for a text layer you supply it never compares the two. It does not show that a source supports a sentence. It reads citation records only.",
  },
  "coordinate.stray": {
    summary: "Warns about written map coordinates in project files, without repeating the value.",
    limits: "Recognizes only geo: addresses, degrees with N, S, E and W, and comma-separated decimal pairs with at least three decimal places. It cannot tell whether a site is restricted.",
  },
};

/** Replaces this machine's paths, and fails if any local path is left. */
export function normalise(text: string, places: [string, string][]): string {
  let out = text;
  for (const [path, name] of [...places].sort((a, b) => b[0].length - a[0].length)) out = out.replaceAll(path, name);
  const left = LOCAL_PATH.exec(out);
  if (left) throw new Error(`a local path is left in generated text: ${out.slice(left.index, left.index + 80)}`);
  return out;
}

export const LOCAL_PATH = /\/Users\/|\/home\/[a-z]|\/var\/folders\/|\/private\/(?:tmp|var)\/|\/tmp\/|[A-Z]:\\Users\\/;

const both = (path: string, name: string): [string, string][] => [[realpathSync(path), name], [path, name]];

function run(command: string[], cwd: string, env: Record<string, string | undefined> = process.env) {
  const done = Bun.spawnSync([process.execPath, ...ISOLATION_FLAGS, ...command], { cwd, env });
  return { code: done.exitCode, out: done.stdout.toString(), err: done.stderr.toString() };
}

/** Record IDs Stemma makes at random, renamed in order of appearance so that runs match. */
export function stableIds(text: string): string {
  const seen = new Map<string, string>();
  const counts = new Map<string, number>();
  return text.replace(/\b(src|cap|ext)-[0-9a-hjkmnp-tv-z]{20}\b/g, (id, kind: string) => {
    let name = seen.get(id);
    if (!name) {
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
      name = `${kind}-random${String(counts.get(kind)).padStart(4, "0")}`;
      seen.set(id, name);
    }
    return name;
  });
}

/** All generated text files, by path under website/generated/. */
export async function generateText(): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  const work = mkdtempSync(join(tmpdir(), "stemma-docs-"));
  try {
    const cli = await bundle(join(work, "plugin/dist"));
    const plugin = join(work, "plugin");

    // The demo builds first (scripts/dev.sh does that) and makes its own directory under TMPDIR.
    const demoTmp = join(work, "demo-tmp");
    mkdirSync(demoTmp);
    const builder = run([join(ROOT, "scripts/build.ts")], ROOT);
    if (builder.code !== 0) throw new Error(builder.err);
    const demo = run([join(ROOT, "scripts/demo.ts")], ROOT, { ...process.env, TMPDIR: demoTmp });
    if (demo.code !== 0) throw new Error(`demo failed\n${demo.out}${demo.err}`);
    const made = readdirSync(demoTmp).filter((n) => n.startsWith("stemma-demo-"));
    if (made.length !== 1) throw new Error("the demo directory was not found");
    const demoText = stableIds(normalise(demo.out, [
      ...both(join(demoTmp, made[0]!), "$DEMO"), ...both(join(ROOT, "dist/release"), "<plugin root>"),
    ])).replace(/^DEMO=\$DEMO$/m, "DEMO is a fresh temporary directory");
    files.set("transcripts/demo.txt", demoText);

    const help = run([cli, "--help"], plugin);
    files.set("transcripts/help.txt", normalise(help.out, both(plugin, "<plugin root>")));

    for (const name of Object.keys(FIXTURES)) {
      const project = join(work, name);
      cpSync(join(ROOT, "fixtures", name), project, { recursive: true });
      const places = both(project, `$PROJECTS/${name}`);
      const text = run([cli, "check", "--all", "--project", project], plugin);
      const json = run([cli, "check", "--all", "--project", project, "--format", "json"], plugin);
      if (text.code > 1 || json.code !== text.code) throw new Error(`check failed on fixture ${name}: ${text.err}`);
      files.set(`transcripts/check-${name}.txt`,
        normalise(`$ stemma check --all --project $PROJECTS/${name}\n${text.out}[exit ${text.code}]\n`, places));
      const report = JSON.parse(json.out);
      // These differ between runs or machines and say nothing about the project.
      report.run = { started: "(removed)", duration_ms: 0, platform: "(removed)" };
      report.body.tools.sqlite = "(removed)";
      files.set(`reports/check-${name}.json`, normalise(`${JSON.stringify(report, null, 2)}\n`, places));
    }

    // The worked example, checked where its private store is not: that run is the same everywhere.
    const example = join(work, "coral-reefs");
    cpSync(join(ROOT, "examples/coral-reefs"), example, { recursive: true });
    const empty = join(work, "empty-store");
    const without = run([cli, "check", "--all", "--project", example, "--store-dir", empty], plugin);
    if (without.code !== 1) throw new Error(`check failed on the worked example: ${without.err}`);
    files.set("transcripts/example-coral-reefs.txt", normalise(
      `$ stemma check --all --project $PROJECTS/coral-reefs --store-dir $EMPTY\n${without.out}[exit ${without.code}]\n`,
      [...both(example, "$PROJECTS/coral-reefs"), [empty, "$EMPTY"]]));

    const checks = Object.keys(IMPLEMENTED_CHECKS).sort().map((id) => {
      const note = NOTES[id];
      if (!note) throw new Error(`website/generate.ts has no note for the check ${id}`);
      const findings = Object.entries(TEMPLATES)
        .filter(([key]) => key.startsWith(`${id}:`))
        .map(([key, t]) => ({ reason: key.slice(id.length + 1), message: t.message, why: t.why, suggestions: t.suggestions }));
      return { id, ...note, findings };
    });
    files.set("checks.json", `${JSON.stringify(checks, null, 2)}\n`);
    return files;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

export interface Shot { file: string; title: string; alt: string; appearance: "light" | "dark"; width: number; input_sha256: string; png_sha256: string }

const walk = (dir: string, prefix = ""): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`])
    : [];

/**
 * What is wrong with the committed content. PNG bytes differ between machines'
 * font rendering, so a screenshot is current when the page it was captured from
 * is unchanged and the file is the one that capture wrote. No browser is needed.
 */
export async function staleness(directory = GENERATED): Promise<string[]> {
  const fresh = await generateText();
  const problems: string[] = [];
  for (const [path, text] of fresh) {
    const file = join(directory, path);
    if (!existsSync(file)) problems.push(`missing: ${path}`);
    else if (readFileSync(file, "utf8") !== text) problems.push(`stale: ${path}`);
  }
  const manifestPath = join(directory, "screenshots/manifest.json");
  const shots: Shot[] = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : [];
  const plan = screenshotPlan(fresh);
  for (const wanted of plan) {
    const have = shots.find((s) => s.file === wanted.file);
    const png = join(directory, "screenshots", wanted.file);
    if (!have || !existsSync(png)) problems.push(`missing: screenshots/${wanted.file}`);
    else if (have.input_sha256 !== wanted.input_sha256) problems.push(`stale: screenshots/${wanted.file}`);
    else if (have.png_sha256 !== sha(readFileSync(png))) problems.push(`changed by hand: screenshots/${wanted.file}`);
  }
  const expected = new Set([...fresh.keys(), "screenshots/manifest.json", ...plan.map((s) => `screenshots/${s.file}`)]);
  for (const path of walk(directory)) if (!expected.has(path)) problems.push(`not generated by the current code: ${path}`);
  return problems;
}

if (import.meta.main) {
  if (process.argv.includes("--check")) {
    const problems = await staleness();
    if (problems.length > 0) {
      console.error(`Generated website content is out of date. Run ./scripts/dev.sh docs\n  ${problems.join("\n  ")}`);
      process.exit(1);
    }
    console.log("Generated website content is current.");
  } else {
    const fresh = await generateText();
    rmSync(GENERATED, { recursive: true, force: true });
    for (const [path, text] of fresh) {
      mkdirSync(join(GENERATED, path, ".."), { recursive: true });
      writeFileSync(join(GENERATED, path), text);
    }
    const { capture } = await import("./lib/capture.ts");
    await capture(screenshotPlan(fresh), join(GENERATED, "screenshots"));
    console.log(`wrote ${fresh.size} text files and ${screenshotPlan(fresh).length} screenshots to website/generated/`);
  }
}

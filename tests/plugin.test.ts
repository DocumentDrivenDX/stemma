// What the plugin ships, and the launcher that sets it up. Nothing here uses the
// network; `./scripts/dev.sh plugin-check` runs a real first-time setup.
import { beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bundle } from "../scripts/build.ts";
import { releaseInto } from "../scripts/release-repo.ts";
import { ROOT, temporary } from "./helpers.ts";

let plugin = "";
beforeAll(async () => {
  plugin = temporary();
  await bundle(join(plugin, "dist"));
  mkdirSync(join(plugin, "scripts"));
  cpSync(join(ROOT, "scripts/stemma.sh"), join(plugin, "scripts/stemma.sh"));
});

/** The launcher with no bun on the search path. */
function launch(args: string[], env: Record<string, string> = {}, cwd = temporary()) {
  const done = Bun.spawnSync(["/bin/sh", join(plugin, "scripts/stemma.sh"), ...args], {
    cwd, env: { PATH: "/usr/bin:/bin", HOME: temporary(), ...env },
  });
  return { code: done.exitCode, out: done.stdout.toString(), err: done.stderr.toString() };
}

/** A data directory that already holds the pinned Bun. */
function ready(): string {
  const data = join(temporary(), "plugin data");
  mkdirSync(join(data, "bun-1.4.5"), { recursive: true });
  symlinkSync(process.execPath, join(data, "bun-1.4.5/bun"));
  return data;
}

describe.skipIf(process.platform === "win32")("the plugin's launcher", () => {
  test("an archive that does not match its pinned digest is not unpacked or run", () => {
    const data = join(temporary(), "data");
    const fake = join(temporary(), "fake.tgz");
    writeFileSync(fake, "not Bun");
    const done = launch([data, "setup"], { STEMMA_BUN_ARCHIVE: fake });
    expect(done.code).toBe(4);
    expect(done.err).toContain("does not match its pinned digest");
    expect(done.err).toContain("Nothing was checked");
    expect(readdirSync(data)).toEqual([]);
  });

  test("a data directory the host did not fill in, or a relative one, is refused before anything is written", () => {
    for (const data of ["${CLAUDE_PLUGIN_DATA}", "data"]) {
      const cwd = temporary();
      const done = launch([data, "setup"], {}, cwd);
      expect([done.code, readdirSync(cwd)]).toEqual([4, []]);
    }
  });

  test("once set up it runs the bundle on its own Bun, without loading the caller's bunfig.toml or .env", () => {
    const cwd = temporary();
    writeFileSync(join(cwd, "bunfig.toml"), 'preload = ["./bad.ts"]\n');
    writeFileSync(join(cwd, "bad.ts"), 'require("node:fs").writeFileSync("ran", "x");\n');
    writeFileSync(join(cwd, ".env"), `STEMMA_STORE_DIR=${cwd}\n`);
    const data = ready();
    const done = launch([data, "doctor", "--format", "json"], {}, cwd);
    expect(done.code).toBe(0);
    const doctor = JSON.parse(done.out);
    expect(Object.values(doctor.start_flags)).toEqual([true, true, true]);
    expect(doctor.bun).toBe("1.4.5");
    expect(existsSync(join(cwd, "ran"))).toBe(false);
    expect(done.err).not.toContain("one-time setup");
  });

  test("a stored Bun that does not report the pinned version is replaced, never used", () => {
    const data = join(temporary(), "data");
    mkdirSync(join(data, "bun-1.4.5"), { recursive: true });
    writeFileSync(join(data, "bun-1.4.5/bun"), "#!/bin/sh\necho 9.9.9\n");
    chmodSync(join(data, "bun-1.4.5/bun"), 0o755);
    const fake = join(temporary(), "fake.tgz");
    writeFileSync(fake, "not Bun");
    const done = launch([data, "version"], { STEMMA_BUN_ARCHIVE: fake });
    expect([done.code, done.out]).toEqual([4, ""]);
  });
});

describe("what is released", () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, ".claude-plugin/plugin.json"), "utf8"));
  const entry = JSON.parse(readFileSync(join(ROOT, ".claude-plugin/marketplace.json"), "utf8")).plugins[0];

  test("the marketplace entry installs a version tag of the distribution repository, with the plugin's version", () => {
    expect(entry.source).toEqual({ source: "url", url: "https://github.com/DocumentDrivenDX/stemma-dist.git", ref: `v${manifest.version}` });
    expect(entry.version).toBe(manifest.version);
  });

  test("the launcher, the command line and the package name one Bun version", () => {
    const pinned = /^version=(\S+)$/m.exec(readFileSync(join(ROOT, "scripts/stemma.sh"), "utf8"))![1];
    expect(readFileSync(join(ROOT, "packages/cli/src/runtime.ts"), "utf8")).toContain(`PINNED_BUN = "${pinned}"`);
    expect(JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).packageManager).toBe(`bun@${pinned}`);
  });

  test("no built command line is tracked in this repository", () => {
    const tracked = Bun.spawnSync(["git", "ls-files", "-z"], { cwd: ROOT }).stdout.toString().split("\0");
    expect(tracked.filter((f) => f.startsWith("dist/") || f.endsWith("stemma.js"))).toEqual([]);
  });

  test("a released version's tag is never moved to other content", () => {
    const base = temporary();
    const tree = join(base, "tree");
    const repository = join(base, "dist.git");
    mkdirSync(tree);
    writeFileSync(join(tree, "a"), "one");
    const env = { PATH: process.env.PATH ?? "", HOME: base, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" };
    const first = releaseInto(repository, tree, "v1", env);
    expect(releaseInto(repository, tree, "v1", env)).toEqual({ commit: first.commit, changed: false });
    writeFileSync(join(tree, "a"), "two");
    expect(() => releaseInto(repository, tree, "v1", env)).toThrow("new version");
    expect(releaseInto(repository, tree, "v2", env).changed).toBe(true);
  });
});

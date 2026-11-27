// What the plugin ships, and the launcher that sets it up. Nothing here uses the
// network; `./scripts/dev.sh plugin-check` runs a real first-time setup.
import { beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bundle } from "../scripts/build.ts";
import { MARKETPLACE, PLUGIN_SOURCE, publishInto } from "../scripts/publish-plugin.ts";
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
    writeFileSync(join(cwd, ".env"), `STEMMA_RESTRICTED_DIR=${cwd}\n`);
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

  /** A directory laid out like the organization marketplace, with another plugin in it. */
  function marketplace(source = PLUGIN_SOURCE): string {
    const dir = temporary();
    mkdirSync(join(dir, ".claude-plugin"));
    writeFileSync(join(dir, ".claude-plugin/marketplace.json"), JSON.stringify({ name: MARKETPLACE, plugins: [{ name: "stemma", source }] }));
    mkdirSync(join(dir, "plugins/other"), { recursive: true });
    writeFileSync(join(dir, "plugins/other/keep"), "untouched");
    return dir;
  }

  /** A release tree holding a manifest at `version` and one file. */
  function releaseTree(version: string, body: string): string {
    const dir = temporary();
    mkdirSync(join(dir, ".claude-plugin"));
    writeFileSync(join(dir, ".claude-plugin/plugin.json"), JSON.stringify({ name: "stemma", version }));
    writeFileSync(join(dir, "a"), body);
    return dir;
  }

  test("publishing writes only plugins/stemma, and only into a marketplace that lists it there", () => {
    const dir = marketplace();
    const listed = readFileSync(join(dir, ".claude-plugin/marketplace.json"), "utf8");
    expect(publishInto(dir, releaseTree(manifest.version, "one"))).toEqual({ version: manifest.version, changed: true });
    expect(readFileSync(join(dir, "plugins/stemma/a"), "utf8")).toBe("one");
    expect(readFileSync(join(dir, "plugins/other/keep"), "utf8")).toBe("untouched");
    expect(readFileSync(join(dir, ".claude-plugin/marketplace.json"), "utf8")).toBe(listed);
    expect(() => publishInto(marketplace("./elsewhere"), releaseTree("1.0.0", "one"))).toThrow("must be named");
    expect(() => publishInto(temporary(), releaseTree("1.0.0", "one"))).toThrow("no marketplace file");
  });

  test("the launcher, the command line and the package name one Bun version", () => {
    const pinned = /^version=(\S+)$/m.exec(readFileSync(join(ROOT, "scripts/stemma.sh"), "utf8"))![1];
    expect(readFileSync(join(ROOT, "packages/cli/src/runtime.ts"), "utf8")).toContain(`PINNED_BUN = "${pinned}"`);
    expect(JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).packageManager).toBe(`bun@${pinned}`);
  });

  test("beside the one built file go the PDF reader's data and licenses, and no native module", () => {
    const files = readdirSync(join(plugin, "dist"), { recursive: true }).map(String);
    expect(files.filter((f) => /\.(node|dylib|so|dll)$|node_modules/i.test(f))).toEqual([]);
    for (const needed of ["pdfjs/cmaps/UniJIS-UCS2-H.bcmap", "pdfjs/cmaps/LICENSE", "pdfjs/standard_fonts/LICENSE_FOXIT", "pdfjs/standard_fonts/LICENSE_LIBERATION", "pdfjs/LICENSE"]) {
      expect(files).toContain(needed);
    }
    // The worker is inside the built file, so none is looked for beside it.
    expect(files.filter((f) => f.endsWith(".mjs"))).toEqual([]);
    expect(readFileSync(join(plugin, "dist/stemma.js"), "utf8")).toContain("WorkerMessageHandler");
  });

  test("no built command line is tracked in this repository", () => {
    const tracked = Bun.spawnSync(["git", "ls-files", "-z"], { cwd: ROOT }).stdout.toString().split("\0");
    expect(tracked.filter((f) => f.startsWith("dist/") || f.endsWith("stemma.js"))).toEqual([]);
  });

  test("a published version is never replaced with other content", () => {
    const dir = marketplace();
    publishInto(dir, releaseTree("1.0.0", "one"));
    expect(publishInto(dir, releaseTree("1.0.0", "one"))).toEqual({ version: "1.0.0", changed: false });
    expect(() => publishInto(dir, releaseTree("1.0.0", "two"))).toThrow("new version");
    expect(readFileSync(join(dir, "plugins/stemma/a"), "utf8")).toBe("one");
    expect(publishInto(dir, releaseTree("1.0.1", "two")).changed).toBe(true);
    expect(readFileSync(join(dir, "plugins/stemma/a"), "utf8")).toBe("two");
    expect(() => publishInto(dir, releaseTree("1.0.0", "one"))).toThrow("older");
    expect(readFileSync(join(dir, "plugins/stemma/a"), "utf8")).toBe("two");
  });
});

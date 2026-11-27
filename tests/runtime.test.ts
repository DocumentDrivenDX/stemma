import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { bundle, unresolvedImports } from "../scripts/build.ts";
import { ISOLATION_FLAGS, PINNED_BUN, runtimeProblem } from "../packages/cli/src/runtime.ts";
import { ROOT, temporary } from "./helpers.ts";

const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const bun = (args: string[], cwd: string, env: Record<string, string> = {}) => {
  const done = Bun.spawnSync([process.execPath, ...args], { cwd, env: { PATH: process.env.PATH ?? "", HOME: cwd, ...env } });
  return { out: done.stdout.toString() + done.stderr.toString(), code: done.exitCode };
};

describe("one pinned runtime", () => {
  test("tests run on the pin, and every statement of it agrees", () => {
    expect(Bun.version).toBe(PINNED_BUN);
    expect(read("scripts/stemma.sh")).toContain(`version=${PINNED_BUN}`);
    expect(JSON.parse(read("package.json")).packageManager).toBe(`bun@${PINNED_BUN}`);
    expect(read("skills/stemma/SKILL.md")).toContain(PINNED_BUN);
  });

  test("US-085-AC5 another version is refused in plain words naming the version to install", () => {
    const message = runtimeProblem("1.3.0", ISOLATION_FLAGS)!;
    expect(message).toContain("1.3.0");
    expect(message).toContain(`needs Bun ${PINNED_BUN}`);
    expect(message).toContain("Nothing was checked");
  });

  test("a start without --no-install is refused", () => {
    expect(runtimeProblem(PINNED_BUN, [])).toContain("--no-install");
    expect(runtimeProblem(PINNED_BUN, ISOLATION_FLAGS)).toBeUndefined();
  });

  test("the skill runs the launcher with the host's two plugin paths, and the launcher passes every isolation flag", () => {
    const skill = read("skills/stemma/SKILL.md");
    expect(skill).toContain('sh "${CLAUDE_PLUGIN_ROOT}/scripts/stemma.sh" "${CLAUDE_PLUGIN_DATA}" <command>');
    // The host asks before a command runs; the skill does not approve its own.
    expect(skill).not.toContain("allowed-tools");
    expect(read("scripts/stemma.sh")).toContain(`exec "$bun" ${ISOLATION_FLAGS.join(" ")} "$root/dist/stemma.js"`);
  });
});

describe("no run-time packages", () => {
  test("no package has a run-time dependency outside this repository", () => {
    for (const path of ["package.json", ...["records", "core", "workspace", "cli"].map((p) => `packages/${p}/package.json`)]) {
      const versions = Object.values<string>(JSON.parse(read(path)).dependencies ?? {});
      expect(versions.every((v) => v === "workspace:*")).toBe(true);
    }
  });

  test("the bundle imports only what is built into Bun", async () => {
    const path = await bundle(temporary());
    expect(unresolvedImports(readFileSync(path, "utf8"))).toEqual([]);
    expect(unresolvedImports('import x from "left-pad"; x()')).toEqual(["left-pad"]);
  });

  test("with --no-install a missing package fails instead of being fetched", () => {
    const dir = temporary();
    writeFileSync(join(dir, "needs.js"), 'import pad from "left-pad";\nconsole.log(pad("a", 3));\n');
    // An unreachable registry: a fetch attempt would show up as a network error.
    const run = bun(["--no-install", "needs.js"], dir, { BUN_CONFIG_REGISTRY: "http://127.0.0.1:9/", BUN_INSTALL_CACHE_DIR: join(dir, "cache") });
    expect(run.code).not.toBe(0);
    expect(run.out).toContain("Cannot find");
    expect(run.out).not.toContain("ConnectionRefused");
  });
});

describe("SEC-014 a working directory's bunfig.toml and .env", () => {
  let hostile = "";
  let script = "";
  beforeAll(() => {
    hostile = temporary();
    const elsewhere = join(hostile, "plugin");
    mkdirSync(elsewhere);
    writeFileSync(join(hostile, "bunfig.toml"), 'preload = ["./preload.js"]\n');
    writeFileSync(join(hostile, "preload.js"), 'console.log("PRELOADED");\n');
    writeFileSync(join(hostile, ".env"), "STEMMA_STORE_DIR=/redirected\n");
    script = join(elsewhere, "print.js");
    writeFileSync(script, 'console.log(`store=${process.env.STEMMA_STORE_DIR}`);\n');
  });

  test("the risk is real on the pinned Bun: --no-install alone loads both", () => {
    const { out } = bun(["--no-install", script], hostile);
    expect(out).toContain("PRELOADED");
    expect(out).toContain("store=/redirected");
  });

  test("the documented flags load neither", () => {
    const { out, code } = bun([...ISOLATION_FLAGS, script], hostile);
    expect([out, code]).toEqual(["store=undefined\n", 0]);
  });
});

test("module boundaries: records and core touch no filesystem, process, network, or adapter", () => {
  const forbidden: Record<string, RegExp> = {
    records: /from "(node:(?!crypto)|bun:|@stemma\/)|\bBun\./,
    core: /from "(node:|bun:|@stemma\/(?!records))|\bBun\./,
    workspace: /from "(bun:|@stemma\/cli)/,
  };
  for (const [name, pattern] of Object.entries(forbidden)) {
    for (const path of new Bun.Glob(`packages/${name}/src/**/*.ts`).scanSync(ROOT)) {
      expect([path, pattern.test(read(path))]).toEqual([path, false]);
    }
  }
  expect(forbidden.core!.test('import x from "node:fs"')).toBe(true);
  expect(forbidden.core!.test('import x from "@stemma/records"')).toBe(false);
});

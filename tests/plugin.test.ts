// What the plugin ships, and the launcher that sets it up. Nothing here uses the
// network; `./scripts/dev.sh plugin-check` runs a real first-time setup.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bundle } from "../scripts/build.ts";
import { MARKETPLACE, PLUGIN_SOURCE, publishInto } from "../scripts/publish-plugin.ts";
import { ROOT, temporary } from "./helpers.ts";
import { childrenOf } from "./browse-run.ts";
import { endMcp, McpHost } from "./mcp-run.ts";

let plugin = "";
beforeAll(async () => {
  plugin = temporary();
  await bundle(join(plugin, "dist"));
  mkdirSync(join(plugin, "scripts"));
  cpSync(join(ROOT, "scripts/stemma.sh"), join(plugin, "scripts/stemma.sh"));
});
afterAll(endMcp);

/** The server the manifest declares, as a host that fills in the two variables starts it. */
function declared(fill: Record<string, string> = {}): string[] {
  const { command, args } = JSON.parse(readFileSync(join(ROOT, ".claude-plugin/plugin.json"), "utf8")).mcpServers.stemma as { command: string; args: string[] };
  return [command === "sh" ? "/bin/sh" : command, ...args.map((a) => (Object.hasOwn(fill, a) ? fill[a]! : a))];
}
const filled = (data: string) => declared({ "${CLAUDE_PLUGIN_ROOT}": plugin, "${CLAUDE_PLUGIN_DATA}": data });

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

describe.skipIf(process.platform === "win32")("the declared MCP server", () => {
  test("it is the only one, starts the launcher, and its script holds no variable of the host's", () => {
    const servers = JSON.parse(readFileSync(join(ROOT, ".claude-plugin/plugin.json"), "utf8")).mcpServers;
    expect(Object.keys(servers)).toEqual(["stemma"]);
    expect(Object.keys(servers.stemma)).toEqual(["command", "args"]);
    const [flag, script, name, ...given] = servers.stemma.args as string[];
    expect([flag, name, given]).toEqual(["-c", "stemma-mcp", ["${CLAUDE_PLUGIN_ROOT}", "${CLAUDE_PLUGIN_DATA}"]]);
    expect(script).not.toMatch(/CLAUDE|\$\{/);
    expect(script).toContain('exec sh "$1/scripts/stemma.sh" "$2" mcp');
    expect(JSON.parse(readFileSync(join(ROOT, ".claude-plugin/plugin.json"), "utf8")).dependencies).toEqual(["docsync"]);
  });

  test("a host that does not fill the variables in runs nothing, even where the session's directory holds scripts under those names", () => {
    const cloned = temporary();
    const marker = join(cloned, "ran");
    const planted = `#!/bin/sh\n: > '${marker}'\n`;
    for (const directory of ["${CLAUDE_PLUGIN_ROOT}/scripts", "scripts", "relative/scripts"]) {
      mkdirSync(join(cloned, directory), { recursive: true });
      writeFileSync(join(cloned, directory, "stemma.sh"), planted);
    }
    const data = join(temporary(), "data");
    const cases = [
      declared(), declared({ "${CLAUDE_PLUGIN_DATA}": data }), declared({ "${CLAUDE_PLUGIN_ROOT}": plugin }),
      declared({ "${CLAUDE_PLUGIN_ROOT}": "", "${CLAUDE_PLUGIN_DATA}": "" }), declared({ "${CLAUDE_PLUGIN_ROOT}": "relative", "${CLAUDE_PLUGIN_DATA}": data }),
      declared({ "${CLAUDE_PLUGIN_ROOT}": ".", "${CLAUDE_PLUGIN_DATA}": data }),
    ];
    for (const command of cases) {
      const done = Bun.spawnSync(command, { cwd: cloned, env: { PATH: "/usr/bin:/bin", HOME: temporary() }, stdin: new TextEncoder().encode('{"method":"initialize","jsonrpc":"2.0","id":0}\n') });
      expect([command.slice(4), done.exitCode, done.stdout.toString()]).toEqual([command.slice(4), 4, ""]);
      expect(done.stderr.toString()).toContain("did not fill in");
    }
    expect([existsSync(marker), existsSync(data)]).toEqual([false, false]);
    // The planted script is what the plain form of the declaration would have run.
    Bun.spawnSync(["/bin/sh", "${CLAUDE_PLUGIN_ROOT}/scripts/stemma.sh"], { cwd: cloned });
    expect(existsSync(marker)).toBe(true);
  });

  test("without the pinned Bun it lists the same tools and says to run setup, fetching and writing nothing; once Bun is there the next call reaches the command line", async () => {
    const data = join(temporary(), "plugin data");
    const home = temporary();
    const session = temporary();
    const fake = join(temporary(), "fake.tgz");
    writeFileSync(fake, "not Bun");
    // With an archive that would fail loudly, and a curl that would leave a mark, if either were reached for.
    const tools = temporary();
    writeFileSync(join(tools, "curl"), `#!/bin/sh\n: > '${join(tools, "fetched")}'\n`);
    chmodSync(join(tools, "curl"), 0o755);
    const host = McpHost.start(filled(data), { PATH: `${tools}:/usr/bin:/bin`, HOME: home, CLAUDE_PROJECT_DIR: session, STEMMA_BUN_ARCHIVE: fake }, session);
    expect((await host.initialize()).protocolVersion).toBe("2025-11-25");
    const listed = (await host.request("tools/list")).result.tools;
    expect(listed).toEqual(JSON.parse(readFileSync(join(ROOT, "packages/server/src/mcp-tools.json"), "utf8")));
    expect((await host.request("ping")).result).toEqual({});
    expect((await host.request("resources/list")).error.code).toBe(-32601);
    for (const name of ["status", "search", "open"]) {
      const got = await host.call(name, { id: "x", text: "$(touch injected)" });
      expect([got.isError, got.text.split(":")[0]]).toEqual([true, "setup_needed"]);
    }
    // IDs in either order, as strings or numbers; nothing else of a request is repeated.
    host.send('{"jsonrpc": "2.0", "id": "a-1", "method": "tools/call", "params": {"name": "search", "arguments": {"id": 99}}}');
    expect((await host.reply("a-1")).result.isError).toBe(true);
    host.send('{"jsonrpc":"2.0","id":41,"method":"tools/call","params":{"name":"open","arguments":{"id":"$(touch injected)"}}}');
    expect((await host.reply(41)).result.isError).toBe(true);
    for (const hostile of ['{"method":"ping","jsonrpc":"2.0","id":"$(touch injected)"}', '{"method":"ping","jsonrpc":"2.0","id":"a\\"}', '{"method":"ping","jsonrpc":"2.0","id":1.5e9x}', "not JSON at all"]) host.send(hostile);
    expect((await host.request("ping")).result).toEqual({});
    expect(host.stdout).not.toContain("touch");
    expect([existsSync(data), readdirSync(home), readdirSync(session), existsSync(join(tools, "fetched"))]).toEqual([false, [], [], false]);

    mkdirSync(join(data, "bun-1.4.5"), { recursive: true });
    symlinkSync(process.execPath, join(data, "bun-1.4.5/bun"));
    const now = await host.call("status");
    expect([now.isError, now.text]).toEqual([false, expect.stringContaining("not in a Stemma project")]);
    expect((await host.call("stop")).isError).toBe(false);
    expect(await host.end()).toBe(0);
    expect([readdirSync(data), readdirSync(home), readdirSync(session), host.stderr]).toEqual([["bun-1.4.5"], [], [], ""]);
  }, 60_000);

  const oversize = (bytes: number) => `{"method":"tools/call","jsonrpc":"2.0","id":900,"params":{"x":"${"y".repeat(bytes)}"}}`;
  const tooLong = { id: null, error: { code: -32700, message: "The message is longer than this server reads." } };
  /** A ping whose line is exactly `bytes` long, with the ID last. */
  const pingOf = (bytes: number, id: number) => {
    const [head, tail] = ['{"method":"ping","jsonrpc":"2.0","params":{"x":"', `"},"id":${id}}`];
    return `${head}${"y".repeat(bytes - head.length - tail.length)}${tail}`;
  };
  const shells = ["/bin/sh", ...(existsSync("/bin/dash") ? ["/bin/dash"] : [])];
  const bare = (shell: string, data: string, path = "/usr/bin:/bin") => McpHost.start([shell, join(plugin, "scripts/stemma.sh"), data, "mcp"], { PATH: path, HOME: temporary() }, temporary());

  test.each(shells)("without the pinned Bun, %s answers a line over 64 KiB with -32700, unparsed, and goes on; the next call after one still reaches the command line", async (shell) => {
    const data = join(temporary(), "data");
    const host = bare(shell, data);
    await host.initialize();
    // Each of the several-MB lines would take hours to parse as one request.
    for (const line of [pingOf(65_537, 1), oversize(131_074), oversize(1_000_000), oversize(5_000_000)]) {
      host.send(line);
      expect(await host.reply(null, 30_000)).toMatchObject(tooLong);
      expect((await host.request("ping")).result).toEqual({});
    }
    host.send(pingOf(65_536, 777));
    expect((await host.reply(777)).result).toEqual({});
    expect(host.stdout).not.toContain("yyyy");
    expect((await host.call("status")).text).toStartWith("setup_needed");

    host.send(oversize(1_000_000));
    await host.reply(null, 30_000);
    mkdirSync(join(data, "bun-1.4.5"), { recursive: true });
    symlinkSync(process.execPath, join(data, "bun-1.4.5/bun"));
    // A long call within the limit is handed over whole.
    const got = await host.call("search", { text: "y".repeat(60_000) });
    expect([got.isError, got.text]).toEqual([true, expect.stringContaining("bad_arguments")]);
    expect((await host.call("stop")).isError).toBe(false);
    expect(await host.end()).toBe(0);
    expect(host.stderr).toBe("");
  }, 90_000);

  test("a line that never ends is answered once it is over the limit, before its end or the input's", async () => {
    const host = bare("/bin/sh", join(temporary(), "data"));
    host.child.stdin.write("y".repeat(3_000_000));
    host.child.stdin.flush();
    expect(await host.reply(null, 30_000)).toMatchObject(tooLong);
    expect(await host.end()).toBe(0);
    expect(host.stdout.trim().split("\n")).toHaveLength(1);
  }, 60_000);

  test.each([
    ["parsing a long line", `{"jsonrpc":"2.0","x":"${"y".repeat(65_000)}","id":5,"method":"ping","params":{}}\n`],
    ["reading a line that has not ended", "y".repeat(2_000_000)],
  ])("a kill while it is %s leaves no process behind, and it had started none", async (_when, input) => {
    const data = join(temporary(), "data of a killed launcher");
    for (const signal of ["SIGTERM", "SIGKILL"] as const) {
      const host = McpHost.start(filled(data), { PATH: "/usr/bin:/bin", HOME: temporary() }, temporary());
      await host.initialize();
      host.child.stdin.write(input);
      // On a busy machine part of the write may still be pending at the kill, and then fails; that is no part of what is tested.
      void Promise.resolve(host.child.stdin.flush()).catch(() => {});
      await Bun.sleep(400);
      expect(childrenOf(host.child.pid)).toEqual([]);
      await host.end(signal, 5_000);
      // A subshell left behind would still show the command line it was forked with.
      expect(Bun.spawnSync(["pgrep", "-f", data]).stdout.toString()).toBe("");
    }
  }, 60_000);

  test.skipIf(!existsSync("/bin/dash"))("where there is no shell that can bound a read, it ends before reading anything", () => {
    const tools = temporary();
    for (const name of ["uname", "dirname", "cat"]) symlinkSync(Bun.which(name, { PATH: "/usr/bin:/bin" })!, join(tools, name));
    const done = Bun.spawnSync(["/bin/dash", join(plugin, "scripts/stemma.sh"), join(temporary(), "data"), "mcp"], { env: { PATH: tools, HOME: temporary() }, stdin: new TextEncoder().encode('{"method":"ping","jsonrpc":"2.0","id":1}\n') });
    expect([done.exitCode, done.stdout.toString()]).toEqual([4, ""]);
    expect(done.stderr.toString()).toContain("needs bash");
  });

  test("with the pinned Bun it starts the command line, writing nothing, a transpiler cache included", async () => {
    const data = ready();
    const home = temporary();
    const session = temporary();
    const host = McpHost.start(filled(data), { PATH: "/usr/bin:/bin", HOME: home, CLAUDE_PROJECT_DIR: session }, session);
    expect((await host.initialize()).serverInfo.name).toBe("stemma");
    await host.request("tools/list");
    expect([readdirSync(data), readdirSync(home), readdirSync(session)]).toEqual([["bun-1.4.5"], [], []]);
    expect(await host.end("SIGINT")).toBe(0);
  }, 60_000);
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

  test("beside the built files go the PDF reader's data and licenses, and no native module", () => {
    const files = readdirSync(join(plugin, "dist"), { recursive: true }).map(String);
    expect(files.filter((f) => /\.(node|dylib|so|dll)$|node_modules/i.test(f))).toEqual([]);
    for (const needed of ["pdfjs/cmaps/UniJIS-UCS2-H.bcmap", "pdfjs/cmaps/LICENSE", "pdfjs/standard_fonts/LICENSE_FOXIT", "pdfjs/standard_fonts/LICENSE_LIBERATION", "pdfjs/LICENSE",
      "mcp-tools.json", "licenses/cite/CPAL-1.0.txt", "licenses/cite/citeproc-js-LICENSE", "licenses/cite/CC-BY-SA-3.0.txt", "licenses/cite/NOTICE.txt"]) {
      expect(files).toContain(needed);
    }
    // The worker is built in, so no separate worker module is looked for.
    expect(files.filter((f) => f.endsWith(".mjs"))).toEqual([]);
    expect(files.filter((f) => f.endsWith(".js")).some((f) => readFileSync(join(plugin, "dist", f), "utf8").includes("WorkerMessageHandler"))).toBe(true);
  });

  test("beside it go the explorer page template and the licenses of the code in the page", () => {
    const files = (path: string) => readFileSync(join(plugin, path), "utf8");
    const template = readFileSync(join(plugin, "dist/explorer.template.html"), "utf8");
    for (const mark of ["__STEMMA_BANNER_JSON__", "__STEMMA_MODULE_JSON__", "__STEMMA_GRAPH_JSON__", "__STEMMA_SOURCEVIEWS_JSON__", "__STEMMA_MANUSCRIPT_JSON__"]) expect(template.split(mark)).toHaveLength(2);
    expect(readdirSync(join(plugin, "dist/explorer-licenses")).sort()).toEqual([
      "arras-ui.md", "core-js.txt", "graphql.txt", "jbig2.txt", "openjpeg.txt", "pdfjs-dist.txt", "pdfjs-jbig2.txt", "pdfjs-openjpeg.txt",
      "react-dom.txt", "react.txt", "scheduler.txt", "tailwindcss.txt", "tanstack-query-core.txt", "tanstack-react-query.txt",
    ]);
    // The offline page holds no PDF library, so none of what draws originals.
    expect(template.includes("pdfjsVersion") || template.includes("GlobalWorkerOptions")).toBe(false);
    const served = readdirSync(join(plugin, "dist/explorer-served")).sort();
    expect(served).toEqual(["app.css", "app.js", "index.html", "jbig2_nowasm_fallback.js", "openjpeg_nowasm_fallback.js", "pdf-worker.js", "pdf.worker.min.js"]);
    expect(files("dist/explorer-served/pdf-worker.js")).toBe('import "/pdfjs/jbig2_nowasm_fallback.js";\nimport "/pdfjs/openjpeg_nowasm_fallback.js";\nimport "/pdfjs/pdf.worker.min.js";\n');
    // No WebAssembly and no scripting engine is shipped.
    expect((readdirSync(join(plugin, "dist"), { recursive: true }) as string[]).filter((f) => /\.wasm$|sandbox|quickjs/i.test(f))).toEqual([]);
    // A page an author passes on carries the licenses with it.
    expect(template).toContain("=== graphql.txt ===");
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

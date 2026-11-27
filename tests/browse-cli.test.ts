// `stemma browse` as shipped (US-119; SEC-035, SEC-036): where the code and
// secret do and do not appear, what the processes listen on and connect to, what
// is written, and how the run ends. Every run is started with --no-open.
import { afterAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { cpSync, existsSync, lstatSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { platform } from "node:os";
import { dirname, join } from "node:path";
import { browse } from "../packages/cli/src/browse.ts";
import { alive, Browsing, childrenOf, codeIn, commandOf, endRuns, post, redeem, Run } from "./browse-run.ts";
import { ROOT, temporary } from "./helpers.ts";

afterAll(endRuns);

/** The worked example, which has source files, citations and a report. */
function project(): string {
  const dir = join(temporary(), "coral");
  cpSync(join(ROOT, "examples/coral-reefs"), dir, { recursive: true, filter: (from) => !/[\\/](build|\.stemma)$/.test(from) });
  return dir;
}

/** Every file below a directory, links not followed. */
function filesIn(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((e) => {
    const path = join(directory, e.name);
    return e.isDirectory() ? filesIn(path) : e.isFile() ? [path] : [];
  });
}
const treeOf = (directory: string) => filesIn(directory).sort().map((path) => `${path} ${createHash("sha256").update(readFileSync(path)).digest("hex")} ${lstatSync(path).mtimeMs}`);

/** Every call the surface has, made rightly. */
async function useEverything(one: Browsing): Promise<string> {
  const replies: string[] = [];
  const add = async (path: string, body: unknown = {}) => {
    const got = await one.call(path, body);
    expect([path, got.status]).toEqual([path, 200]);
    replies.push(JSON.stringify(got.json));
    return got.json;
  };
  await add("/api/status");
  await add("/api/boot");
  for (const call of ["version", "viewer", "meta", "status", "schemaCatalog"]) await add("/api/arras", { call });
  await add("/api/arras", { call: "export", request: { module: "stemma", limit: 5 } });
  await add("/api/query", { module: "stemma", query: "query { __typename }" });
  const manuscript = await add("/api/manuscript");
  const quoted = Object.values(manuscript.result.quotations as Record<string, any>)[0];
  await add("/api/source-view", { id: quoted.view.passages[0].passage });
  for (const id of ["../stemma.json", "/etc/passwd", "stemma.json", "__proto__", "constructor", "toString"]) {
    expect([id, (await add("/api/source-view", { id })).result]).toEqual([id, null]);
  }
  for (const path of ["/", "/app.js", "/app.css"]) {
    const got = await fetch(new URL(path, one.info.address));
    expect(got.status).toBe(200);
    replies.push(await got.text());
  }
  return replies.join("\n");
}

describe("US-119-AC1 and AC6: what a run shows and writes", () => {
  test("it serves the explorer, writes nothing in the project, and neither code nor secret is in its output, arguments, files or answers", async () => {
    const dir = project();
    const before = treeOf(dir);
    const one = await Browsing.start(dir);
    expect(one.info.address).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
    expect(one.info.opened).toBe(false);
    expect(one.secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // The code was used, so the launch file and its directory are gone.
    expect(existsSync(dirname(one.info.launch_file))).toBe(false);
    const again = await redeem(one.info, one.code);
    expect([again.status, again.json.error.code, again.proved]).toEqual([401, "code_used", true]);
    // The author is told once that the link was opened, and when.
    expect(one.run.stderr.match(/The one-time link was opened at \d{2}:\d{2}:\d{2} /g)).toHaveLength(1);
    const replies = await useEverything(one);
    const workers = childrenOf(one.run.child.pid);
    expect(workers.map((w) => w.command.includes("browse-worker.js"))).toEqual([true]);
    const commands = [commandOf(one.run.child.pid), ...workers.map((w) => w.command)];
    expect(commands[0]).toContain("browse --no-open");
    const written = [...filesIn(one.run.tmp), ...filesIn(one.run.home), ...filesIn(dir)];
    expect(await one.stop()).toBe(0);
    for (const secretly of [one.secret, one.code]) {
      for (const [where, text] of [["stdout", one.run.stdout], ["stderr", one.run.stderr], ["arguments", commands.join("\n")], ["answers", replies]] as const) {
        expect([where, text.includes(secretly)]).toEqual([where, false]);
      }
    }
    for (const path of written.filter(existsSync)) {
      const bytes = readFileSync(path, "latin1");
      expect([path, bytes.includes(one.secret), bytes.includes(one.code)]).toEqual([path, false, false]);
    }
    expect(treeOf(dir)).toEqual(before);
    expect(readdirSync(one.run.tmp).filter((name) => name.startsWith("stemma-browse-"))).toEqual([]);
  }, 60_000);

  test("before the code is used it is only in the private launch file; the text says how to open it without showing it", async () => {
    const dir = project();
    const run = await Run.command(["browse", "--no-open", "--project", dir]);
    await run.until(() => run.stdout.includes("without use"));
    const path = /^ {2}(\S.*open-stemma\.html)$/m.exec(run.stdout)![1]!;
    expect(path.startsWith(run.tmp)).toBe(true);
    const code = codeIn(path);
    expect(run.stdout).not.toContain("was opened at");
    if (platform() !== "win32") expect([lstatSync(path).mode & 0o777, lstatSync(dirname(path)).mode & 0o777]).toEqual([0o600, 0o700]);
    const holders = [...filesIn(run.tmp), ...filesIn(run.home), ...filesIn(dir)].filter((file) => readFileSync(file, "latin1").includes(code));
    expect(holders).toEqual([path]);
    expect(run.stdout).toContain("do not read it, copy it, or show it to anyone");
    const commands = [commandOf(run.child.pid), ...childrenOf(run.child.pid).map((c) => c.command)].join("\n");
    expect(await run.stop()).toBe(0);
    expect([run.stdout.includes(code), run.stderr.includes(code), commands.includes(code)]).toEqual([false, false, false]);
    // Unused, it is removed when the run ends.
    expect(existsSync(dirname(path))).toBe(false);
  }, 60_000);

  test("when something redeems the code, the command's own output says that the link was opened, and when, with neither code nor secret", async () => {
    const run = await Run.command(["browse", "--no-open", "--project", project()]);
    await run.until(() => run.stdout.includes("without use"));
    const path = /^ {2}(\S.*open-stemma\.html)$/m.exec(run.stdout)![1]!;
    const address = /http:\/\/127\.0\.0\.1:\d+\//.exec(run.stdout)![0];
    const code = codeIn(path);
    const secret = (await redeem({ address }, code)).json.secret as string;
    await run.until(() => run.stdout.includes("was opened at"));
    expect(run.stdout).toMatch(/^The one-time link was opened at \d{2}:\d{2}:\d{2} \(this computer's time\)\..*another page or program opened the link first.*stop this command and run it again\.$/m);
    expect(existsSync(dirname(path))).toBe(false);
    expect(await run.stop()).toBe(0);
    for (const kept of [code, secret]) expect((run.stdout + run.stderr).includes(kept)).toBe(false);
  }, 60_000);

  test("the browser is opened on the file: the opener gets its path, and the output holds no code", async () => {
    const dir = project();
    const given: string[] = [];
    let code = "";
    let printed = "";
    const write = process.stdout.write;
    const stop = new AbortController();
    process.stdout.write = ((text: string) => ((printed += text), true)) as typeof process.stdout.write;
    try {
      const done = browse({ project: dir, format: "text" }, {
        stop: stop.signal,
        open: async (path) => {
          given.push(path);
          code = codeIn(path);
          setTimeout(() => stop.abort(), 200);
          return true;
        },
      });
      expect(await done).toBe(0);
    } finally {
      process.stdout.write = write;
    }
    expect(given).toHaveLength(1);
    expect(given[0]).not.toContain(code);
    expect(printed).toContain("Your browser was asked to open it.");
    expect(printed).not.toContain(code);
    expect(existsSync(dirname(given[0]!))).toBe(false);
  }, 60_000);
});

const lsof = Bun.which("lsof") ?? (existsSync("/usr/sbin/lsof") ? "/usr/sbin/lsof" : null);

describe("US-119-AC7: sockets and outbound requests", () => {
  test.skipIf(!lsof)("the two processes hold one listener, on 127.0.0.1, and no connection but those made to it", async () => {
    const one = await Browsing.start(project());
    await useEverything(one);
    const port = new URL(one.info.address).port;
    const pids = [one.run.child.pid, ...childrenOf(one.run.child.pid).map((c) => c.pid)];
    expect(pids).toHaveLength(2);
    const sockets = Bun.spawnSync([lsof!, "-nP", "-a", "-i", "-p", pids.join(",")]).stdout.toString().split("\n").slice(1).filter(Boolean);
    const listening = sockets.filter((line) => line.includes("(LISTEN)"));
    expect(listening).toHaveLength(1);
    expect(listening[0]).toContain(`TCP 127.0.0.1:${port} (LISTEN)`);
    expect(listening[0]!.trim().split(/\s+/)[1]).toBe(String(one.run.child.pid));
    for (const line of sockets.filter((l) => !l.includes("(LISTEN)"))) expect(line).toMatch(new RegExp(`TCP 127\\.0\\.0\\.1:${port}->127\\.0\\.0\\.1:\\d+`));
    await one.stop();
  }, 60_000);

  test("with every proxy pointed at a trap, a run that serves everything and rebuilds sends it nothing", async () => {
    let caught = 0;
    const trap = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { open: (socket) => (caught++, void socket.end()), data: () => {} } });
    try {
      const proxy = `http://127.0.0.1:${trap.port}`;
      const dir = project();
      const one = await Browsing.start(dir, [], { HTTP_PROXY: proxy, HTTPS_PROXY: proxy, http_proxy: proxy, https_proxy: proxy, ALL_PROXY: proxy, NO_PROXY: "127.0.0.1" });
      await useEverything(one);
      writeFileSync(join(dir, "rules.md"), "# Rules\n");
      await one.call("/api/status");
      await one.current();
      await one.stop();
      expect(caught).toBe(0);
    } finally {
      trap.stop(true);
    }
  }, 60_000);

  test("the server's code starts no connection of any kind", () => {
    const sources = [...new Bun.Glob("*.ts").scanSync(join(ROOT, "packages/server/src"))].map((f) => readFileSync(join(ROOT, "packages/server/src", f), "utf8"))
      .concat(["browse.ts", "browse-worker.ts"].map((f) => readFileSync(join(ROOT, "packages/cli/src", f), "utf8")));
    for (const text of sources) expect(text).not.toMatch(/\bfetch\s*\(|Bun\.connect|node:(https|net|tls|dns|dgram|http2)|\bconnect\(|http\.request|new WebSocket|console\./);
  });
});

describe("US-119-AC9: how a run ends", () => {
  test.each(["SIGINT", "SIGTERM", "SIGHUP"] as const)("%s ends the server and its child and removes the launch file", async (signal) => {
    const run = await Run.command(["browse", "--no-open", "--format", "json", "--project", project()]);
    await run.until(() => run.stdout.includes("\n"));
    const info = JSON.parse(run.stdout.split("\n")[0]!) as { launch_file: string; address: string };
    const [worker] = childrenOf(run.child.pid);
    expect(existsSync(info.launch_file)).toBe(true);
    expect(await run.stop(signal)).toBe(0);
    expect(existsSync(dirname(info.launch_file))).toBe(false);
    expect(alive(worker!.pid)).toBe(false);
    await expect(fetch(info.address)).rejects.toThrow();
  }, 60_000);

  test("a signal while the project is still being read ends both", async () => {
    const run = await Run.command(["browse", "--no-open", "--project", project()]);
    await run.until(() => childrenOf(run.child.pid).length === 1);
    const [worker] = childrenOf(run.child.pid);
    expect(await run.stop("SIGTERM")).toBe(0);
    await Bun.sleep(100);
    expect(alive(worker!.pid)).toBe(false);
    expect(readdirSync(run.tmp).filter((name) => name.startsWith("stemma-browse-"))).toEqual([]);
  }, 60_000);

  test("if the command is killed outright, its child ends too", async () => {
    const one = await Browsing.start(project());
    const [worker] = childrenOf(one.run.child.pid);
    await one.stop("SIGKILL");
    for (let i = 0; i < 100 && alive(worker!.pid); i++) await Bun.sleep(100);
    expect(alive(worker!.pid)).toBe(false);
  }, 60_000);

  test("it stops after the idle time without use, and use keeps it running", async () => {
    const one = await Browsing.start(project(), ["--idle-minutes", "0.04"]);
    const [worker] = childrenOf(one.run.child.pid);
    for (let i = 0; i < 8; i++) {
      await Bun.sleep(500);
      expect((await one.call("/api/status")).status).toBe(200);
    }
    // Refused calls are not use.
    const keepTrying = setInterval(() => void post(one.info, "/api/status", {}, "wrong").catch(() => {}), 300);
    try {
      expect(await one.run.ended(8000)).toBe(0);
    } finally {
      clearInterval(keepTrying);
    }
    expect(one.run.stderr).toContain("without use");
    expect(alive(worker!.pid)).toBe(false);
  }, 60_000);

  test("a project that cannot be read ends the command, serving and leaving nothing", async () => {
    const dir = project();
    writeFileSync(join(dir, "stemma.json"), "{ not json");
    const run = await Run.command(["browse", "--no-open", "--project", dir]);
    expect(await run.ended()).toBe(3);
    expect(run.stderr).toContain("Nothing is served.");
    expect(run.stdout).not.toContain("127.0.0.1:");
    expect(readdirSync(run.tmp).filter((name) => name.startsWith("stemma-browse-"))).toEqual([]);
  }, 60_000);

  test("bad arguments are refused before anything is read", async () => {
    for (const args of [["--idle-minutes", "0"], ["--idle-minutes", "x"], ["--idle-minutes", "100000"], ["--port", "80"], ["--host", "0.0.0.0"], ["extra"]]) {
      const run = await Run.command(["browse", "--no-open", "--project", project(), ...args]);
      expect([args, await run.ended()]).toEqual([args, 2]);
    }
  }, 60_000);
});

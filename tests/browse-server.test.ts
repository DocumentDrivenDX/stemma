// The local server's rules, one by one (CONTRACT-005 M; SEC-034 to SEC-036;
// US-119-AC5 to AC7), against the server itself with a stand-in snapshot that
// records what reaches it. A refused request must reach nothing.
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync, statSync, existsSync } from "node:fs";
import { networkInterfaces, platform } from "node:os";
import { dirname, join } from "node:path";
import { createSession, LAUNCH_NAME, LIMITS, listen, type Listening, openerCommand, ProcessGone, type Session, type Verdict, writeLaunchFile } from "@stemma/server";
import { newNonce, raw, request, requestMac, responseProof, type Use } from "./browse-http.ts";
import { ROOT, temporary } from "./helpers.ts";

const ASSETS = { html: "<!doctype html><title>shell</title>", js: "/* script */", css: "/* styles */" };
const POLICY = "default-src 'none'; script-src 'self'; worker-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

const reached: string[] = [];
let scans = 0;
let uses = 0;
let delayMs = 0;
const verdict: Verdict = {
  state: "current", data_identity: "d".repeat(64),
  process: {
    build: async () => ({ data_identity: "", entries: 0, warnings: [] }), identity: async () => "", stop: () => {}, ended: new Promise<void>(() => {}),
    ask: async (route, body) => {
      reached.push(`${route} ${JSON.stringify(body)}`);
      if (delayMs) await Bun.sleep(delayMs);
      return { status: 200, body: JSON.stringify({ data_identity: "d".repeat(64), result: "PRIVATE TEXT" }) };
    },
  },
};

/** Redeems a session's code as the page would, and gives the secret, or nothing. */
function secretOf(of: Session): string | undefined {
  const nonce = newNonce();
  const got = of.redeem({ method: "POST", path: "/api/session", body: Buffer.from("{}"), nonce, mac: requestMac(of.code, "/api/session", "{}", nonce) });
  return got && "secret" in got ? got.secret : undefined;
}

let server: Listening;
let session: Session;
let secret: string;

async function start(limits: Partial<typeof LIMITS> = {}, given: Session = createSession()) {
  return listen({ assets: ASSETS, session: given, limits, check: async () => (scans++, verdict), used: () => void uses++ });
}

beforeAll(async () => {
  session = createSession();
  server = await start({}, session);
  secret = secretOf(session)!;
});
afterAll(async () => server.close());
beforeEach(() => {
  reached.length = 0;
  scans = 0;
  uses = 0;
  delayMs = 0;
});

type Header = [string, string | undefined];
interface Signing {
  to?: Listening;
  key?: string;
  path?: string;
  body?: string;
  use?: Use;
}
/** The headers of a right call, signed over its path and body, with some changed or left out. */
function headers(change: Record<string, string | undefined> = {}, { to = server, key = secret, path = "/api/query", body = "{}", use }: Signing = {}): Header[] {
  const nonce = newNonce();
  const right: Record<string, string> = {
    Host: `127.0.0.1:${to.port}`, Origin: `http://127.0.0.1:${to.port}`, "Content-Type": "application/json", "X-Stemma-Request": "1",
    "X-Stemma-Nonce": nonce, "X-Stemma-Mac": requestMac(key, path, body, nonce, use),
  };
  return Object.entries({ ...right, ...change });
}
const call = (path: string, change: Record<string, string | undefined> = {}, body = "{}", method = "POST") =>
  raw(server.port, [request(method, path, headers(change, { path, body }), body)]);
const nothingReached = () => expect({ reached, scans, uses }).toEqual({ reached: [], scans: 0, uses: 0 });
const refused = async (reply: ReturnType<typeof call>, status: number, code: string) => {
  const got = await reply;
  expect([got.status, got.body && (JSON.parse(got.body) as { error: { code: string } }).error.code]).toEqual([status, code]);
  expect(got.body).not.toContain("PRIVATE");
  nothingReached();
  return got;
};

describe("a right request", () => {
  test("is answered, with every security header and no cross-origin permission or cookie", async () => {
    const got = await call("/api/query", {}, '{"module":"stemma","query":"q"}');
    expect(got.status).toBe(200);
    expect(got.body).toContain("PRIVATE TEXT");
    expect(reached).toEqual(['query {"module":"stemma","query":"q"}']);
    const asset = await raw(server.port, [request("GET", "/", [["Host", `127.0.0.1:${server.port}`]])]);
    expect([asset.status, asset.body]).toEqual([200, ASSETS.html]);
    for (const reply of [got, asset, await call("/api/query", { Origin: "http://evil.example" })]) {
      expect(reply.headers["content-security-policy"]).toBe(POLICY);
      expect(reply.headers).toMatchObject({
        "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "cache-control": "no-store", "cross-origin-resource-policy": "same-origin",
        "cross-origin-opener-policy": "same-origin", "x-frame-options": "DENY", connection: "close",
      });
      expect(Object.keys(reply.headers).filter((name) => name.startsWith("access-control") || name === "set-cookie" || name === "server")).toEqual([]);
    }
  });

  test("one request is answered on a connection, and a second one on it is not read", async () => {
    const one = request("POST", "/api/boot", headers({}, { path: "/api/boot" }), "{}");
    const got = await raw(server.port, [one + one]);
    expect(got.body.match(/HTTP\/1\.1/g)).toBeNull();
    expect(reached).toHaveLength(1);
  });
});

describe("rule 1: the loopback address only", () => {
  test("US-119-AC7 the listener is not reached at ::1 or at any other address of this computer", async () => {
    const others = ["::1", ...Object.values(networkInterfaces()).flat().filter((i) => i && !i.internal && i.family === "IPv4").map((i) => i!.address)];
    for (const host of others) {
      const got = await raw(server.port, [request("GET", "/", [["Host", `127.0.0.1:${server.port}`]])], { host, waitMs: 1500 });
      expect([host, got.status]).toEqual([host, 0]);
    }
  });

  test("a repeated header a rule reads is refused, whichever copy is right", async () => {
    for (const [name, other] of [["Host", "evil.example"], ["Origin", "http://evil.example"], ["Content-Type", "text/plain"], ["X-Stemma-Mac", "wrong"], ["X-Stemma-Nonce", "wrong"], ["X-Stemma-Request", "0"]] as const) {
      for (const first of [true, false]) {
        const all = headers();
        const extra: Header = [name, other];
        await refused(raw(server.port, [request("POST", "/api/query", first ? [extra, ...all] : [...all, extra], "{}")]), 400, "bad_request");
      }
    }
  });

  test("a request that sends Expect is refused", async () => {
    await refused(raw(server.port, [request("POST", "/api/query", [...headers(), ["Expect", "100-continue"], ["Content-Length", "2"]])]), 417, "bad_request");
  });
});

describe("rule 2: the exact Host", () => {
  test("US-119-AC5 DNS rebinding and every other name, address or port is refused, on pages and calls alike", async () => {
    const p = server.port;
    for (const host of [`evil.example:${p}`, "evil.example", `localhost:${p}`, `127.0.0.1:${p + 1}`, "127.0.0.1", `127.0.0.1.evil.example:${p}`, `[::1]:${p}`, `127.1:${p}`, `127.0.0.1:${p}.`, `evil.example:${p}@127.0.0.1:${p}`, `0.0.0.0:${p}`, ""]) {
      await refused(call("/api/query", { Host: host, Origin: `http://${host}` }), 403, "forbidden_host");
      await refused(raw(server.port, [request("GET", "/", [["Host", host]])]), 403, "forbidden_host");
    }
  });

  test("a request with no Host is not answered", async () => {
    const got = await raw(server.port, ["GET / HTTP/1.1\r\n\r\n"]);
    expect(got.status).toBeGreaterThanOrEqual(400);
    expect(got.body).not.toContain("shell");
    expect((await raw(server.port, ["GET / HTTP/1.0\r\n\r\n"])).body).not.toContain("shell");
  });
});

describe("rules 3 and 4: the exact Origin, and no preflight", () => {
  test("US-119-AC5 a call from another origin, or naming none, is refused", async () => {
    const p = server.port;
    for (const origin of ["http://evil.example", "null", `http://localhost:${p}`, `http://127.0.0.1:${p + 1}`, `https://127.0.0.1:${p}`, `http://127.0.0.1:${p}/`, `http://127.0.0.1:${p}.evil.example`, undefined]) {
      await refused(call("/api/query", { Origin: origin }), 403, "forbidden_origin");
      await refused(call("/api/session", { Origin: origin }, JSON.stringify({ code: "x" })), 403, "forbidden_origin");
    }
    await refused(raw(server.port, [request("GET", "/app.js", [["Host", `127.0.0.1:${p}`], ["Origin", "http://evil.example"]])]), 403, "forbidden_origin");
  });

  test("a preflight and every method but GET and POST is refused, with no permission in the answer", async () => {
    for (const method of ["OPTIONS", "PUT", "DELETE", "PATCH", "HEAD", "TRACE"]) {
      for (const path of ["/", "/api/query"]) {
        const got = await raw(server.port, [request(method, path, [...headers(), ["Access-Control-Request-Method", "POST"], ["Access-Control-Request-Headers", "x-stemma-mac"]])]);
        expect([method, got.status]).toEqual([method, 405]);
        expect(Object.keys(got.headers).filter((name) => name.startsWith("access-control"))).toEqual([]);
      }
    }
    const preflight = await raw(server.port, [request("OPTIONS", "/api/query", [["Host", `127.0.0.1:${server.port}`], ["Origin", "http://evil.example"]])]);
    expect(preflight.status).toBe(405);
    nothingReached();
  });
});

describe("rule 5: JSON and the request header", () => {
  test("US-119-AC5 what a form on another page could send is refused", async () => {
    for (const type of ["application/x-www-form-urlencoded", "multipart/form-data; boundary=x", "text/plain", "application/json; charset=utf-8", "APPLICATION/JSON", "text/json", undefined]) {
      await refused(call("/api/query", { "Content-Type": type }), 415, "unsupported_media_type");
      await refused(call("/api/session", { "Content-Type": type }, "code=x"), 415, "unsupported_media_type");
    }
  });

  test("US-119-AC5 a call without the request header, or with another value, is refused", async () => {
    for (const value of [undefined, "0", "true", "1, 1"]) await refused(call("/api/query", { "X-Stemma-Request": value }), 403, "missing_request_header");
  });

  test("a body that is not a JSON object is refused", async () => {
    for (const body of ["", "x", "[]", "null", "1", '"a"', "{"]) await refused(call("/api/query", {}, body), 400, "bad_request");
  });
});

describe("rule 6: signed with the secret, which is never sent", () => {
  test("US-119-AC5 every call but session needs this run's signature; no cookie, address or header with the secret stands in for it", async () => {
    const other = createSession();
    const otherSecret = secretOf(other)!;
    for (const path of ["/api/status", "/api/boot", "/api/arras", "/api/query", "/api/source-view", "/api/manuscript"]) {
      for (const wrong of ["x", secret.slice(0, -1), `${secret}x`, secret.toUpperCase(), otherSecret, session.code]) {
        await refused(raw(server.port, [request("POST", path, headers({}, { key: wrong, path }), "{}")]), 401, "unauthorized");
      }
      for (const wrong of [undefined, "", "x", "A".repeat(43), secret]) await refused(call(path, { "X-Stemma-Mac": wrong }), 401, "unauthorized");
      for (const wrong of [undefined, "", "x", newNonce().slice(0, -1), `x${newNonce()}`]) await refused(call(path, { "X-Stemma-Nonce": wrong }), 401, "unauthorized");
      await refused(raw(server.port, [request("POST", path, [...headers({ "X-Stemma-Mac": undefined }, { path }), ["Cookie", `stemma=${secret}`], ["Authorization", `Bearer ${secret}`], ["X-Stemma-Secret", secret]], "{}")]), 401, "unauthorized");
      await refused(call(`${path}?secret=${secret}`), 404, "not_found");
    }
  });

  test("US-119-AC5 a signature holds for one method, path, body, nonce and use", async () => {
    const nonce = newNonce();
    const signed = (mac: string, body = "{}") => refused(raw(server.port, [request("POST", "/api/query", headers({ "X-Stemma-Nonce": nonce, "X-Stemma-Mac": mac }), body)]), 401, "unauthorized");
    await signed(requestMac(secret, "/api/boot", "{}", nonce));
    await signed(requestMac(secret, "/api/query", "{ }", nonce));
    await signed(requestMac(secret, "/api/query", "{}", nonce), '{"a":1}');
    await signed(requestMac(secret, "/api/query", "{}", newNonce()));
    await signed(requestMac(secret, "/api/query", "{}", nonce, "code"));
    await signed(requestMac(secret, "/api/query", "{}", nonce, "call", "GET"));
  });

  test("US-119-AC5 a request sent again is refused and reaches nothing, and so is one whose time is not now", async () => {
    const one = request("POST", "/api/query", headers(), "{}");
    expect((await raw(server.port, [one])).status).toBe(200);
    reached.length = 0;
    scans = 0;
    uses = 0;
    for (let again = 0; again < 3; again++) {
      const got = await refused(raw(server.port, [one]), 401, "replayed");
      expect(got.headers["x-stemma-proof"]).toBeUndefined();
    }
    for (const at of [Date.now() - 61_000, Date.now() + 61_000]) {
      const nonce = newNonce(at);
      await refused(call("/api/query", { "X-Stemma-Nonce": nonce, "X-Stemma-Mac": requestMac(secret, "/api/query", "{}", nonce) }), 401, "replayed");
    }
  });

  test("the nonces remembered are bounded: those too old are forgotten, a full memory refuses, and a clock set back lets none in again", () => {
    let now = 1_000_000;
    const bounded = createSession(() => {}, 600_000, () => now, { windowMs: 1000, most: 3 });
    const key = secretOf(bounded)!;
    const signed = (nonce: string, with_ = key) => ({ method: "POST", path: "/api/status", body: Buffer.from("{}"), nonce, mac: requestMac(with_, "/api/status", "{}", nonce) });
    const verdict = (nonce: string) => bounded.admit(signed(nonce))?.verdict;
    // Nothing unsigned is remembered, so only a holder of the secret can fill the memory.
    for (let i = 0; i < 20; i++) expect(bounded.admit(signed(newNonce(now), "wrong"))).toBeUndefined();
    const first = newNonce(now);
    expect([first, newNonce(now + 1), newNonce(now + 2)].map(verdict)).toEqual(["accepted", "accepted", "accepted"]);
    expect([verdict(newNonce(now + 3)), verdict(first)]).toEqual(["too_many", "replayed"]);
    now += 1002;
    // The first two are too old and gone; there is room again, and they stay refused.
    expect([verdict(newNonce(now)), verdict(newNonce(now)), verdict(first)]).toEqual(["accepted", "accepted", "replayed"]);
    now -= 1002;
    expect(verdict(first)).toBe("replayed");
  });

  test("the secret is long, new at each start, and not the code", () => {
    const runs = Array.from({ length: 50 }, () => {
      const one = createSession();
      return [one.code, secretOf(one)!];
    }).flat();
    expect(new Set(runs).size).toBe(100);
    for (const value of runs) expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  test("signatures are compared with the constant-time comparison", () => {
    const source = readFileSync(join(ROOT, "packages/server/src/session.ts"), "utf8");
    expect(source).toContain("timingSafeEqual(given, right)");
    expect(source).not.toMatch(/[=!]==\s*(secret|code|mac|right|given)(?![\w.])|\b(secret|mac|right|given)\s*[=!]==/);
  });
});

describe("rule 7: the one-time code", () => {
  const exchange = async (to: Listening, key: string, nonce = newNonce()) => {
    const got = await raw(to.port, [request("POST", "/api/session", headers({ "X-Stemma-Nonce": nonce, "X-Stemma-Mac": requestMac(key, "/api/session", "{}", nonce) }, { to }), "{}")]);
    return {
      status: got.status,
      body: JSON.parse(got.body) as { secret?: string; error?: { code: string } },
      proof: got.headers["x-stemma-proof"],
      /** Whether the answer proves that it holds the code. */
      proved: got.headers["x-stemma-proof"] === responseProof(key, "/api/session", got.status, got.body, nonce),
    };
  };

  test("US-119-AC5 it gives the secret once and then says that it was used; wrong keys get no proof and use nothing up", async () => {
    const ends: string[] = [];
    const fresh = createSession((how) => ends.push(how));
    const to = await start({}, fresh);
    try {
      for (const wrong of ["x", fresh.code.slice(1), createSession().code]) {
        const got = await exchange(to, wrong);
        expect([got.status, got.body.error?.code, got.body.secret, got.proof]).toEqual([401, "code_refused", undefined, undefined]);
      }
      // The code itself, sent as the old exchange sent it, is worth nothing.
      const sent = await raw(to.port, [request("POST", "/api/session", [...headers({ "X-Stemma-Nonce": undefined, "X-Stemma-Mac": undefined }, { to })], JSON.stringify({ code: fresh.code }))]);
      expect([sent.status, sent.body.includes('secret":')]).toEqual([401, false]);
      expect([ends, uses]).toEqual([[], 0]);
      const first = await exchange(to, fresh.code);
      expect([first.status, first.proved]).toEqual([200, true]);
      expect(ends).toEqual(["used"]);
      const nonce = newNonce();
      for (const used of [nonce, nonce, newNonce()]) {
        const again = await exchange(to, fresh.code, used);
        expect([again.status, again.body.error?.code, again.body.secret, again.proved]).toEqual([401, "code_used", undefined, true]);
      }
      expect(ends).toEqual(["used"]);
    } finally {
      await to.close();
    }
  });

  test("US-119-AC5 it expires, which has a code of its own, and its end is told once with the time", async () => {
    let now = 0;
    const ends: [string, number][] = [];
    const expired = createSession((how, at) => ends.push([how, at]), 600_000, () => now);
    const to = await start({}, expired);
    try {
      now = 600_000;
      for (let i = 0; i < 2; i++) {
        const got = await exchange(to, expired.code);
        expect([got.status, got.body.error?.code, got.body.secret, got.proved]).toEqual([401, "code_expired", undefined, true]);
      }
    } finally {
      await to.close();
    }
    expired.expire();
    expect(ends).toEqual([["expired", 600_000]]);
    let removed = false;
    const timed = createSession(() => (removed = true), 30);
    await Bun.sleep(80);
    expect([removed, secretOf(timed)]).toEqual([true, undefined]);
    now = 0;
    const inTime = createSession(() => {}, 600_000, () => now);
    now = 599_999;
    expect(secretOf(inTime)).toBeDefined();
  });
});

describe("rule 8: how the code reaches the browser", () => {
  test("US-119-AC6 a new private directory and file, holding the code in the fragment and no secret, and removed whole", () => {
    const parent = temporary();
    const one = createSession();
    const launch = writeLaunchFile("http://127.0.0.1:5000/", one.code, parent);
    const text = readFileSync(launch.path, "utf8");
    expect(launch.path.endsWith(LAUNCH_NAME)).toBe(true);
    expect(text).toContain(`url=http://127.0.0.1:5000/#code=${one.code}`);
    expect(launch.path).not.toContain(one.code);
    if (platform() !== "win32") {
      expect(statSync(launch.path).mode & 0o777).toBe(0o600);
      expect(statSync(dirname(launch.path)).mode & 0o777).toBe(0o700);
    }
    expect(text).not.toContain(secretOf(one)!);
    expect(writeLaunchFile("http://127.0.0.1:5000/", "c", parent).path).not.toBe(launch.path);
    launch.remove();
    expect(existsSync(dirname(launch.path))).toBe(false);
  });

  test("US-119-AC6 the opener is given the file's path and nothing else", () => {
    for (const system of ["darwin", "linux", "win32"] as const) {
      const command = openerCommand(system, "/tmp/x/open-stemma.html");
      expect(command.at(-1)).toBe("/tmp/x/open-stemma.html");
      expect(command.join(" ")).not.toMatch(/code=|http/);
    }
    expect(openerCommand("darwin", "f")).toEqual(["/usr/bin/open", "f"]);
  });
});

describe("rule 1 and fixed routes: no path from a request reaches the file system", () => {
  const host = () => `127.0.0.1:${server.port}`;
  test("US-119-AC5 path tricks give nothing but the three assets at their exact names", async () => {
    const tricks = ["/../etc/passwd", "/%2e%2e/%2e%2e/etc/passwd", "/..%2f..%2fetc%2fpasswd", "//etc/passwd", "/etc/passwd", "/app.js/", "/app.js?x=1", "/app.js%00", "/app.js#x",
      "/APP.JS", "/./app.js", "/a/../app.js", "//app.js", "/index.html", "/favicon.ico", "/api", "/api/", "/stemma.json", "/records", `http://${host()}/app.js`,
      "http://evil.example/", "*", "/__proto__", "/constructor", "/toString", "\\..\\stemma.json"];
    for (const target of tricks) {
      const got = await raw(server.port, [request("GET", target, [["Host", host()]])]);
      expect([target, got.status >= 400, got.body.includes("root:"), got.body === ASSETS.js]).toEqual([target, true, false, false]);
    }
    for (const target of ["/api/query/", "/api/query?x", "/api/../api/query", "/api/%71uery", "//api/query", "/API/query", "/api/toString", "/api/__proto__", "/", "/app.js", `http://${host()}/api/query`]) {
      await refused(call(target), 404, "not_found");
    }
    for (const target of ["/api/query", "/api/session", "/api/status"]) {
      expect((await raw(server.port, [request("GET", target, [["Host", host()]])])).status).toBe(404);
    }
    nothingReached();
  });

  test("a GET that carries a body is refused", async () => {
    await refused(raw(server.port, [request("GET", "/", [["Host", host()]], "abc")]), 400, "bad_request");
  });
});

describe("rule 10: bounds on size, time and connections", () => {
  test("the limits are those the contract states", () => {
    expect(LIMITS).toEqual({ headerBytes: 16 * 1024, bodyBytes: 64 * 1024, requestMs: 10_000, connections: 64 });
  });

  test("US-119-AC5 headers over 16 KiB are refused", async () => {
    const got = await raw(server.port, [request("GET", "/", [["Host", `127.0.0.1:${server.port}`], ["X-Big", "a".repeat(17 * 1024)]])]);
    expect(got.status).toBe(431);
    expect(got.body).not.toContain("shell");
    nothingReached();
  });

  test("US-119-AC5 a body over 64 KiB is refused, declared or sent in chunks", async () => {
    const big = JSON.stringify({ query: "a".repeat(70_000) });
    await refused(call("/api/query", {}, big), 413, "too_large");
    await refused(raw(server.port, [request("POST", "/api/query", [...headers(), ["Content-Length", "100000000"]]), "{"]), 413, "too_large");
    const chunk = `4000\r\n${"a".repeat(0x4000)}\r\n`;
    await refused(raw(server.port, [request("POST", "/api/query", [...headers(), ["Transfer-Encoding", "chunked"]]), ...Array<string>(6).fill(chunk), "0\r\n\r\n"], { gapMs: 5 }), 413, "too_large");
    const both = await raw(server.port, [request("POST", "/api/query", [...headers(), ["Content-Length", "4"], ["Transfer-Encoding", "chunked"]]), "0\r\n\r\n"]);
    expect(both.status).toBe(400);
    nothingReached();
  });

  test("US-119-AC5 a request that does not arrive whole in time is ended: silent, slow headers, or slow body", async () => {
    const quick = createSession();
    const to = await start({ requestMs: 1000 }, quick);
    const key = secretOf(quick)!;
    try {
      const head = request("POST", "/api/query", [...headers({}, { to, key }), ["Content-Length", "40"]]);
      const [silent, partial, slowHeaders, slowBody] = await Promise.all([
        raw(to.port, [], { waitMs: 8000 }),
        raw(to.port, ["POST /api/query HTTP/1.1\r\nHost: 127.0.0.1"], { waitMs: 8000 }),
        raw(to.port, ["GET / HTTP/1.1\r\n", ...Array.from({ length: 30 }, (_, i) => `X-${i}: a\r\n`)], { gapMs: 300, waitMs: 8000 }),
        raw(to.port, [head, ..."{".padEnd(30, " ")], { gapMs: 300, waitMs: 8000 }),
      ]);
      for (const got of [silent, partial, slowHeaders, slowBody]) {
        expect(got.endedMs).toBeLessThan(4000);
        expect(got.body).not.toContain("PRIVATE");
      }
      nothingReached();
      // The limit is on the request arriving, not on the time the answer takes.
      delayMs = 2200;
      const late = await raw(to.port, [request("POST", "/api/query", headers({}, { to, key }), "{}")], { waitMs: 8000 });
      expect([late.status, late.body.includes("PRIVATE TEXT")]).toEqual([200, true]);
    } finally {
      await to.close();
    }
  }, 30_000);

  test("US-119-AC5 with the limits as shipped, a slow request is ended within about ten seconds", async () => {
    const got = await raw(server.port, ["GET / HTTP/1.1\r\n", ...Array.from({ length: 20 }, (_, i) => `X-${i}: a\r\n`)], { gapMs: 1000, waitMs: 18_000 });
    expect(got.endedMs).toBeGreaterThan(8000);
    expect(got.endedMs).toBeLessThan(13_000);
    expect(got.body).not.toContain("shell");
  }, 30_000);

  test("no more connections are open at once than the limit", async () => {
    const to = await start({ connections: 4, requestMs: 3000 });
    try {
      const held = Array.from({ length: 10 }, () => raw(to.port, [], { waitMs: 1000 }));
      const ended = (await Promise.all(held)).filter((reply) => reply.endedMs < 1000);
      expect(ended.length).toBe(6);
    } finally {
      await to.close();
    }
  });
});

describe("status and a snapshot that is not current", () => {
  test("a snapshot process that ended gives index_stale; any other failure to answer is a 500 that says nothing of it", async () => {
    for (const [thrown, expected] of [[new ProcessGone(), [503, "index_stale"]], [new Error("PRIVATE detail /Users/someone"), [500, "internal_error"]]] as const) {
      const one = createSession();
      const to = await listen({ assets: ASSETS, session: one, check: async () => ({ ...verdict, process: { ...(verdict as Extract<Verdict, { state: "current" }>).process, ask: () => Promise.reject(thrown) } }) as Verdict });
      const key = secretOf(one)!;
      try {
        const got = await raw(to.port, [request("POST", "/api/query", headers({}, { to, key }), "{}")]);
        expect([got.status, (JSON.parse(got.body) as { error: { code: string } }).error.code]).toEqual([...expected]);
        expect(got.headers["x-stemma-proof"]).toBeDefined();
        expect(got.body).not.toContain("PRIVATE");
      } finally {
        await to.close();
      }
    }
  });

  test("a call is refused with index_stale, and status says why, unless the snapshot is current", async () => {
    for (const [given, status] of [[{ state: "rebuilding" }, { state: "rebuilding" }], [{ state: "failed", message: "why" }, { state: "failed", message: "why" }]] as const) {
      const one = createSession();
      const to = await listen({ assets: ASSETS, session: one, check: async () => given });
      const key = secretOf(one)!;
      try {
        const got = await raw(to.port, [request("POST", "/api/query", headers({}, { to, key }), "{}")]);
        expect(got.headers["x-stemma-proof"]).toBeDefined();
        expect([got.status, (JSON.parse(got.body) as { error: { code: string } }).error.code]).toEqual([503, "index_stale"]);
        expect(JSON.parse((await raw(to.port, [request("POST", "/api/status", headers({}, { to, key, path: "/api/status" }), "{}")])).body)).toEqual(status);
      } finally {
        await to.close();
      }
    }
  });
});

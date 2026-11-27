// The proofs that let the served page and its server know each other
// (CONTRACT-005 M, "Proofs"; US-119-AC10), with the page's own signing and
// checking against the real server, and against another program that answers in
// its place. No browser is needed.
import { describe, expect, test } from "bun:test";
import { createSession, listen, type Session, type Verdict } from "@stemma/server";
import { TAGS, type TagPair } from "../packages/core/src/browse-proof.ts";
import { provedPost, proves, signed } from "../packages/explorer/src/proof.ts";
import { requestMac, responseProof } from "./browse-http.ts";

const RECORD = JSON.stringify({ data_identity: "d".repeat(64), result: "A REAL RECORD" });
const verdict: Verdict = {
  state: "current", data_identity: "d".repeat(64),
  process: { build: async () => ({ data_identity: "", entries: 0, warnings: [] }), identity: async () => "", stop: () => {}, ended: new Promise<void>(() => {}), ask: async () => ({ status: 200, body: RECORD }) },
};

/** A sender to one address, as the browser sends from the page there. */
const to = (address: string) => {
  const origin = address.replace(/\/$/, "");
  return (path: string, init: { headers: Record<string, string>; body: string }) =>
    fetch(`${origin}${path}`, { method: "POST", headers: { origin, "content-type": "application/json", "x-stemma-request": "1", ...init.headers }, body: init.body });
};

async function served<T>(run: (address: string, session: Session) => Promise<T>): Promise<T> {
  const session = createSession();
  const server = await listen({ assets: { html: "", js: "", css: "" }, session, check: async () => verdict });
  try {
    return await run(server.address, session);
  } finally {
    await server.close();
  }
}

const redeemed = async (address: string, session: Session) =>
  (JSON.parse((await provedPost(to(address), session.code, TAGS.code, "/api/session", "{}"))!.text) as { secret: string }).secret;

describe("the page believes the server that holds the key", () => {
  test("the exchange and a call are proved, and so is a refusal made after the signature held", async () => {
    await served(async (address, session) => {
      const secret = await redeemed(address, session);
      expect(await provedPost(to(address), secret, TAGS.call, "/api/query", "{}")).toEqual({ status: 200, text: RECORD });
      expect((await provedPost(to(address), secret, TAGS.call, "/api/query", "not json"))!.status).toBe(400);
      expect(JSON.parse((await provedPost(to(address), session.code, TAGS.code, "/api/session", "{}"))!.text).error.code).toBe("code_used");
      // Another key, and the right key put to the other use, get nothing.
      for (const [key, tags] of [["x".repeat(43), TAGS.call], [secret, TAGS.code], [session.code, TAGS.call]] as [string, TagPair][]) {
        expect(await provedPost(to(address), key, tags, "/api/query", "{}")).toBeUndefined();
      }
    });
  });

  test("a changed body, status, path or nonce, another use, or a proof made for another request, is refused", async () => {
    const key = "k".repeat(43);
    const nonce = "1700000000000.AAAAAAAAAAAAAAAAAAAAAA";
    const proof = responseProof(key, "/api/query", 200, RECORD, nonce);
    const holds = (change: { body?: string; status?: number; path?: string; nonce?: string; tags?: TagPair; key?: string; proof?: string | null } = {}) =>
      proves(change.key ?? key, change.tags ?? TAGS.call, change.nonce ?? nonce, change.path ?? "/api/query", change.status ?? 200,
        new TextEncoder().encode(change.body ?? RECORD), change.proof === undefined ? proof : change.proof);
    expect(await holds()).toBe(true);
    for (const change of [
      { body: RECORD.replace("REAL", "FAKE") }, { body: `${RECORD} ` }, { body: "" }, { status: 503 }, { path: "/api/boot" }, { path: "/api/source-view" },
      { nonce: "1700000000000.BAAAAAAAAAAAAAAAAAAAAA" }, { tags: TAGS.code }, { key: "j".repeat(43) }, { proof: null }, { proof: "" }, { proof: "A".repeat(43) }, { proof: proof.slice(1) },
      { proof: requestMac(key, "/api/query", RECORD, nonce) },
    ]) expect([change, await holds(change)]).toEqual([change, false]);
  });

  test("the encoding is unambiguous: bytes moved from one field to the next give another signature", () => {
    expect(requestMac("k", "/api/a", "{}", "1.x", "call", "POST")).not.toBe(requestMac("k", "T/api/a", "{}", "1.x", "call", "POS"));
  });

  test("the page signs as the contract says, with a new nonce each time", async () => {
    const one = await signed("k", TAGS.call, "/api/query", "{}");
    expect(one["x-stemma-mac"]).toBe(requestMac("k", "/api/query", "{}", one["x-stemma-nonce"]!));
    expect((await signed("k", TAGS.call, "/api/query", "{}"))["x-stemma-nonce"]).not.toBe(one["x-stemma-nonce"]);
  });
});

describe("US-119-AC10 the page believes no other program", () => {
  /** Answers every request 200 with plausible data, and keeps what it was sent. */
  async function withImpostor(proof: (path: string) => string | undefined, run: (address: string, got: string[]) => Promise<void>) {
    const got: string[] = [];
    const server = Bun.serve({
      hostname: "127.0.0.1", port: 0,
      async fetch(request) {
        const path = new URL(request.url).pathname;
        got.push(JSON.stringify([request.url, Object.fromEntries(request.headers), await request.text()]));
        const given = proof(path);
        return Response.json(path === "/api/session" ? { secret: "A".repeat(43) } : { data_identity: "d".repeat(64), result: "A FAKE RECORD" },
          { headers: given === undefined ? {} : { "x-stemma-proof": given } });
      },
    });
    try {
      await run(`http://127.0.0.1:${server.port}`, got);
    } finally {
      server.stop(true);
    }
  }

  test("before the exchange: it is sent neither code nor anything that opens a server, and its answers give nothing", async () => {
    await withImpostor(() => "A".repeat(43), async (address, got) => {
      const code = createSession().code;
      expect(await provedPost(to(address), code, TAGS.code, "/api/session", "{}")).toBeUndefined();
      expect(got).toHaveLength(1);
      expect(got[0]).not.toContain(code);
      // What it was sent signs one exchange of one code, and no server of another run takes it.
      const [, headers, body] = JSON.parse(got[0]!) as [string, Record<string, string>, string];
      await served(async (real, session) => {
        const replay = await to(real)("/api/session", { headers: { "x-stemma-nonce": headers["x-stemma-nonce"]!, "x-stemma-mac": headers["x-stemma-mac"]! }, body });
        expect([replay.status, (await replay.text()).includes('"secret"')]).toEqual([401, false]);
        expect(await redeemed(real, session)).toBeDefined();
      });
    });
  });

  test("after it: no proof, a made-up one, and a real proof used again are all refused, and the secret is never sent", async () => {
    const real = await served(async (address, session) => {
      const secret = await redeemed(address, session);
      let kept = "";
      const send = to(address);
      await provedPost(async (path, init) => {
        const response = await send(path, init);
        kept = response.headers.get("x-stemma-proof")!;
        return response;
      }, secret, TAGS.call, "/api/query", "{}");
      return { secret, kept };
    });
    for (const proof of [undefined, "A".repeat(43), real.kept]) {
      await withImpostor(() => proof, async (address, got) => {
        for (const path of ["/api/status", "/api/boot", "/api/arras", "/api/query", "/api/source-view", "/api/manuscript"]) {
          expect(await provedPost(to(address), real.secret, TAGS.call, path, "{}")).toBeUndefined();
        }
        expect(got.join()).not.toContain(real.secret);
      });
    }
  });
});

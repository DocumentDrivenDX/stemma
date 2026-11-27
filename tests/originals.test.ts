// Which original page a part is, where originals are looked for, and what the
// local server gives of them (CONTRACT-007 C; CONTRACT-005 M, "Originals";
// US-121-AC2 to AC5; SEC-038). Everything here is invented; no browser.
import { afterAll, describe, expect, test } from "bun:test";
import { linkSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { platform } from "node:os";
import { join } from "node:path";
import { createOriginals, createSession, listen, type ListenOptions, type Listening, originalPlaces, type Session, type Verdict } from "@stemma/server";
import { originalPage, type TextOriginal, textOriginals } from "@stemma/core";
import { loadCorpus } from "@stemma/records";
import { readProject } from "@stemma/workspace";
import { TAGS } from "../packages/core/src/browse-proof.ts";
import { provedBytes } from "../packages/explorer/src/proof.ts";
import { servedPdf } from "../packages/explorer/build.ts";
import { newNonce, raw, request, requestMac } from "./browse-http.ts";
import { Browsing, endRuns, Run } from "./browse-run.ts";
import { ROOT, temporary } from "./helpers.ts";
import { folderOf, imageTie, originalPdf, originalPng, PASSAGES, pdfTie, sha, writeOriginalsProject } from "./originals-fixture.ts";

afterAll(endRuns);

const A = "a".repeat(64);
const B = "b".repeat(64);
const pdfFile = { sha256: A, size: 10, media_type: "application/pdf" };
const png = (index: number | undefined, sha256 = B, media_type = "image/png") => ({ sha256, size: 5, media_type, ...(index === undefined ? {} : { index }) });
const pdf = (more: Partial<TextOriginal> = {}): TextOriginal => ({ form: "file", paged: true, page_count: 3, files: [pdfFile], parts: [0, 1, 2], ...more });
const images = (files: TextOriginal["files"], parts = [0, 1]): TextOriginal => ({ form: "page_images", paged: true, files, parts });
const why = (text: TextOriginal, index = 1): string => {
  const got = originalPage(text, index);
  return got.state === "none" ? got.reason : got.state;
};

describe("US-121-AC2 which page a part is, from the record alone", () => {
  test("a part of one PDF with a recorded page count is the page one past its index", () => {
    expect(originalPage(pdf(), 1)).toEqual({ state: "pdf", sha256: A, size: 10, page: 2, page_count: 3 });
    // Some parts only, as long as each is within the count.
    expect(originalPage(pdf({ page_count: 258, parts: [88, 89] }), 89)).toMatchObject({ state: "pdf", page: 90 });
  });

  test("a page image is the one file that names the part's index, when every part has exactly one", () => {
    expect(originalPage(images([png(0, A), png(1, B)]), 1)).toEqual({ state: "image", sha256: B, size: 5, media_type: "image/png" });
    expect(originalPage(images([png(0), png(1, A, "image/jpeg"), png(2)]), 1)).toMatchObject({ state: "image", sha256: A, media_type: "image/jpeg" });
  });

  test.each([
    ["no page count, as a transcription leaves it", { form: "file", paged: true, files: [pdfFile], parts: [0, 1, 2] } satisfies TextOriginal, "no_page_mapping"],
    ["a part past the page count", pdf({ parts: [1, 3] }), "no_page_mapping"],
    ["two files", pdf({ files: [pdfFile, { ...pdfFile, sha256: B }] }), "no_page_mapping"],
    ["a source with no pages", pdf({ paged: false }), "no_page_mapping"],
    ["an index the source file does not list", pdf({ parts: [0] }), "no_page_mapping"],
    ["no file that can be read", pdf({ files: [] }), "no_page_mapping"],
    ["a form this version does not know", { ...pdf(), form: "microfilm" }, "no_page_mapping"],
    ["a word processor file", pdf({ files: [{ ...pdfFile, media_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }] }), "unsupported_type"],
    ["a TIFF image", images([png(0, A, "image/tiff"), png(1, B, "image/tiff")]), "unsupported_type"],
    ["a TIFF image among PNG ones", images([png(0), png(1, A, "image/tiff")]), "unsupported_type"],
    // Images numbered 0 and 1 beside text numbered 1 and 2 may be numbered by their order only.
    ["images whose numbers do not cover the text's", images([png(0), png(1)], [1, 2]), "no_page_mapping"],
    ["two images of one page", images([png(0), png(1), png(1, A)]), "no_page_mapping"],
    ["images with no numbers", images([png(undefined), png(undefined)]), "no_page_mapping"],
    ["paper", { form: "physical", paged: true, files: [], parts: [0, 1] } satisfies TextOriginal, "physical"],
  ] as [string, TextOriginal, string][])("%s: no page", (_, text, reason) => {
    expect(why(text)).toBe(reason);
  });

  test("on the worked example every part of every source file is a page of its one PDF, as many as the PDF is recorded to have", () => {
    const corpus = loadCorpus(readProject(join(ROOT, "examples/coral-reefs")));
    const texts = Object.values(textOriginals(corpus));
    expect(texts.length).toBe(14);
    for (const text of texts) {
      expect(text.files.length).toBe(1);
      expect(text.parts).toEqual(Array.from({ length: text.page_count! }, (_, i) => i));
      for (const index of text.parts) expect(originalPage(text, index)).toMatchObject({ state: "pdf", page: index + 1, page_count: text.page_count });
    }
    // So every segment of every passage of the example has a page.
    for (const passage of corpus.records.filter((r) => r.data?.kind === "passage")) {
      const data = passage.data as { text: string; anchor: { index: number }[] };
      for (const a of data.anchor) expect(originalPage(textOriginals(corpus)[data.text]!, a.index).state).toBe("pdf");
    }
  });
});

const BYTES = new TextEncoder().encode("%PDF-1.6 invented bytes of an original");
const DIGEST = sha(BYTES);
const other = (n = 0) => {
  const bytes = BYTES.slice();
  bytes[10 + n] = 0x21;
  return bytes;
};
const linkable = platform() !== "win32";

/** A project directory with an empty cache. */
function projectDirectory(): string {
  const root = join(temporary(), "project");
  mkdirSync(join(root, ".stemma/originals"), { recursive: true });
  return root;
}
const read = async (root: string, places: string[] = [], search?: { entries: number }) => {
  const got = await createOriginals(root, places, search).read(DIGEST, BYTES.length);
  return "bytes" in got ? (Buffer.compare(got.bytes, Buffer.from(BYTES)) === 0 ? "found" : "WRONG BYTES") : got.refused;
};

describe("US-121-AC4 where originals are looked for", () => {
  test("in the cache under the digest's name, and nowhere else in the project", async () => {
    const root = projectDirectory();
    writeFileSync(join(root, "book.pdf"), BYTES);
    mkdirSync(join(root, "originals"));
    writeFileSync(join(root, "originals", DIGEST), BYTES);
    writeFileSync(join(root, ".stemma/originals/book.pdf"), BYTES);
    expect(await read(root)).toBe("original_not_held");
    writeFileSync(join(root, ".stemma/originals", DIGEST), BYTES);
    expect(await read(root)).toBe("found");
  });

  test("in a named file or folder, whatever the file is called, passing over dot names", async () => {
    const root = projectDirectory();
    const folder = folderOf({ "deep/er/any name": BYTES });
    expect(await read(root, [folder])).toBe("found");
    expect(await read(root, [join(folder, "deep/er/any name")])).toBe("found");
    expect(await read(root, [folderOf({ ".hidden/book.pdf": BYTES, ".book.pdf": BYTES })])).toBe("original_not_held");
    // A folder with a dot name that is itself named is looked in.
    expect(await read(root, [join(folderOf({ ".sources/book.pdf": BYTES }), ".sources")])).toBe("found");
  });

  test("a changed file is refused, in the cache or a named place, and one that grew or shrank is not held", async () => {
    const root = projectDirectory();
    writeFileSync(join(root, ".stemma/originals", DIGEST), other());
    expect(await read(root)).toBe("original_changed");
    // A good copy elsewhere is still found.
    expect(await read(root, [folderOf({ "a.pdf": other(1), "b.pdf": BYTES })])).toBe("found");
    rmSync(join(root, ".stemma/originals", DIGEST));
    expect(await read(root, [folderOf({ "a.pdf": other() })])).toBe("original_changed");
    expect(await read(root, [folderOf({ "a.pdf": new Uint8Array([...BYTES, 0x20]), "b.pdf": BYTES.slice(1) })])).toBe("original_not_held");
  });

  test("a file swapped or edited after it was found is not given from the memory of where it was", async () => {
    const root = projectDirectory();
    const folder = folderOf({ "a.pdf": BYTES });
    const originals = createOriginals(root, [folder]);
    const first = await originals.read(DIGEST, BYTES.length);
    expect("bytes" in first).toBe(true);
    writeFileSync(join(folder, "a.pdf"), other());
    expect(await originals.read(DIGEST, BYTES.length)).toEqual({ refused: "original_changed" });
    // The bytes given before are the ones that were hashed, whatever the file holds now.
    expect("bytes" in first && sha(first.bytes)).toBe(DIGEST);
    // Moved elsewhere inside the place, it is looked for again and found.
    mkdirSync(join(folder, "moved"));
    writeFileSync(join(folder, "moved/b.pdf"), BYTES);
    expect("bytes" in await originals.read(DIGEST, BYTES.length)).toBe(true);
  });

  test.skipIf(!linkable)("no symbolic link is followed: the cache's entry, its directories, a named place, or anything inside one", async () => {
    const outside = folderOf({ "real.pdf": BYTES });
    const real = join(outside, "real.pdf");
    const entry = projectDirectory();
    symlinkSync(real, join(entry, ".stemma/originals", DIGEST));
    expect(await read(entry)).toBe("original_not_held");

    for (const linked of [".stemma/originals", ".stemma"]) {
      const root = join(temporary(), "project");
      const target = join(temporary(), "target");
      mkdirSync(join(target, "originals"), { recursive: true });
      writeFileSync(join(target, "originals", DIGEST), BYTES);
      mkdirSync(root);
      if (linked === ".stemma") symlinkSync(target, join(root, ".stemma"));
      else {
        mkdirSync(join(root, ".stemma"));
        symlinkSync(join(target, "originals"), join(root, ".stemma/originals"));
      }
      expect([linked, await read(root)]).toEqual([linked, "original_not_held"]);
    }

    const inside = folderOf({});
    symlinkSync(real, join(inside, "link.pdf"));
    symlinkSync(outside, join(inside, "linked folder"));
    expect(await read(projectDirectory(), [inside])).toBe("original_not_held");

    // A named place that is a link is refused when the command starts, with why.
    const named = join(temporary(), "named");
    symlinkSync(outside, named);
    const checked = await originalPlaces(ROOT, [named, join(temporary(), "missing"), real]);
    expect(checked.places.map((p) => p.endsWith("real.pdf"))).toEqual([true]);
    expect(checked.warnings).toEqual([expect.stringContaining("it is a symbolic link"), expect.stringContaining("there is nothing there")]);
  });

  test.skipIf(!linkable)("a place replaced by a link, or a found file by one, after it was accepted is not followed", async () => {
    const root = projectDirectory();
    const folder = folderOf({ "sub/a.pdf": BYTES });
    const elsewhere = folderOf({ "a.pdf": BYTES });
    const originals = createOriginals(root, [folder]);
    expect("bytes" in await originals.read(DIGEST, BYTES.length)).toBe(true);
    // The folder it was found in becomes a link out of the place.
    renameSync(join(folder, "sub"), join(temporary(), "gone"));
    symlinkSync(elsewhere, join(folder, "sub"));
    expect(await originals.read(DIGEST, BYTES.length)).toEqual({ refused: "original_not_held" });
    renameSync(folder, join(temporary(), "away"));
    symlinkSync(elsewhere, folder);
    expect(await originals.read(DIGEST, BYTES.length)).toEqual({ refused: "original_not_held" });
  });

  test("a relative name is taken from the project, a directory under the digest's name is not read, and one search is bounded", async () => {
    const root = projectDirectory();
    mkdirSync(join(root, ".stemma/originals", DIGEST));
    expect(await read(root)).toBe("original_not_held");
    const folder = folderOf({ "a.pdf": new Uint8Array(3), "b.pdf": BYTES });
    linkSync(join(folder, "a.pdf"), join(folder, "c"));
    expect(await read(root, [folder], { entries: 2 })).toBe("original_not_held");
    expect(await read(root, [folder], { entries: 3 })).toBe("found");
    const base = folderOf({ "kept/x": BYTES });
    expect((await originalPlaces(base, ["kept"])).places[0]!.endsWith("kept")).toBe(true);
  });
});

/** The real server over the real finder, with a stand-in for the snapshot's record of originals. */
async function serving(recorded: Record<string, { size: number; media_type: string }>, more: Partial<ListenOptions>, run: (server: Listening, secret: string, asked: string[]) => Promise<void>) {
  const asked: string[] = [];
  const verdict: Verdict = {
    state: "current", data_identity: "d".repeat(64),
    process: {
      build: async () => ({ data_identity: "", entries: 0, warnings: [] }), identity: async () => "", stop: () => {}, ended: new Promise<void>(() => {}),
      ask: async (route, body) => {
        asked.push(`${route} ${JSON.stringify(body)}`);
        const sha256 = (body as { sha256: string }).sha256;
        return { status: 200, body: JSON.stringify({ data_identity: "d".repeat(64), result: Object.hasOwn(recorded, sha256) ? recorded[sha256] : null }) };
      },
    },
  };
  const session: Session = createSession();
  const server = await listen({ assets: { html: "", js: "", css: "", pdf: servedPdf() }, session, check: async () => verdict, ...more });
  try {
    const nonce = newNonce();
    const got = session.redeem({ method: "POST", path: "/api/session", body: Buffer.from("{}"), nonce, mac: requestMac(session.code, "/api/session", "{}", nonce) });
    await run(server, (got as { secret: string }).secret, asked);
  } finally {
    await server.close();
  }
}

const sender = (server: Listening) => (path: string, init: { headers: Record<string, string>; body: string }) =>
  fetch(`${server.address.slice(0, -1)}${path}`, { method: "POST", headers: { origin: server.address.slice(0, -1), "content-type": "application/json", "x-stemma-request": "1", ...init.headers }, body: init.body });
const callOf = (server: Listening, secret: string) => async (path: string, body: unknown) => {
  const got = (await provedBytes(sender(server), secret, TAGS.call, path, JSON.stringify(body)))!;
  expect(got, `${path} answered without a right proof`).toBeDefined();
  return got;
};
const codeOf = (bytes: Uint8Array) => (JSON.parse(new TextDecoder().decode(bytes)) as { error: { code: string } }).error.code;

describe("US-121-AC5 what the server gives of originals", () => {
  const recorded = { [DIGEST]: { size: BYTES.length, media_type: "application/pdf" }, [A]: { size: 9, media_type: "text/plain" }, [B]: { size: 301 * 1024 * 1024, media_type: "image/png" } };
  const held = () => createOriginals(projectDirectory(), [folderOf({ "a.pdf": BYTES })]);

  test("the very bytes, proved, as an inert attachment under a policy of its own", async () => {
    await serving(recorded, { originals: held() }, async (server, secret) => {
      const got = await callOf(server, secret)("/original", { sha256: DIGEST });
      expect([got.status, Buffer.compare(Buffer.from(got.bytes), Buffer.from(BYTES))]).toEqual([200, 0]);
      const body = JSON.stringify({ sha256: DIGEST });
      const nonce = newNonce();
      const reply = await raw(server.port, [request("POST", "/original", [["Host", `127.0.0.1:${server.port}`], ["Origin", `http://127.0.0.1:${server.port}`],
        ["Content-Type", "application/json"], ["X-Stemma-Request", "1"], ["X-Stemma-Nonce", nonce], ["X-Stemma-Mac", requestMac(secret, "/original", body, nonce)]], body)]);
      expect(reply.status).toBe(200);
      expect(reply.headers).toMatchObject({
        "content-type": "application/octet-stream", "content-disposition": 'attachment; filename="original"',
        "content-security-policy": "default-src 'none'; sandbox; frame-ancestors 'none'", "cross-origin-resource-policy": "same-origin",
        "x-content-type-options": "nosniff", "cache-control": "no-store", "x-frame-options": "DENY",
      });
      expect(Object.keys(reply.headers).filter((n) => n.startsWith("access-control") || n === "set-cookie")).toEqual([]);
    });
  });

  test("refused, with proof and no value from the request: unknown, unsupported, too large, not held, changed", async () => {
    const root = projectDirectory();
    const C = "c".repeat(64);
    writeFileSync(join(root, ".stemma/originals", C), "xy");
    await serving({ ...recorded, [C]: { size: 2, media_type: "image/png" }, ["e".repeat(64)]: { size: 2, media_type: "image/jpeg" } }, { originals: createOriginals(root, []) }, async (server, secret) => {
      for (const [sha256, status, code] of [
        ["f".repeat(64), 404, "unknown_original"], [A, 415, "original_unsupported"], [B, 422, "original_too_large"],
        ["e".repeat(64), 404, "original_not_held"], [C, 409, "original_changed"],
      ] as const) {
        const got = await callOf(server, secret)("/original", { sha256 });
        expect([sha256, got.status, codeOf(got.bytes)]).toEqual([sha256, status, code]);
        expect(new TextDecoder().decode(got.bytes)).not.toContain(sha256);
      }
    });
  });

  test("a request names only a digest: paths and other bodies are refused before anything is asked or read", async () => {
    let reads = 0;
    await serving(recorded, { originals: { read: async () => (reads++, { refused: "original_not_held" }) } }, async (server, secret, asked) => {
      for (const body of [{ sha256: "../../etc/passwd" }, { sha256: "/etc/passwd" }, { sha256: DIGEST.toUpperCase() }, { sha256: [DIGEST] }, { sha256: DIGEST, path: "/etc/passwd" }, { path: "x" }, {}]) {
        const got = await callOf(server, secret)("/original", body);
        expect([JSON.stringify(body), got.status]).toEqual([JSON.stringify(body), 400]);
      }
      expect([asked, reads]).toEqual([[], 0]);
      // The page cannot name the call that tells the command what is recorded.
      expect((await sender(server)("/api/original-record", { headers: {}, body: "{}" })).status).toBe(404);
      for (const path of [`/original/${DIGEST}`, `/original?sha256=${DIGEST}`, "/original"]) {
        const reply = await raw(server.port, [request("GET", path, [["Host", `127.0.0.1:${server.port}`]])]);
        expect([path, reply.status]).toEqual([path, 404]);
      }
    });
  });

  test("unsigned, replayed, from another origin or host, or without the request header, nothing is read", async () => {
    let reads = 0;
    await serving(recorded, { originals: { read: async () => (reads++, { refused: "original_not_held" }) } }, async (server, secret) => {
      const body = JSON.stringify({ sha256: DIGEST });
      const send = (change: Record<string, string | undefined>, nonce = newNonce()) => {
        const all: Record<string, string | undefined> = {
          Host: `127.0.0.1:${server.port}`, Origin: `http://127.0.0.1:${server.port}`, "Content-Type": "application/json", "X-Stemma-Request": "1",
          "X-Stemma-Nonce": nonce, "X-Stemma-Mac": requestMac(secret, "/original", body, nonce), ...change,
        };
        return raw(server.port, [request("POST", "/original", Object.entries(all), body)]);
      };
      for (const [change, status] of [
        [{ "X-Stemma-Mac": undefined }, 401], [{ "X-Stemma-Mac": requestMac("x".repeat(43), "/original", body, newNonce()) }, 401],
        [{ Origin: "http://evil.example" }, 403], [{ Origin: undefined }, 403], [{ Host: `localhost:${server.port}` }, 403], [{ "X-Stemma-Request": undefined }, 403],
        [{ "Content-Type": "text/plain" }, 415],
      ] as [Record<string, string | undefined>, number][]) {
        expect([JSON.stringify(change), (await send(change)).status]).toEqual([JSON.stringify(change), status]);
      }
      expect(reads).toBe(0);
      const nonce = newNonce();
      expect((await send({}, nonce)).status).toBe(404);
      expect((await send({}, nonce)).status).toBe(401);
      expect(reads).toBe(1);
    });
  });

  test("while the records are being read again no original is given", async () => {
    await serving(recorded, { originals: held(), check: async () => ({ state: "rebuilding" }) }, async (server, secret) => {
      const got = await callOf(server, secret)("/original", { sha256: DIGEST });
      expect([got.status, codeOf(got.bytes)]).toEqual([503, "index_stale"]);
    });
  });

  test("only so many originals are held at once; others wait, and one not taken in time gives its place up", async () => {
    let open = 0;
    let most = 0;
    const big = Buffer.alloc(24 * 1024 * 1024, 7);
    const originals = {
      read: async () => {
        most = Math.max(most, ++open);
        await Bun.sleep(100);
        open--;
        return { bytes: big };
      },
    };
    await serving({ [DIGEST]: { size: big.length, media_type: "application/pdf" } }, { originals, originalLimits: { held: 2, sendMs: 700 } }, async (server, secret) => {
      const call = callOf(server, secret);
      const all = await Promise.all(Array.from({ length: 5 }, () => call("/original", { sha256: DIGEST })));
      expect([all.map((a) => a.status), most <= 2]).toEqual([[200, 200, 200, 200, 200], true]);
      // Two that ask and never read their answers hold both places only until the send limit.
      const { connect } = await import("node:net");
      const body = JSON.stringify({ sha256: DIGEST });
      const stalled = [0, 1].map(() => {
        const nonce = newNonce();
        const socket = connect(server.port, "127.0.0.1");
        socket.pause();
        socket.on("error", () => {});
        socket.write(request("POST", "/original", [["Host", `127.0.0.1:${server.port}`], ["Origin", `http://127.0.0.1:${server.port}`], ["Content-Type", "application/json"],
          ["X-Stemma-Request", "1"], ["X-Stemma-Nonce", nonce], ["X-Stemma-Mac", requestMac(secret, "/original", body, nonce)]], body));
        return socket;
      });
      await Bun.sleep(300);
      const began = Date.now();
      expect((await call("/original", { sha256: DIGEST })).status).toBe(200);
      expect(Date.now() - began).toBeLessThan(5000);
      for (const socket of stalled) socket.destroy();
    });
  }, 30_000);

  test("pdf.js's own data is given only to a signed call, by a name it is only looked up under, and its scripts by their exact paths", async () => {
    await serving({}, {}, async (server, secret, asked) => {
      const call = callOf(server, secret);
      const cmap = await call("/pdfjs-data", { name: "cmaps/UniJIS-UCS2-H.bcmap" });
      expect([cmap.status, sha(cmap.bytes)]).toEqual([200, sha(readFileSync(join(ROOT, "node_modules/pdfjs-dist/cmaps/UniJIS-UCS2-H.bcmap")))]);
      expect((await call("/pdfjs-data", { name: "standard_fonts/LiberationSans-Regular.ttf" })).status).toBe(200);
      for (const name of ["cmaps/LICENSE", "standard_fonts/LICENSE_FOXIT", "cmaps/../package.json", "../package.json", "/etc/passwd", "wasm/openjpeg.wasm", "__proto__", "constructor"]) {
        expect([name, (await call("/pdfjs-data", { name })).status]).toEqual([name, 404]);
      }
      expect((await sender(server)("/pdfjs-data", { headers: {}, body: "{}" })).status).toBe(401);
      expect(asked).toEqual([]);
      const get = (path: string) => raw(server.port, [request("GET", path, [["Host", `127.0.0.1:${server.port}`]])], { waitMs: 10_000 });
      for (const path of ["/pdf-worker.js", "/pdfjs/pdf.worker.min.js", "/pdfjs/openjpeg_nowasm_fallback.js", "/pdfjs/jbig2_nowasm_fallback.js"]) {
        const reply = await get(path);
        expect([path, reply.status, reply.headers["content-type"], reply.headers["content-security-policy"]?.includes("script-src 'self';")]).toEqual([path, 200, "text/javascript; charset=utf-8", true]);
      }
      for (const path of ["/pdfjs/openjpeg.wasm", "/pdfjs/quickjs-eval.js", "/pdfjs/../package.json", "/pdfjs/", "/pdf-worker.js?x", "/pdfjs/cmaps/UniJIS-UCS2-H.bcmap", "/toString"]) {
        expect([path, (await get(path)).status]).toEqual([path, 404]);
      }
    });
  });
});

describe("US-121 the built command", () => {
  test("serves a recorded original from a named folder, says where it looks, warns of a named link, and tells which page it is", async () => {
    const bytes = originalPdf();
    const png = originalPng(1);
    const dir = writeOriginalsProject(pdfTie(bytes));
    const folder = folderOf({ "book.pdf": bytes, "unrecorded.png": png });
    const link = join(temporary(), "link");
    if (linkable) symlinkSync(folder, link);
    const one = await Browsing.start(dir, ["--originals", folder, ...(linkable ? ["--originals", link] : [])]);
    expect((one.info as unknown as { originals: string[] }).originals).toHaveLength(1);
    if (linkable) expect(one.run.stderr).toContain("WARNING originals_place:");
    const view = await one.call("/api/source-view", { id: PASSAGES.two.id });
    const text = view.json.result.source_text.id as string;
    expect((await one.call("/api/original-page", { text, index: 1 })).json.result).toEqual({ state: "pdf", sha256: sha(bytes), size: bytes.length, page: 2, page_count: 3 });
    expect((await one.call("/api/original-page", { text, index: 7 })).json.result).toMatchObject({ state: "none", reason: "no_page_mapping" });
    expect((await one.call("/api/original-page", { text: "txt-nothing", index: 0 })).json.result).toBeNull();
    expect((await one.call("/api/original-page", { text, index: -1 })).status).toBe(400);
    const call = callOf({ address: one.info.address } as Listening, one.secret);
    const got = await call("/original", { sha256: sha(bytes) });
    expect([got.status, sha(got.bytes)]).toEqual([200, sha(bytes)]);
    // A file in a named folder that no source file records is not given.
    expect(codeOf((await call("/original", { sha256: sha(png) })).bytes)).toBe("unknown_original");
    // A change of the record changes what is given, without a new start.
    writeOriginalsProject(imageTie([originalPng(0), originalPng(1), originalPng(2)]), {}, dir);
    await one.call("/api/status");
    await one.current();
    expect((await one.call("/api/original-page", { text, index: 1 })).json.result).toMatchObject({ state: "image", sha256: sha(png), media_type: "image/png" });
    expect(sha((await call("/original", { sha256: sha(png) })).bytes)).toBe(sha(png));
    expect(codeOf((await call("/original", { sha256: sha(bytes) })).bytes)).toBe("unknown_original");
    await one.stop();
  }, 60_000);

  test("without --originals it looks only in the cache, and says so", async () => {
    const bytes = originalPdf();
    const dir = writeOriginalsProject(pdfTie(bytes));
    const run = await Run.command(["browse", "--no-open", "--project", dir]);
    await run.until(() => run.stdout.includes("without use"));
    expect(run.stdout).toContain("Originals are looked for only in .stemma/originals/. Name where yours are with --originals <folder>.");
    await run.stop();
    mkdirSync(join(dir, ".stemma/originals"), { recursive: true });
    writeFileSync(join(dir, ".stemma/originals", sha(bytes)), bytes);
    const one = await Browsing.start(dir);
    expect(sha((await callOf({ address: one.info.address } as Listening, one.secret)("/original", { sha256: sha(bytes) })).bytes)).toBe(sha(bytes));
    await one.stop();
  }, 60_000);
});

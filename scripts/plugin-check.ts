// Installs the plugin from a marketplace into a fresh HOME and
// CLAUDE_CONFIG_DIR with no bun on the search path, then lets the plugin set
// itself up and run. The marketplace is a local directory laid out like
// DocumentDrivenDX/plugins and filled by the publish script. The Claude
// command-line tool is a test harness only; it signs in nowhere and makes no
// model call. Nothing is published.
//   ./scripts/dev.sh plugin-check
// Setup fetches the pinned Bun from the npm registry. STEMMA_BUN_ARCHIVE may
// name a local copy of that archive instead.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { TAGS, type TagPair } from "../packages/core/src/browse-proof.ts";
import { provedPost } from "../packages/explorer/src/proof.ts";
import { MARKETPLACE, PLUGIN_SOURCE, publishInto } from "./publish-plugin.ts";
import { makePdf } from "../tests/pdf.ts";

const root = join(import.meta.dir, "..");
const release = join(root, "dist/release");
const base = mkdtempSync(join(tmpdir(), "stemma-plugin-check-"));
const home = join(base, "home");
const config = join(base, "claude-config");
mkdirSync(home);
mkdirSync(config);

const claude = Bun.which("claude");
if (!claude) {
  console.error("plugin-check: the claude command is not on the search path, so nothing was checked.");
  process.exit(4);
}
// A minimal environment: no credentials or settings from the caller's session,
// and a search path that holds only the system's own tools.
const env: Record<string, string> = {
  PATH: "/usr/bin:/bin:/usr/sbin:/sbin", HOME: home, CLAUDE_CONFIG_DIR: config, TMPDIR: tmpdir(),
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1", DISABLE_AUTOUPDATER: "1", DISABLE_TELEMETRY: "1",
  GIT_AUTHOR_NAME: "plugin-check", GIT_AUTHOR_EMAIL: "plugin-check@example.invalid",
  GIT_COMMITTER_NAME: "plugin-check", GIT_COMMITTER_EMAIL: "plugin-check@example.invalid",
  ...(process.env.STEMMA_BUN_ARCHIVE ? { STEMMA_BUN_ARCHIVE: process.env.STEMMA_BUN_ARCHIVE } : {}),
};

function fail(message: string): never {
  console.error(`FAILED: ${message}`);
  process.exit(1);
}

function run(command: string[], expected = 0, cwd = base): string {
  const done = Bun.spawnSync(command, { cwd, env });
  const out = done.stdout.toString() + done.stderr.toString();
  console.log(`\n$ ${command.join(" ").replaceAll(claude!, "claude").replaceAll(base, "$CHECK").replaceAll(root, ".")}\n${out.trimEnd()}\n[exit ${done.exitCode}]`);
  if (done.exitCode !== expected) fail(`expected exit ${expected}`);
  return out;
}

if (Bun.spawnSync(["/bin/sh", "-c", "command -v bun"], { env }).exitCode === 0) fail("bun is on the clean search path");
console.log(`Isolated profile: ${config}\nSearch path: ${env.PATH} (no bun on it)`);

// A local stand-in for the organization marketplace, filled as a release fills it.
const front = join(base, "plugins");
mkdirSync(join(front, ".claude-plugin"), { recursive: true });
writeFileSync(join(front, ".claude-plugin/marketplace.json"), `${JSON.stringify({
  name: MARKETPLACE, owner: { name: "DocumentDrivenDX" },
  plugins: [
    { name: "stemma", description: "Stemma, as built here.", source: PLUGIN_SOURCE },
    { name: "docsync", description: "A stand-in for the dependency.", source: "./plugins/docsync" },
  ],
}, null, 2)}\n`);
// Stemma declares docsync as a dependency (ADR-011). The stand-in shows that
// installing Stemma installs it; it is not the real plugin.
mkdirSync(join(front, "plugins/docsync/.claude-plugin"), { recursive: true });
writeFileSync(join(front, "plugins/docsync/.claude-plugin/plugin.json"),
  `${JSON.stringify({ name: "docsync", version: "0.0.0", description: "A stand-in." })}\n`);
publishInto(front, release);

for (const tree of [root, release]) {
  run([claude, "plugin", "validate", join(tree, ".claude-plugin/plugin.json")]);
}
run([claude, "plugin", "validate", join(front, ".claude-plugin/marketplace.json")]);
const id = `stemma@${MARKETPLACE}`;
run([claude, "plugin", "marketplace", "add", front]);
run([claude, "plugin", "install", id]);
const listed = JSON.parse(run([claude, "plugin", "list", "--json"])) as { id: string; installPath: string; enabled: boolean; errors?: unknown[] }[];
const entry = listed.find((p) => p.id === id) ?? fail(`${id} is not listed`);
if (!entry.enabled || entry.errors?.length) fail("the plugin is listed as disabled or with errors");
const dependency = listed.find((p) => p.id === `docsync@${MARKETPLACE}`);
if (!dependency?.enabled || dependency.errors?.length) fail("installing the plugin did not install and enable docsync");
const installed = entry.installPath;
if (relative(config, installed).startsWith("..")) fail("the installed copy is outside the isolated profile");
run([claude, "plugin", "details", id]);

const skills = readdirSync(join(installed, "skills"));
if (skills.length !== 1 || skills[0] !== "stemma") fail(`expected one skill, found ${skills.join(", ")}`);
const bundle = join(installed, "dist/stemma.js");
if (!existsSync(bundle)) fail("the installed copy has no command line");
const sha = (path: string) => new Bun.CryptoHasher("sha256").update(readFileSync(path)).digest("hex");
for (const part of new Bun.Glob("*.js").scanSync(join(release, "dist"))) {
  const copy = join(installed, "dist", part);
  if (!existsSync(copy) || sha(copy) !== sha(join(release, "dist", part))) fail(`the installed command line differs from the built one: ${part}`);
}
console.log(`\nInstalled command line matches the build: sha256 ${sha(bundle)}`);

// What the skill tells Claude to run. The data directory stands in for the one
// the host substitutes for ${CLAUDE_PLUGIN_DATA}.
const data = join(config, `plugins/data/stemma-${MARKETPLACE}`);
const launcher = ["/bin/sh", join(installed, "scripts/stemma.sh"), data];
run([...launcher, "setup"]);
const again = run([...launcher, "setup"]);
if (again.includes("one-time setup")) fail("a second run set up again");
const book = join(base, "seeded-book");
cpSync(join(root, "fixtures/seeded"), book, { recursive: true });
const doctor = run([...launcher, "doctor", "--project", book]);
if (!doctor.includes(join(data, "bun-"))) fail("the command line did not run on the plugin's own Bun");
const report = run([...launcher, "check", "--project", book], 1);
if (!report.includes("ghost2020")) fail("the installed command line did not report the seeded unknown key");
// Reading a PDF from the installed copy. Its text is in a font that needs a
// predefined character map, so it comes out only if the packaged data is found.
const files = readdirSync(installed, { recursive: true }).map(String);
const native = files.filter((f) => /\.(node|dylib|so|dll)$/i.test(f) || f.includes("node_modules"));
if (native.length > 0) fail(`the installed plugin holds native modules or packages: ${native.slice(0, 5).join(", ")}`);
console.log(`\nInstalled plugin: ${files.length} files and directories, none a native module, and no node_modules.`);
const reading = join(base, "reading");
run([...launcher, "init", "--project", reading]);
const pdf = join(base, "invented.pdf");
writeFileSync(pdf, makePdf({ pages: [["\u6e2f\u306e\u901a\u884c\u7a0e"]], font: "japanese" }));
const added = run([...launcher, "source", "convert", pdf, "--project", reading, "--actor", "software:plugin-check", "--acquired-at", "2026-01-05T09:00:00Z"]);
const directory = /to (sources\/[a-z0-9-]+)\//.exec(added)?.[1] ?? fail("no source file was written");
if (!added.includes("method text_layer")) fail("the installed copy did not read the PDF");
if (added.includes("cMapUrl") || added.includes("standardFontDataUrl")) fail("the packaged font or character-map data was not found");
if (!readFileSync(join(reading, directory, "pages/p0000.md"), "utf8").includes("\u6e2f\u306e\u901a\u884c\u7a0e")) fail("the text did not come out of the PDF");

// The explorer page from the installed copy: filled from the shipped template,
// with no node_modules and no bundling on this machine.
const browsed = run([...launcher, "graph", "export", "--audience", "author", "--page", "--project", reading]);
const identity = /Data identity ([0-9a-f]{12})/.exec(browsed)?.[1] ?? fail("the export printed no data identity");
const explorer = readFileSync(join(reading, "build/graph/author/explorer.html"), "utf8");
if (!explorer.includes("connect-src 'none'") || !explorer.includes(identity)) fail("the installed copy made no explorer page for this data");
run([...launcher, "graph", "status", "--project", reading]);

// The explorer served by the installed copy: the shipped page and worker, with
// no node_modules. It is started with --no-open; the code is read from the
// launch file as a browser would be sent it.
async function checkBrowse(): Promise<void> {
  const served = join(base, "served");
  cpSync(join(root, "examples/coral-reefs"), served, { recursive: true, filter: (from) => !/[\\/](build|\.stemma)$/.test(from) });
  const command = [...launcher, "browse", "--no-open", "--format", "json", "--project", served];
  console.log(`\n$ ${command.join(" ").replaceAll(base, "$CHECK")}`);
  const child = Bun.spawn(command, { cwd: base, env, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  // Ended here too if the check stops part way, so that nothing is left running.
  process.on("exit", () => child.kill("SIGKILL"));
  const deadline = setTimeout(() => child.kill("SIGKILL"), 120_000);
  const reader = child.stdout.getReader();
  let output = "";
  while (!output.includes("\n")) {
    const next = await reader.read();
    if (next.done) break;
    output += new TextDecoder().decode(next.value);
  }
  if (!output.includes("\n")) fail(`the installed copy did not serve: ${await new Response(child.stderr).text()}`);
  const info = JSON.parse(output.split("\n")[0]!) as { address: string; data_identity: string; launch_file: string };
  console.log(output.trim().replaceAll(base, "$CHECK"));
  const origin = info.address.replace(/\/$/, "");
  const code = /#code=([A-Za-z0-9_-]+)/.exec(readFileSync(info.launch_file, "utf8"))?.[1] ?? fail("the launch file holds no code");
  const send = (path: string, init: { headers: Record<string, string>; body: string }) =>
    fetch(`${origin}${path}`, { method: "POST", headers: { origin, "content-type": "application/json", "x-stemma-request": "1", ...init.headers }, body: init.body });
  // Signed, and the answer's proof checked, as the page does it.
  const post = async (path: string, body: unknown, key: string, tags: TagPair = TAGS.call) => {
    const got = await provedPost(send, key, tags, path, JSON.stringify(body)) ?? fail(`the answer to ${path} proved nothing`);
    return { status: got.status, json: JSON.parse(got.text) as Record<string, any> };
  };
  if ((await send("/api/boot", { headers: {}, body: "{}" })).status !== 401) fail("an unsigned call was answered");
  const secret = (await post("/api/session", {}, code, TAGS.code)).json.secret as string;
  if (!secret || (await post("/api/session", {}, code, TAGS.code)).json.error?.code !== "code_used") fail("the one-time code did not work exactly once");
  if (existsSync(info.launch_file)) fail("the launch file stayed after its code was used");
  for (const asset of ["", "app.js", "app.css"]) {
    if ((await fetch(`${origin}/${asset}`)).status !== 200) fail(`the installed copy did not serve /${asset}`);
  }
  const boot = await post("/api/boot", {}, secret);
  if (boot.json.data_identity !== info.data_identity || boot.json.result.manuscript_state !== "read") fail("the installed copy served no data");
  const read = await post("/api/query", { module: "stemma", query: "query { sourceList(limit: 5) { items { key } } }" }, secret);
  if (!(read.json.result?.data?.sourceList?.items?.length > 0)) fail("arras in the installed copy answered no read");
  const search = await post("/api/search", { text: "subsid", offset: 0, limit: 5 }, secret);
  if (!(search.json.result?.hits?.length === 5 && search.json.result.total > 5)) fail("the installed copy answered no search");
  const manuscript = (await post("/api/manuscript", {}, secret)).json.result;
  const passage = (Object.values(manuscript.quotations)[0] as any).view.passages[0].passage as string;
  const view = (await post("/api/source-view", { id: passage }, secret)).json.result;
  if (view?.state !== "highlighted") fail("the installed copy gave no highlighted source view");
  child.kill("SIGINT");
  const exit = await child.exited;
  clearTimeout(deadline);
  let rest = "";
  for (let next = await reader.read(); !next.done; next = await reader.read()) rest += new TextDecoder().decode(next.value);
  const said = output + rest + (await new Response(child.stderr).text());
  if (exit !== 0) fail(`browse ended with ${exit}: ${said}`);
  if (said.includes(secret) || said.includes(code)) fail("the secret or the code was printed");
  if (!said.includes("The one-time link was opened at ")) fail("the command did not say that the link was opened");
  if (Bun.spawnSync(["ps", "-A", "-o", "command="]).stdout.toString().includes(join(installed, "dist/browse-worker.js"))) fail("the process holding the data was left running");
  console.log(`[exit ${exit}] served the page, a search, the manuscript and a highlighted source view; the code worked once; neither it nor the secret was printed.`);
}
await checkBrowse();

// Formatting a citation with the bundled citeproc-js, style and locale, whose licences ship beside it.
for (const licence of ["CPAL-1.0.txt", "CC-BY-SA-3.0.txt", "citeproc-js-LICENSE", "NOTICE.txt"]) {
  if (!files.includes(join("dist/licenses/cite", licence))) fail(`the installed plugin lacks dist/licenses/cite/${licence}`);
}
const invented = join(base, "invented-source.json");
writeFileSync(invented, JSON.stringify({
  kind: "source", citation_key: "example1987", type: "book", title: { value: "An Invented Harbour Survey" },
  contributions: [{ lid: "a1", role: "author", as_printed: { family: "Example", given: "Ann" } }], issued: { edtf: "1987" },
  bib: [{ name: "publisher", value: { value: "Invented Press" } }],
}));
run([...launcher, "record", "add", "source", "--input", invented, "--actor", "software:plugin-check", "--project", reading]);
const clusters = join(base, "clusters.json");
writeFileSync(clusters, JSON.stringify({ notes: [[{ key: "example1987", locator: "41" }], [{ key: "example1987", locator: "42" }]] }));
const cited = run([...launcher, "cite", "format", "--input", clusters, "--project", reading]);
for (const expected of ["1. Ann Example, An Invented Harbour Survey (Invented Press, 1987), 41.", "2. Example, An Invented Harbour Survey, 42.", "Example, Ann. An Invented Harbour Survey. Invented Press, 1987."]) {
  if (!cited.replaceAll("*", "").includes(expected)) fail(`the installed command line did not format the citation: expected ${expected}`);
}

if (readdirSync(home).some((name) => name.startsWith(".bun") || /profile|rc$/.test(name))) fail("something was written to the home directory");

console.log(`
PASSED on this machine with the Claude command-line tool: both manifests validate, the
plugin installs from a local stand-in for the DocumentDrivenDX marketplace
into an empty profile with one skill, bringing a stand-in docsync dependency with it, and with no bun on the search path the
launcher fetches the pinned Bun into the plugin data directory and runs the installed
command line, which reads the text of a synthetic PDF with the packaged library data and
no native module, and formats Chicago notes and a bibliography with the bundled citeproc-js, and makes the explorer page from the shipped template (the page is not
opened in a browser here), and serves the worked example on 127.0.0.1 from the shipped served page and its own child process
(the served page is not opened in a browser here either). The warnings the PDF library printed are shown above as they came. Not checked here: installation from GitHub, the desktop
app, whether a live session loads and follows the skill (that needs a model), Windows
and Linux, and network-denied operation after setup.`);

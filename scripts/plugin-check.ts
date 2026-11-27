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
  plugins: [{ name: "stemma", description: "Stemma, as built here.", source: PLUGIN_SOURCE }],
}, null, 2)}\n`);
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
const installed = entry.installPath;
if (relative(config, installed).startsWith("..")) fail("the installed copy is outside the isolated profile");
run([claude, "plugin", "details", id]);

const skills = readdirSync(join(installed, "skills"));
if (skills.length !== 1 || skills[0] !== "stemma") fail(`expected one skill, found ${skills.join(", ")}`);
const bundle = join(installed, "dist/stemma.js");
if (!existsSync(bundle)) fail("the installed copy has no command line");
const sha = (path: string) => new Bun.CryptoHasher("sha256").update(readFileSync(path)).digest("hex");
if (sha(bundle) !== sha(join(release, "dist/stemma.js"))) fail("the installed command line differs from the built one");
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

if (readdirSync(home).some((name) => name.startsWith(".bun") || /profile|rc$/.test(name))) fail("something was written to the home directory");

console.log(`
PASSED on this machine with the Claude command-line tool: both manifests validate, the
plugin installs from a local stand-in for the DocumentDrivenDX marketplace
into an empty profile with one skill, and with no bun on the search path the
launcher fetches the pinned Bun into the plugin data directory and runs the installed
command line, which reads the text of a synthetic PDF with the packaged library data and
no native module. The warnings the PDF library printed are shown above as they came. Not checked here: installation from GitHub, the desktop
app, whether a live session loads and follows the skill (that needs a model), Windows
and Linux, and network-denied operation after setup.`);

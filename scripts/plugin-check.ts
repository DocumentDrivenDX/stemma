// Local plugin load check (CONTRACT-004 F: the Claude command-line tool is a test
// harness only; nothing here says anything about the desktop app). It uses a
// fresh HOME and CLAUDE_CONFIG_DIR, signs in nowhere and makes no model call.
// Run it with ./scripts/dev.sh plugin-check.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

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
// A minimal environment: no credentials or settings from the caller's session.
const env = {
  PATH: process.env.PATH ?? "", HOME: home, CLAUDE_CONFIG_DIR: config, TMPDIR: tmpdir(),
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1", DISABLE_AUTOUPDATER: "1", DISABLE_TELEMETRY: "1",
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

console.log(`Isolated profile: ${config}`);
run([claude, "--version"]);
for (const tree of [root, release]) {
  run([claude, "plugin", "validate", join(tree, ".claude-plugin/plugin.json")]);
  run([claude, "plugin", "validate", join(tree, ".claude-plugin/marketplace.json")]);
}
run([claude, "plugin", "marketplace", "add", release]);
run([claude, "plugin", "install", "stemma@stemma"]);
const listed = JSON.parse(run([claude, "plugin", "list", "--json"])) as { id: string; installPath: string; enabled: boolean; errors?: unknown[] }[];
const entry = listed.find((p) => p.id === "stemma@stemma") ?? fail("stemma@stemma is not listed");
if (!entry.enabled || entry.errors?.length) fail("the plugin is listed as disabled or with errors");
const installed = entry.installPath;
if (relative(config, installed).startsWith("..")) fail("the installed copy is outside the isolated profile");
run([claude, "plugin", "details", "stemma@stemma"]);

const skills = readdirSync(join(installed, "skills"));
if (skills.length !== 1 || skills[0] !== "stemma") fail(`expected one skill, found ${skills.join(", ")}`);
const bundle = join(installed, "dist/stemma.js");
if (!existsSync(bundle)) fail("the installed copy has no command line");
const sha = (path: string) => new Bun.CryptoHasher("sha256").update(readFileSync(path)).digest("hex");
if (sha(bundle) !== sha(join(release, "dist/stemma.js"))) fail("the installed command line differs from the built one");
console.log(`\nInstalled command line matches the build: sha256 ${sha(bundle)}`);

// The invocation the skill documents: working directory is the installed plugin root.
const book = join(base, "seeded-book");
cpSync(join(root, "fixtures/seeded"), book, { recursive: true });
const stemma = [process.execPath, "--no-install", "--no-env-file", "--config=/dev/null", bundle];
run([...stemma, "doctor", "--project", book], 0, installed);
const report = run([...stemma, "check", "--project", book], 1, installed);
if (!report.includes("ghost2020")) fail("the installed command line did not report the seeded unknown key");

console.log(`
PASSED on this machine with the Claude command-line tool: both manifests validate, the
locally built release tree installs into an empty profile with one skill, and the
installed command line runs. Not checked: the desktop app, whether a live session
loads and follows the skill (that needs a model), delivery from the repository
marketplace, and network-denied operation.`);

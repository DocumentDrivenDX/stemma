// Copies the built release tree into a local checkout of the organization
// marketplace, DocumentDrivenDX/plugins, as plugins/stemma. It changes nothing
// else there (other plugins and the marketplace file stay as they are), and it
// commits and pushes nothing.
//   ./scripts/dev.sh publish-plugin <path to the DocumentDrivenDX/plugins checkout>
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

export const MARKETPLACE = "documentdrivendx";
export const PLUGIN_SOURCE = "./plugins/stemma";

/** Every file under `dir`, by relative path, with its content digest. */
function contents(dir: string): string {
  return readdirSync(dir, { recursive: true })
    .map(String)
    .filter((path) => statSync(join(dir, path)).isFile())
    .sort()
    .map((path) => `${path.replaceAll("\\", "/")} ${new Bun.CryptoHasher("sha256").update(readFileSync(join(dir, path))).digest("hex")}`)
    .join("\n");
}

const versionIn = (dir: string): string => JSON.parse(readFileSync(join(dir, ".claude-plugin/plugin.json"), "utf8")).version;

/**
 * Replaces plugins/stemma in the marketplace checkout with `tree`. Installed
 * copies update only when the version changes, so different content under the
 * published version is an error and nothing is written.
 */
export function publishInto(marketplaceDir: string, tree: string): { version: string; changed: boolean } {
  const manifest = join(marketplaceDir, ".claude-plugin/marketplace.json");
  if (!existsSync(manifest)) throw new Error(`${marketplaceDir} holds no marketplace file.`);
  const marketplace = JSON.parse(readFileSync(manifest, "utf8"));
  const entry = marketplace.plugins?.find((p: { name: string }) => p.name === "stemma");
  if (marketplace.name !== MARKETPLACE || entry?.source !== PLUGIN_SOURCE) {
    throw new Error(`The marketplace file must be named ${MARKETPLACE} and list stemma at ${PLUGIN_SOURCE}.`);
  }
  const target = join(marketplaceDir, "plugins/stemma");
  const version = versionIn(tree);
  if (existsSync(target)) {
    if (contents(target) === contents(tree)) return { version, changed: false };
    if (versionIn(target) === version) {
      throw new Error(`Version ${version} is already published with different content. Give the plugin a new version.`);
    }
    rmSync(target, { recursive: true });
  }
  cpSync(tree, target, { recursive: true });
  return { version, changed: true };
}

if (import.meta.main) {
  const dir = process.argv[2];
  if (!dir) {
    console.error("usage: publish-plugin <path to the DocumentDrivenDX/plugins checkout>");
    process.exit(2);
  }
  const done = publishInto(dir, join(import.meta.dir, "..", "dist/release"));
  console.log(`${done.changed ? "wrote" : "unchanged:"} plugins/stemma ${done.version}. Nothing was committed or pushed.`);
}

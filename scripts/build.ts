// Bundles the command line to dist/stemma.js and assembles the release tree
// dist/release/ that a local marketplace can install. dist/ is not committed.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { isBuiltin } from "node:module";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

/** Fails unless every import left in the bundle is built into Bun (BR-1003). */
export function unresolvedImports(bundle: string): string[] {
  const imports = new Bun.Transpiler({ loader: "js" }).scanImports(bundle);
  return imports.map((i) => i.path).filter((path) => !isBuiltin(path) && !path.startsWith("bun:"));
}

export async function bundle(outdir: string): Promise<string> {
  const built = await Bun.build({
    entrypoints: [join(root, "packages/cli/src/main.ts")],
    outdir, naming: "stemma.js", target: "bun", minify: false,
  });
  if (!built.success) throw new Error(built.logs.join("\n"));
  const path = join(outdir, "stemma.js");
  const left = unresolvedImports(readFileSync(path, "utf8"));
  if (left.length > 0) throw new Error(`unresolved imports in the bundle: ${left.join(", ")}`);
  return path;
}

if (import.meta.main) {
  const dist = join(root, "dist");
  const release = join(dist, "release");
  rmSync(dist, { recursive: true, force: true });
  const built = await bundle(dist);
  mkdirSync(join(release, ".claude-plugin"), { recursive: true });
  mkdirSync(join(release, "dist"));
  cpSync(built, join(release, "dist/stemma.js"));
  cpSync(join(root, "skills"), join(release, "skills"), { recursive: true });
  // The launcher is the only script the plugin ships.
  mkdirSync(join(release, "scripts"));
  cpSync(join(root, "scripts/stemma.sh"), join(release, "scripts/stemma.sh"));
  cpSync(join(root, "LICENSE"), join(release, "LICENSE"));
  cpSync(join(root, ".claude-plugin/plugin.json"), join(release, ".claude-plugin/plugin.json"));
  // Same marketplace as the repository's, but pointing at this tree.
  const marketplace = JSON.parse(readFileSync(join(root, ".claude-plugin/marketplace.json"), "utf8"));
  marketplace.plugins[0].source = "./";
  writeFileSync(join(release, ".claude-plugin/marketplace.json"), `${JSON.stringify(marketplace, null, 2)}\n`);
  console.log(`built ${built}\nrelease tree ${release}`);
}

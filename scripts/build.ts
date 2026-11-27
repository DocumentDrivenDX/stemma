// Bundles the command line to dist/stemma.js, with parts it loads only when needed
// in files beside it, and assembles the release tree
// dist/release/ that the organization marketplace publishes. dist/ is not committed.
import { cpSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { isBuiltin } from "node:module";
import { basename, join } from "node:path";

const root = join(import.meta.dir, "..");

/**
 * What the PDF reader loads at run time, shipped beside the built command line
 * and loaded by a path relative to it (BR-1003), with the licenses (BR-1004).
 * The worker is inside the built file. No native module is shipped.
 */
export function copyPdfData(outdir: string): void {
  const from = join(root, "node_modules/pdfjs-dist");
  const to = join(outdir, "pdfjs");
  mkdirSync(to, { recursive: true });
  for (const name of ["cmaps", "standard_fonts", "LICENSE"]) cpSync(join(from, name), join(to, name), { recursive: true });
}

/** Fails unless every import left in the bundle is built into Bun (BR-1003). */
export function unresolvedImports(bundle: string): string[] {
  const imports = new Bun.Transpiler({ loader: "js" }).scanImports(bundle);
  return imports.map((i) => i.path).filter((path) => !isBuiltin(path) && !path.startsWith("bun:"));
}

/** The licences of the citation processor, style and locale bundled into the command line (BR-1004). */
export function copyCiteLicenses(outdir: string): void {
  cpSync(join(root, "packages/cite/vendor/licenses"), join(outdir, "licenses/cite"), { recursive: true });
}

export async function bundle(outdir: string): Promise<string> {
  const built = await Bun.build({
    entrypoints: [join(root, "packages/cli/src/main.ts")],
    // Splitting keeps the PDF reader out of what every command loads at start.
    outdir, naming: { entry: "stemma.js", chunk: "[name]-[hash].js" }, splitting: true, target: "bun", minify: false,
  });
  if (!built.success) throw new Error(built.logs.join("\n"));
  const path = join(outdir, "stemma.js");
  const parts = built.outputs.filter((o) => o.path.endsWith(".js")).map((o) => basename(o.path));
  const left = parts.flatMap((part) => unresolvedImports(readFileSync(join(outdir, part), "utf8")))
    .filter((i) => !(i.startsWith("./") && parts.includes(i.slice(2))));
  if (left.length > 0) throw new Error(`unresolved imports in the bundle: ${left.join(", ")}`);
  copyPdfData(outdir);
  copyCiteLicenses(outdir);
  return path;
}

if (import.meta.main) {
  const dist = join(root, "dist");
  const release = join(dist, "release");
  rmSync(dist, { recursive: true, force: true });
  const built = await bundle(dist);
  mkdirSync(join(release, ".claude-plugin"), { recursive: true });
  mkdirSync(join(release, "dist"));
  for (const part of new Bun.Glob("*.js").scanSync(dist)) cpSync(join(dist, part), join(release, "dist", part));
  cpSync(join(dist, "pdfjs"), join(release, "dist/pdfjs"), { recursive: true });
  cpSync(join(dist, "licenses"), join(release, "dist/licenses"), { recursive: true });
  cpSync(join(root, "skills"), join(release, "skills"), { recursive: true });
  // The launcher is the only script the plugin ships.
  mkdirSync(join(release, "scripts"));
  cpSync(join(root, "scripts/stemma.sh"), join(release, "scripts/stemma.sh"));
  cpSync(join(root, "LICENSE"), join(release, "LICENSE"));
  cpSync(join(root, ".claude-plugin/plugin.json"), join(release, ".claude-plugin/plugin.json"));
  console.log(`built ${built}\nrelease tree ${release}`);
}

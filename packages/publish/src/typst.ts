// The pinned Typst (ADR-005, ADR-004). Like the pinned Bun, it is fetched once
// into the plugin's data directory, checked against the digest the Typst
// project publishes for the release, unpacked with the system's tar, and its
// version confirmed before use. STEMMA_TYPST_ARCHIVE names a local copy of the
// archive instead; it is checked against the same digest.
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const TYPST_VERSION = "0.15.1";

/** Release assets of Typst 0.15.1 and their SHA-256 digests, as the GitHub release lists them. */
const ASSETS: Record<string, { name: string; sha256: string }> = {
  "darwin-arm64": { name: "typst-aarch64-apple-darwin", sha256: "48f62ed034aa3a7978309579ac6ca00045e2ef0da73114e8af27cfd8e74dc05a" },
  "darwin-x64": { name: "typst-x86_64-apple-darwin", sha256: "7f9fdd9584866245de9a79e0add8f9236fae6f40a8a45e2c4771ccc14db4e0fa" },
  "linux-x64": { name: "typst-x86_64-unknown-linux-musl", sha256: "a6d077d0a95eed5a2eba715b2dae06be954f624ccbf85758a03f389ded33118c" },
  "linux-arm64": { name: "typst-aarch64-unknown-linux-musl", sha256: "5aa8d74a3d906e60ea12a66ac2f37f8eef1b14cbad7182a745e393a10c23dcee" },
  "win32-x64": { name: "typst-x86_64-pc-windows-msvc", sha256: "19ce3551153c2fe7ee9fa2f95208310c8f4d3209fedb699e0333faf8913f6736" },
};

export class TypstUnavailable extends Error {}

const asset = () => {
  const found = ASSETS[`${process.platform}-${process.arch}`];
  if (!found) throw new TypstUnavailable(`Typst ${TYPST_VERSION} has no pinned build for this kind of computer (${process.platform} ${process.arch}).`);
  return found;
};
const archiveName = (a: { name: string }) => `${a.name}${process.platform === "win32" ? ".zip" : ".tar.xz"}`;

/** Where the pinned Typst lives in a data directory. */
export function typstPath(data: string): string {
  const a = asset();
  return join(data, `typst-${TYPST_VERSION}`, a.name, process.platform === "win32" ? "typst.exe" : "typst");
}

const versionOf = (path: string): string | undefined => {
  if (!existsSync(path)) return undefined;
  const done = Bun.spawnSync([path, "--version"], { stdout: "pipe", stderr: "pipe" });
  return done.exitCode === 0 ? done.stdout.toString().trim() : undefined;
};
const ready = (path: string) => versionOf(path)?.startsWith(`typst ${TYPST_VERSION} `) === true || versionOf(path) === `typst ${TYPST_VERSION}`;

/** The pinned Typst, fetched and checked first if the data directory lacks it. Says on stderr when it fetches. */
export async function obtainTypst(data: string, say: (line: string) => void): Promise<string> {
  const path = typstPath(data);
  if (ready(path)) return path;
  const a = asset();
  const dir = join(data, `typst-${TYPST_VERSION}`);
  mkdirSync(dir, { recursive: true });
  const work = mkdtempSync(join(dir, "download."));
  try {
    const file = join(work, archiveName(a));
    const local = process.env.STEMMA_TYPST_ARCHIVE;
    if (local) {
      say(`stemma: one-time setup: unpacking Typst ${TYPST_VERSION} from a local archive into ${dir}.`);
      writeFileSync(file, readFileSync(local));
    } else {
      const url = `https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/${archiveName(a)}`;
      say(`stemma: one-time setup: fetching Typst ${TYPST_VERSION} (about 20 MB) from ${url} into ${dir}. Nothing outside that directory changes.`);
      const response = await fetch(url, { redirect: "follow" });
      if (!response.ok) throw new TypstUnavailable(`The Typst download failed (HTTP ${response.status}). Check the network connection, then run the command again.`);
      writeFileSync(file, new Uint8Array(await response.arrayBuffer()));
    }
    const digest = createHash("sha256").update(readFileSync(file)).digest("hex");
    if (digest !== a.sha256) throw new TypstUnavailable("The Typst archive does not match its pinned digest, so nothing was unpacked or run.");
    const unpack = Bun.spawnSync(["tar", "-xf", file, "-C", work], { stdout: "pipe", stderr: "pipe" });
    if (unpack.exitCode !== 0) throw new TypstUnavailable(`The Typst archive could not be unpacked with tar: ${unpack.stderr.toString().trim()}`);
    rmSync(join(dir, a.name), { recursive: true, force: true });
    renameSync(join(work, a.name), join(dir, a.name));
    if (process.platform !== "win32") chmodSync(path, 0o755);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  if (!ready(path)) throw new TypstUnavailable(`The fetched Typst does not run on this computer or is not version ${TYPST_VERSION}.`);
  return path;
}

/** Compiles one file with no network, no system fonts and a fixed creation time, so the same source gives the same PDF. */
export function compileTypst(typst: string, root: string, input: string, output: string): void {
  const done = Bun.spawnSync([typst, "compile", "--root", root, "--ignore-system-fonts", "--creation-timestamp", "0", input, output],
    { stdout: "pipe", stderr: "pipe", env: { PATH: process.env.PATH ?? "" } });
  if (done.exitCode !== 0) throw new TypstUnavailable(`Typst could not typeset ${input}: ${done.stderr.toString().trim()}`);
}

// Builds the distribution repository the marketplace entry installs: a local
// bare git repository whose `main` holds the built release tree, tagged with the
// plugin version. The owner publishes it by pushing it to
// DocumentDrivenDX/stemma-dist; this script pushes nothing.
//   ./scripts/dev.sh release-repo
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const git = (gitDir: string, args: string[], options: { cwd?: string; env?: Record<string, string | undefined>; allowFailure?: boolean } = {}) => {
  const done = Bun.spawnSync(["git", `--git-dir=${gitDir}`, ...args], {
    ...(options.cwd ? { cwd: options.cwd } : {}), env: options.env ?? process.env,
  });
  if (done.exitCode !== 0 && !options.allowFailure) throw new Error(`git ${args.join(" ")} failed: ${done.stderr.toString()}`);
  return done.exitCode === 0 ? done.stdout.toString().trim() : "";
};

/**
 * Commits `tree` as the next commit of `main` in the bare repository at
 * `gitDir`, creating it if needed, and tags it. A published version never
 * changes: a tag that names other content is an error.
 */
export function releaseInto(gitDir: string, tree: string, tag: string, env: Record<string, string | undefined> = process.env): { commit: string; changed: boolean } {
  if (!existsSync(gitDir)) {
    const made = Bun.spawnSync(["git", "init", "--bare", "--quiet", "--initial-branch=main", gitDir], { env });
    if (made.exitCode !== 0) throw new Error(made.stderr.toString());
  }
  const scratch = mkdtempSync(join(tmpdir(), "stemma-index-"));
  try {
    const here = { cwd: tree, env: { ...env, GIT_INDEX_FILE: join(scratch, "index") } };
    const work = [`--work-tree=${tree}`];
    // Line endings are stored as built, whatever this machine is set to.
    git(gitDir, [...work, "-c", "core.autocrlf=false", "add", "--all", "--force", "."], here);
    const written = git(gitDir, [...work, "write-tree"], here);
    const tagged = git(gitDir, ["rev-parse", "--verify", "--quiet", `refs/tags/${tag}^{commit}`], { env, allowFailure: true });
    if (tagged) {
      if (git(gitDir, ["rev-parse", `${tagged}^{tree}`], { env }) !== written) {
        throw new Error(`${tag} already names a different release tree. Give the plugin a new version.`);
      }
      return { commit: tagged, changed: false };
    }
    const parent = git(gitDir, ["rev-parse", "--verify", "--quiet", "refs/heads/main"], { env, allowFailure: true });
    const commit = git(gitDir, ["commit-tree", written, ...(parent ? ["-p", parent] : []), "-m", `Release ${tag}`], { env });
    git(gitDir, ["update-ref", "refs/heads/main", commit], { env });
    git(gitDir, ["tag", tag, commit], { env });
    return { commit, changed: true };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const root = join(import.meta.dir, "..");
  const version = JSON.parse(readFileSync(join(root, ".claude-plugin/plugin.json"), "utf8")).version;
  const target = join(root, ".tools/stemma-dist.git");
  const done = releaseInto(target, join(root, "dist/release"), `v${version}`);
  console.log(`${done.changed ? "wrote" : "unchanged:"} v${version} at ${done.commit} in .tools/stemma-dist.git. Nothing was pushed.`);
}

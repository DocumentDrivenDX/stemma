// The runtime guard (CONTRACT-002 A, SD-010 BR-1005 and BR-1006).
export const PINNED_BUN = "1.4.5";

/** The documented flags. The last two stop Bun loading a working directory's .env and bunfig.toml. */
export const ISOLATION_FLAGS = ["--no-install", "--no-env-file", "--config=/dev/null"] as const;

export const INSTALL_HELP = `Install Bun ${PINNED_BUN} (official instructions: https://bun.com/docs/installation), then run the command again. Nothing was checked.`;

/** Returns what is wrong with how Bun was started, or undefined. */
export function runtimeProblem(version: string, flags: readonly string[]): string | undefined {
  if (version !== PINNED_BUN) return `This is Bun ${version}; Stemma needs Bun ${PINNED_BUN}. ${INSTALL_HELP}`;
  if (!flags.includes("--no-install")) {
    return `Bun was started without --no-install, so it could download packages while running. Start it as: bun ${ISOLATION_FLAGS.join(" ")} <plugin root>/dist/stemma.js. Nothing was checked.`;
  }
  return undefined;
}

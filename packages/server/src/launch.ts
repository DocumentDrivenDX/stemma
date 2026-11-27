// How the one-time code reaches the browser without passing through a process
// argument, standard output or a log (CONTRACT-005 M, rule 8): a file only its
// owner can read sends the browser to the server, and the browser is opened on
// that file.
import { spawn } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const LAUNCH_NAME = "open-stemma.html";

export interface LaunchFile {
  path: string;
  remove(): void;
}

/**
 * The record route a launch address may name: only this form (CONTRACT-005 N).
 * Each part is unreserved characters and percent escapes, as `recordRoute` writes
 * them. The page accepts the same form (`takeCode`).
 */
export const LAUNCH_ROUTE = /^explore\/stemma\/(?:[A-Za-z0-9._~-]|%[0-9A-F]{2})+\/(?:[A-Za-z0-9._~-]|%[0-9A-F]{2})+$/;

/** encodeURIComponent leaves ! ' ( ) * as they are, and a route holds none of them. */
const encodePart = (part: string): string => encodeURIComponent(part).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** The route of a record, or nothing when no route of the allowed form can name it. */
export function recordRoute(type: string, key: string): string | undefined {
  // A lone surrogate cannot be encoded.
  if (!type.isWellFormed() || !key.isWellFormed()) return undefined;
  const route = `explore/stemma/${encodePart(type)}/${encodePart(key)}`;
  return LAUNCH_ROUTE.test(route) ? route : undefined;
}

/** The code goes in the fragment, which a browser sends in no request and no referrer. */
export function writeLaunchFile(address: string, code: string, parent = tmpdir(), route?: string): LaunchFile {
  if (route !== undefined && !LAUNCH_ROUTE.test(route)) throw new Error("Not a record route.");
  // mkdtemp makes the directory for its owner only; the modes are set again in case a system does not.
  const directory = mkdtempSync(join(parent, "stemma-browse-"));
  chmodSync(directory, 0o700);
  const path = join(directory, LAUNCH_NAME);
  // `&amp;` because both places are attributes of the page below.
  const target = `${address}#code=${code}${route === undefined ? "" : `&amp;to=${route}`}`;
  writeFileSync(path, [
    "<!doctype html>",
    '<meta charset="utf-8">',
    '<meta name="referrer" content="no-referrer">',
    `<meta http-equiv="refresh" content="0;url=${target}">`,
    "<title>Opening Stemma</title>",
    `<p><a href="${target}">Open Stemma</a></p>`,
    "",
  ].join("\n"), { mode: 0o600, flag: "wx" });
  chmodSync(path, 0o600);
  return { path, remove: () => rmSync(directory, { recursive: true, force: true }) };
}

/** The system's way to open a file. It is given the file's path and nothing else. */
export function openerCommand(platform: NodeJS.Platform, path: string): [string, ...string[]] {
  if (platform === "darwin") return ["/usr/bin/open", path];
  if (platform === "win32") return ["rundll32.exe", "url.dll,FileProtocolHandler", path];
  return ["xdg-open", path];
}

/**
 * Asks the system to open the file. True when the opener ended well, or was
 * still running after a moment, as some are while the browser runs.
 */
export function openInBrowser(path: string, platform: NodeJS.Platform = process.platform, waitMs = 3000): Promise<boolean> {
  const [command, ...args] = openerCommand(platform, path);
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "ignore", detached: true });
    const finish = (opened: boolean) => {
      clearTimeout(timer);
      child.unref();
      resolve(opened);
    };
    const timer = setTimeout(() => finish(true), waitMs);
    child.on("error", () => finish(false));
    child.on("exit", (code) => finish(code === 0));
  });
}

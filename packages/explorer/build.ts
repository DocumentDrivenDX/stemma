// Builds the explorer page template: the host, arras, React and the styles in
// one HTML file with places for an export's data. Stemma builds it when Stemma
// is built; an author's machine only fills it in.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { PLACEHOLDERS } from "../graph/src/page.ts";

const root = join(import.meta.dir, "../..");

/** The directory of a package as `from` resolves it. */
const packageDir = (name: string, from: string): string => dirname(Bun.resolveSync(`${name}/package.json`, from));

/** The license of everything whose code or styles go into the page, by the name it is shipped under. */
export function explorerLicenses(): Record<string, string> {
  const arras = packageDir("@documentdrivendx/arras-ui", root);
  const reactDom = packageDir("react-dom", root);
  const query = packageDir("@tanstack/react-query", arras);
  const files: [string, string][] = [
    ["arras-ui.md", join(arras, "LICENSE.md")],
    ["react.txt", join(packageDir("react", root), "LICENSE")],
    ["react-dom.txt", join(reactDom, "LICENSE")],
    ["scheduler.txt", join(packageDir("scheduler", reactDom), "LICENSE")],
    ["tanstack-react-query.txt", join(query, "LICENSE")],
    ["tanstack-query-core.txt", join(packageDir("@tanstack/query-core", query), "LICENSE")],
    ["tailwindcss.txt", join(packageDir("tailwindcss", root), "LICENSE")],
    ["graphql.txt", join(import.meta.dir, "licenses/graphql-LICENSE.txt")],
  ];
  return Object.fromEntries(files.map(([name, path]) => [name, readFileSync(path, "utf8").replace(/\r\n?/g, "\n")]));
}

/** What goes inside a script element: nothing in it may end the element or start another. */
const scriptText = (text: string): string => text.replace(/<(?=\/script|script|!--)/gi, "\\x3C");

export async function bundleHost() {
  const built = await Bun.build({
    entrypoints: [join(import.meta.dir, "src/host.tsx")], target: "browser", format: "esm", minify: true,
    define: { "process.env.NODE_ENV": '"production"' }, metafile: true,
  });
  if (!built.success || built.outputs.length !== 1) throw new Error(built.logs.join("\n"));
  return { script: await built.outputs[0]!.text(), inputs: Object.keys(built.metafile!.inputs) };
}

function stemmaStyles(): string {
  const directory = mkdtempSync(join(tmpdir(), "stemma-explorer-"));
  try {
    const output = join(directory, "page.css");
    const done = Bun.spawnSync([
      process.execPath, "--no-install", "--no-env-file", "--config=/dev/null", "--bun",
      join(root, "node_modules/.bin/tailwindcss"), "--input", join(import.meta.dir, "src/page.css"), "--output", output, "--minify",
    ], { cwd: root });
    if (done.exitCode !== 0) throw new Error(done.stderr.toString());
    return readFileSync(output, "utf8");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export async function buildTemplate(): Promise<string> {
  const script = scriptText((await bundleHost()).script);
  // The browser reads CR LF as LF and a NUL as another character; either would change the script and break its hash.
  if (/[\r\0]/.test(script)) throw new Error("The explorer script holds a character the page would change.");
  const arras = readFileSync(join(packageDir("@documentdrivendx/arras-ui", root), "dist/styles.css"), "utf8");
  const layout = [
    'body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}',
    ".stemma-page{display:flex;flex-direction:column;min-height:100vh}.stemma-browser{flex:1 0 auto;display:flex;align-items:flex-start}",
    ".stemma-records{flex:1 1 0;min-width:0;align-self:stretch}",
    // The source panel scrolls by itself, so that bringing the highlight into view leaves the record where it is.
    ".stemma-source{flex:0 0 clamp(20rem,38vw,38rem);box-sizing:border-box;position:sticky;top:0;max-height:100vh;overflow:auto;background:#fff;color:#0f172a;border-left:1px solid #94a3b8;overflow-wrap:anywhere}",
    "@media (max-width:60rem){.stemma-browser{flex-direction:column;align-items:stretch}.stemma-records{flex:0 0 auto}.stemma-source{flex:0 0 auto;position:static;max-height:80vh;border-left:0;border-top:2px solid #94a3b8}}",
    ".stemma-source-text{white-space:pre-wrap;border:1px solid #cbd5e1;background:#f8fafc;padding:.5rem;margin:.25rem 0}",
    // The printed page stays in sight while its text is scrolled to the highlight.
    ".stemma-page-heading{position:sticky;top:-.75rem;background:#fff;padding:.25rem 0}",
    ".stemma-source-text mark{background:#fde68a;color:#0f172a;outline:1px solid #b45309}",
    ".stemma-control{unicode-bidi:isolate;font:600 .75em ui-monospace,monospace;border:1px solid #b91c1c;color:#991b1b;background:#fef2f2;border-radius:3px;padding:0 2px;margin:0 1px}",
    // A record's repeated values are whole lines of text. arras draws each as a badge that does not wrap.
    ".gb-tags{max-width:100%}.gb-tags .gb-badge{height:auto;white-space:normal;overflow-wrap:anywhere}",
    "dd{min-width:0;overflow-wrap:anywhere}",
  ].join("");
  const styles = `${arras}\n${stemmaStyles()}\n${layout}`.replace(/\r\n?/g, "\n");
  if (/<\/style/i.test(styles)) throw new Error("The explorer styles would end their element.");
  const hash = new Bun.CryptoHasher("sha256").update(script).digest("base64");
  // Nothing may be loaded and nothing may connect. Only the one script, known by its hash, runs.
  const policy = `default-src 'none'; script-src 'sha256-${hash}'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'`;
  const data = (id: string, mark: string) => `<script type="application/json" id="${id}">${mark}</script>`;
  const licenses = Object.entries(explorerLicenses()).map(([name, text]) => `=== ${name} ===\n${text}`).join("\n");
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${policy}">`,
    '<meta name="referrer" content="no-referrer">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<title>Stemma explorer</title>",
    `<style>${styles}</style>`,
    "</head>",
    "<body>",
    '<div id="root"></div>',
    "<noscript>This page needs JavaScript to show the graph. It sends no request.</noscript>",
    data("stemma-banner", PLACEHOLDERS.banner!),
    data("stemma-module", PLACEHOLDERS.stemma!),
    data("stemma-graph", PLACEHOLDERS.graph!),
    data("stemma-sourceviews", PLACEHOLDERS.sourceviews!),
    `<script type="module">${script}</script>`,
    `<script type="text/plain" id="stemma-licenses">${scriptText(licenses)}</script>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

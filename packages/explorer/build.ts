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

export async function bundleHost(entry: "host.tsx" | "served.tsx" = "host.tsx") {
  const built = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", entry)], target: "browser", format: "esm", minify: true,
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

/** The styles of both pages: arras's, Stemma's, and the layout. */
function pageStyles(): string {
  const arras = readFileSync(join(packageDir("@documentdrivendx/arras-ui", root), "dist/styles.css"), "utf8");
  const layout = [
    'body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}',
    ".stemma-page{display:flex;flex-direction:column;min-height:100vh}.stemma-browser{flex:1 0 auto;display:flex;align-items:flex-start}",
    ".stemma-records{flex:1 1 0;min-width:0;align-self:stretch}",
    // The source panel scrolls by itself, so that bringing the highlight into view leaves the record where it is.
    ".stemma-source{flex:0 0 clamp(20rem,38vw,38rem);box-sizing:border-box;position:sticky;top:0;max-height:100vh;overflow:auto;background:#fff;color:#0f172a;border-left:1px solid #94a3b8;overflow-wrap:anywhere}",
    "@media (max-width:60rem){.stemma-browser{flex-direction:column;align-items:stretch}.stemma-records{flex:0 0 auto}.stemma-source{flex:0 0 auto;position:static;max-height:80vh;border-left:0;border-top:2px solid #94a3b8}}",
    // The manuscript: the text, with the open source beside it, or over its lower part on a narrow screen.
    ".stemma-views{display:flex;gap:.25rem;padding:.25rem .5rem;border-bottom:1px solid #94a3b8;background:#fff}",
    ".stemma-views a{padding:.35rem .8rem;color:#0f172a;border:1px solid #64748b;border-radius:4px;text-decoration:none;font-size:.9rem}",
    ".stemma-views a[aria-current]{background:#0f172a;color:#fff}",
    ".stemma-manuscript{flex:1 0 auto;display:flex;align-items:flex-start;background:#fff;color:#0f172a}",
    ".stemma-reading{flex:1 1 0;min-width:0;max-width:46rem;margin:0 auto;padding:1rem;line-height:1.6;overflow-wrap:anywhere}",
    ".stemma-reading h1{font-size:1.6rem}.stemma-reading h2{font-size:1.25rem}.stemma-reading h3{font-size:1.05rem}",
    ".stemma-statement{border:1px solid #b45309;background:#fffbeb;padding:.5rem;font-size:.875rem;line-height:1.4}",
    ".stemma-reading a.stemma-quotation,.stemma-reading a.stemma-citation,.stemma-reading a.stemma-entry{color:inherit;text-decoration:underline;text-decoration-color:#1d4ed8;text-decoration-thickness:1px;text-underline-offset:3px}",
    ".stemma-reading a.stemma-quotation:hover,.stemma-reading a.stemma-citation:hover,.stemma-reading a.stemma-entry:hover{background:#eff6ff}",
    ".stemma-reading a[aria-current]{background:#dbeafe;outline:1px solid #1d4ed8}",
    ".stemma-broken,.stemma-reading a.stemma-quotation.stemma-broken{color:#991b1b;text-decoration-style:dashed;text-decoration-color:#991b1b}",
    ".stemma-note-ref,.stemma-back{font:inherit;color:#1d4ed8;background:none;border:0;padding:0 .2em;cursor:pointer;text-decoration:underline}",
    ".stemma-back{font-size:.8rem;padding:0}",
    ".stemma-notes{font-size:.9rem;padding-left:2.5rem}.stemma-bibliography{list-style:none;padding:0}.stemma-bibliography li{padding-left:2rem;text-indent:-2rem;margin:.5rem 0}",
    ".stemma-pane{flex:0 0 clamp(20rem,40vw,40rem);box-sizing:border-box;position:sticky;top:0;height:100vh;display:flex;flex-direction:column;background:#fff;border-left:1px solid #94a3b8}",
    ".stemma-pane-bar{padding:.4rem .75rem;border-bottom:1px solid #cbd5e1;font-size:.875rem;text-align:right}",
    ".stemma-pane .stemma-source{flex:1 1 auto;min-height:0;position:static;max-height:none;border:0}",
    ".stemma-source-text{white-space:pre-wrap;border:1px solid #cbd5e1;background:#f8fafc;padding:.5rem;margin:.25rem 0}",
    // The printed page stays in sight while its text is scrolled to the highlight.
    ".stemma-page-heading{position:sticky;top:-.75rem;background:#fff;padding:.25rem 0}",
    ".stemma-source-text mark{background:#fde68a;color:#0f172a;outline:1px solid #b45309}",
    ".stemma-control{unicode-bidi:isolate;font:600 .75em ui-monospace,monospace;border:1px solid #b91c1c;color:#991b1b;background:#fef2f2;border-radius:3px;padding:0 2px;margin:0 1px}",
    // A record's repeated values are whole lines of text. arras draws each as a badge that does not wrap.
    ".gb-tags{max-width:100%}.gb-tags .gb-badge{height:auto;white-space:normal;overflow-wrap:anywhere}",
    "dd{min-width:0;overflow-wrap:anywhere}",
    // After the rules above, which it overrides.
    "@media (max-width:60rem){.stemma-manuscript{display:block}.stemma-open .stemma-reading{padding-bottom:75vh}.stemma-pane{position:fixed;left:0;right:0;bottom:0;top:auto;height:70vh;z-index:20;border-left:0;border-top:3px solid #0f172a;box-shadow:0 -4px 16px rgba(15,23,42,.25)}.stemma-pane .stemma-source{max-height:none;border:0}}",
  ].join("");
  return `${arras}\n${stemmaStyles()}\n${layout}`.replace(/\r\n?/g, "\n");
}

/**
 * The page the local server serves (CONTRACT-005 M): its own template, with the
 * script and styles as files of their own, none inline, and no data. The server
 * sends its content security policy as a header.
 */
export async function buildServed(): Promise<{ html: string; js: string; css: string }> {
  const js = (await bundleHost("served.tsx")).script;
  const html = [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="referrer" content="no-referrer">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<title>Stemma explorer</title>",
    // No icon is asked for.
    '<link rel="icon" href="data:,">',
    '<link rel="stylesheet" href="/app.css">',
    "</head>",
    "<body>",
    '<div id="root"></div>',
    "<noscript>This page needs JavaScript.</noscript>",
    '<script type="module" src="/app.js"></script>',
    "</body>",
    "</html>",
    "",
  ].join("\n");
  return { html, js, css: pageStyles() };
}

export async function buildTemplate(): Promise<string> {
  const script = scriptText((await bundleHost()).script);
  // The browser reads CR LF as LF and a NUL as another character; either would change the script and break its hash.
  if (/[\r\0]/.test(script)) throw new Error("The explorer script holds a character the page would change.");
  const styles = pageStyles();
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
    data("stemma-manuscript", PLACEHOLDERS.manuscript!),
    `<script type="module">${script}</script>`,
    `<script type="text/plain" id="stemma-licenses">${scriptText(licenses)}</script>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

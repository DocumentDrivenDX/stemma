// The site's pages. Command output, findings, the check list, the principles and
// the contrast table are read from files, never retyped here.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CheckReport, Result } from "@stemma/core";
import { BACKGROUNDS, colorTokens, measured } from "./contrast.ts";
import { escape, excerpt } from "./html.ts";
import { FIXTURES } from "./fixtures.ts";
import { PAGES as NAV } from "./nav.ts";
import { LABEL, type screenshotPlan } from "./screens.ts";

const ROOT = join(import.meta.dir, "../..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const generated = (path: string) => read(`website/generated/${path}`);
const REPOSITORY = "https://github.com/DocumentDrivenDX/stemma";

export interface Page { file: string; nav: string; title: string; description: string; body: () => string }

const code = (text: string) => `<code>${escape(text)}</code>`;
/** Inline Markdown the principles file uses: code spans and straight quotes only. */
const inline = (text: string) => escape(text).replace(/`([^`]+)`/g, "<code>$1</code>");
const shell = (text: string) => excerpt("<strong>Commands</strong> to type in a terminal.", text);
const table = (label: string, head: string[], rows: string[][]) =>
  `<div class="table-wrap" tabindex="0" role="region" aria-label="${escape(label)}"><table><thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

interface Check {
  id: string; built: boolean; covers?: string; summary?: string; limits?: string;
  findings?: { reason: string; message: string; why: string; suggestions: string[] }[];
}
const checks = (): Check[] => JSON.parse(generated("checks.json"));
const report = (name: string): CheckReport => JSON.parse(generated(`reports/check-${name}.json`));

/** One finding from a JSON report, as a card. */
export function findingCard(r: Result): string {
  const word = r.outcome === "pass" ? "pass" : r.outcome === "fail" ? "fail" : "unverifiable";
  return `<article class="finding" aria-label="${escape(`${r.check} ${word}`)}">
<p><span class="status status-${word}">${word}</span> ${code(r.check)}${r.reason_code ? ` ${code(r.reason_code)}` : ""}</p>
<p class="message">${escape(r.message)}</p>
<dl><dt>Why it matters</dt><dd>${escape(r.why)}</dd><dt>What to do</dt>${r.suggestions.map((s) => `<dd>${escape(s)}</dd>`).join("")}</dl>
<ul class="evidence" aria-label="Evidence"><li>${escape(r.subject)}</li>${r.evidence.map((e) => `<li>${escape(e.name.replaceAll("_", " "))}: ${escape(e.value)}</li>`).join("")}</ul>
</article>`;
}

function shot(file: string): string {
  const shots: Omit<ReturnType<typeof screenshotPlan>[number], "html">[] = JSON.parse(generated("screenshots/manifest.json"));
  const found = shots.find((s) => s.file === file);
  if (!found) throw new Error(`no screenshot ${file}`);
  const png = readFileSync(join(ROOT, "website/generated/screenshots", file));
  const scale = found.width < 500 ? 2 : 1.5;
  const width = Math.round(png.readUInt32BE(16) / scale);
  const height = Math.round(png.readUInt32BE(20) / scale);
  return `<figure class="shot"><a href="screenshots/${file}"><img src="screenshots/${file}" width="${width}" height="${height}" loading="lazy" alt="${escape(found.alt)}"></a><figcaption>${escape(found.title)}. ${LABEL} Captured with Playwright from real command output. Select the image to see it full size. The same text is on the <a href="examples.html">Examples</a> page.</figcaption></figure>`;
}

function home(): string {
  return `<h1>Stemma</h1>
<p class="lead">A plugin in the making that helps scholars research, write and typeset books with AI: it checks citations with scripts, explains what it finds, and aims to trace each cited claim to a stored source.</p>
<p class="note"><strong>Pre-release.</strong> A first part of the command line works. Most of what Stemma is meant to do is not built. See <a href="status.html">what works today</a>.</p>
<p><a class="button button-primary" href="quickstart.html">Try it on macOS</a> <a class="button" href="examples.html">See real output</a></p>
<h2>The name</h2>
<p>A <em>stemma codicum</em> is the family tree of a text's manuscripts: it shows which copy derives from which. Stemma aims to give a book the same property, so that each cited claim has a line of descent to a stored source.</p>
<h2>How it is meant to work</h2>
<p>Two strands run together. This describes the design, not what is built.</p>
<ul><li><strong>Evidence strand:</strong> source records, reading notes with page-level locators, constructs, places, and a ledger tying claims to the sources that support them, kept as plain files.</li>
<li><strong>Manuscript strand:</strong> thesis, outline, chapter specifications, drafts and the assembled book.</li></ul>
<h2>What it does today</h2>
<p>It sets up a project, adds records, checks the record format, runs two bibliography checks and warns about coordinates written in project files. Each finding says what is wrong, shows the evidence, says why it matters and suggests what to do.</p>
${shot("demo-first-check.png")}
<h2>Part of a family</h2>
<p>Stemma belongs to <a href="https://documentdrivendx.github.io/">DocumentDrivenDX</a>. Its own documents are specified with <a href="https://github.com/DocumentDrivenDX/helix">HELIX</a>, which authors do not need.</p>`;
}

function principles(): string {
  const text = read("docs/stemma/01-frame/principles.md");
  const section = text.slice(text.indexOf("## Principles"), text.indexOf("## Tension Resolution"));
  const items = [...section.matchAll(/^\d+\. \*\*(.+?)\*\* — ([\s\S]+?)(?=\n\n\d+\. \*\*|\n*$(?![\s\S]))/gm)];
  if (items.length < 5) throw new Error("principles.md no longer has the expected list");
  return `<h1>Principles</h1>
<p class="lead">How Stemma decides between two reasonable options.</p>
<p class="note">These are design commitments. Several describe parts that are <a href="status.html">not built yet</a>. This page is generated from the project's principles document.</p>
<ol>${items.map((m) => `<li><strong>${inline(m[1]!)}.</strong> ${inline(m[2]!.replace(/\s+/g, " ").trim())}</li>`).join("\n")}</ol>`;
}

function quickstart(): string {
  return `<h1>Quick start on macOS</h1>
<p class="lead">Run the first slice of the command line from a checkout.</p>
<p class="note">Set up and tried only on macOS on Apple silicon. Intel Macs, Windows and Linux are untested, and the setup script stops on them. Installing the plugin from a marketplace for everyday use is not ready.</p>
<h2>You need</h2>
<ul><li>git, and the curl and openssl commands that macOS includes.</li><li>A network connection on the first run, to fetch the pinned Bun and the development packages from the npm registry.</li></ul>
<h2>Run the demo</h2>
<p>The script checks the Bun download against a pinned hash and keeps what it fetches inside the checkout. It installs nothing system-wide. All names and sources in the demo are invented. These steps need a checkout that holds this slice; if the repository's default branch does not hold it yet, a fresh clone will not have it.</p>
${shell(`git clone ${REPOSITORY}.git
cd stemma
./scripts/dev.sh demo     # a guided run in a fresh temporary directory
./scripts/dev.sh check    # type check and tests`)}
<h2>Run your own command</h2>
<p>Build first. The project path must be absolute.</p>
${shell(`./scripts/dev.sh build
root="$PWD/dist/release"
(cd "$root" && "$OLDPWD/.tools/bun" --no-install --no-env-file --config=/dev/null \\
  "$root/dist/stemma.js" check --project /absolute/path/to/project)`)}
<p>Keep all three flags: without them Bun can download packages, or load a <code>bunfig.toml</code> or <code>.env</code> from the working directory. To start a project, replace <code>check</code> with <code>init</code>.</p>
<h2>Commands</h2>
${excerpt("<strong>Generated</strong> from <code>stemma --help</code>.", generated("transcripts/help.txt"))}
<p>Where this page writes <code>stemma</code>, it means that long invocation. No <code>stemma</code> command is installed on your path.</p>`;
}

function status(): string {
  const built = checks().filter((c) => c.built);
  const unbuilt = checks().filter((c) => !c.built);
  return `<h1>What works today</h1>
<p class="lead">Built and planned are kept apart. Anything not in the first list does not work yet.</p>
<h2>Works today (command line only)</h2>
<ul>
<li><code>init</code> creates a project; <code>record add</code> adds a record from a JSON file.</li>
<li><code>validate</code>, <code>fmt</code> and <code>rules check</code> check and tidy record files and standing rules.</li>
<li><code>check</code> runs ${built.length} checks (${built.map((c) => code(c.id)).join(", ")}), each <a href="checks.html">with stated limits</a>, and writes a text or JSON report.</li>
<li><code>version</code> and <code>doctor</code> say what is running.</li>
</ul>
<p><code>check</code> keeps no change baseline yet, so it always checks the whole project. A project is not called checked clean while it holds something this version cannot check.</p>
<p>Tried only on macOS on Apple silicon. No desktop app host and no release has been tested.</p>
<h2>Planned, not built</h2>
<ul>
<li>Taking over a Word manuscript and its reference libraries; reading manuscript files at all.</li>
<li>Storing copies of sources, extracting their text, and checking quotations and locators against them.</li>
<li>Reading notes, a claim ledger, model support verdicts, review marks and annotations.</li>
<li>A browser explorer for the evidence graph, argument and geographic maps and typeset pages. There is no web interface to Stemma today: this site is documentation.</li>
<li>Typesetting with Typst, with Chicago notes and bibliography first.</li>
<li>Voice and style profiles.</li>
<li>Delivery of the command line through a plugin marketplace, in Claude desktop on macOS and Windows first, and in ChatGPT and Codex later.</li>
<li>${unbuilt.length} further <a href="checks.html#not-built">checks that are named but not built</a>.</li>
</ul>`;
}

function checksPage(): string {
  const all = checks();
  const seeded = report("seeded").body.results;
  const built = all.filter((c) => c.built).map((c) => {
    const example = seeded.find((r) => r.check === c.id && r.open);
    return `<h3 id="${c.id.replace(".", "-")}">${code(c.id)}</h3>
<p>${escape(c.summary!)}</p><p><strong>Limits:</strong> ${escape(c.limits!)}</p>
${example ? `<p>An example from the <a href="examples.html#fixtures">seeded test fixture</a>. The card is this site's drawing of one entry in the JSON report; Stemma has no report viewer.</p>${findingCard(example)}` : ""}
${table(`Findings of ${c.id}`, ["Reason code", "What is wrong", "Why it matters", "What to do"], c.findings!.map((f) => [code(f.reason), escape(f.message), escape(f.why), f.suggestions.map(escape).join(" ")]))}`;
  });
  return `<h1>Checks reference</h1>
<p class="lead">What each check looks at, what it cannot show, and every finding it can report.</p>
<p class="note">This page is generated from the command line's own explanation texts and from a test run. Outcomes are <code>pass</code>, <code>fail</code> and <code>unverifiable</code> (could not check). No finding blocks anything. A <code>pass</code> covers only what the check says it reads.</p>
<h2 id="built">Built</h2>
${built.join("\n")}
<h2 id="not-built">Named, not built</h2>
<p>These do not run. When a project holds something one of them would check, the report lists it under NOT CHECKED, and the project is not called checked clean. The wording below is the report's own, and says what each would tell you.</p>
${table("Checks that are not built", ["Check", "Would tell you about", "State"], all.filter((c) => !c.built).map((c) => [code(c.id), escape(c.covers!), '<span class="status status-none">not built</span>']))}`;
}

/** The demo transcript, one excerpt for each of its numbered steps. */
function demoSteps(): string {
  const [, ...parts] = generated("transcripts/demo.txt").split(/^=============== /m);
  return parts.map((part) => {
    const [title, ...lines] = part.split("\n");
    return `<h3>${escape(title!)}</h3>${excerpt("<strong>Transcript</strong> of a real run, temporary paths replaced.", lines.join("\n").trim())}`;
  }).join("\n");
}

function examples(): string {
  const fixtures = Object.entries(FIXTURES);
  return `<h1>Examples</h1>
<p class="lead">Real output, regenerated by one command from the demo and from the projects the tests assert on.</p>
<p class="note">All names and sources here are invented. <code>$DEMO</code>, <code>$PROJECTS</code> and <code>&lt;plugin root&gt;</code> replace paths from the machine that ran the commands. Record IDs in the demo are fixed so that runs match; normally they are random.</p>
<h2>Screenshots</h2>
${["check-findings-light.png", "check-findings-dark.png", "check-clean.png", "check-findings-phone.png"].map(shot).join("\n")}
<h2 id="demo">The demo, step by step</h2>
${demoSteps()}
<h2 id="fixtures">Test fixtures</h2>
<p>Each has a text report below and the matching <a href="reports/check-seeded.json">JSON report</a>. In the JSON files, the run time, platform and SQLite version are removed.</p>
${fixtures.map(([name, about]) => `<h3>${name}</h3><p>${escape(about)} <a href="reports/check-${name}.json">JSON report for ${name}</a>.</p>${excerpt("<strong>Transcript</strong> of a real run, temporary paths replaced.", generated(`transcripts/check-${name}.txt`))}`).join("\n")}`;
}

function darwin(): string {
  return `<h1>Worked example: Darwin and coral reefs</h1>
<p class="lead">A planned end-to-end example on a real historical subject.</p>
<p class="note"><strong>In progress. Nothing of this example has been built or checked yet.</strong> It has no Stemma project, records, claims, quotations, maps or typeset pages. This page makes no statement about what any of these works argue.</p>
<h2>Where it stands</h2>
<p>Copies of candidate sources are kept on the maintainer's machine, outside the repository. The works below are those whose title or opening pages have been read so far, in the text layer of the stored copy. That text comes from character recognition and has not been compared with page images. These are not Stemma source records.</p>
${table("Works read so far", ["Title", "Name given", "What the stored text shows"], [
    ["<cite>The Structure and Distribution of Coral Reefs</cite>", "Charles Darwin", "London: Smith, Elder and Co. The preface is dated May 1842."],
    ["<cite>The Structure and Distribution of Coral Reefs</cite>, third edition", "Charles Darwin, with an appendix by T. G. Bonney", "London: Smith, Elder, &amp; Co., 1889."],
    ["<cite>The Life and Letters of Charles Darwin</cite>, volume III", "Edited by Francis Darwin", "London: John Murray, 1887."],
    ["<cite>The Glacial-Control Theory of Coral Reefs</cite>", "Reginald A. Daly", "Proceedings of the American Academy of Arts and Sciences, volume 51, number 4, November 1915."],
  ])}
<h2>What has to happen first</h2>
<ul><li>Stemma has to store a copy of a source and extract its text. Neither is built.</li><li>Quotation and locator checks have to be built before this page quotes anything.</li><li>Publication rights have to be confirmed for each copy before it enters the repository.</li></ul>
<p>Until then, the <a href="examples.html">invented examples</a> show what works.</p>`;
}

function design(): string {
  const tokens = colorTokens();
  const light = measured("light");
  const dark = measured("dark");
  const short = (name: string) => name.replace(/^--(arras|stm)-color-/, "");
  const seeded = report("seeded").body.results;
  const unverifiable = seeded.find((r) => r.outcome === "unverifiable")!;
  return `<h1>Design language</h1>
<p class="lead">How Stemma looks and speaks: like a careful report.</p>
<p class="note">This summarizes the interface design system in the repository, <code>docs/stemma/02-design/DESIGN.md</code>. This site uses it. The chat and explorer interfaces it describes are not built.</p>
<h2>Identity</h2>
<p><img src="mark.svg" alt="The Stemma mark: a small family tree with one root and three descendants" width="96" height="96"></p>
<p>The mark is a small <em>stemma codicum</em>: one filled node for the earliest witness, and lines of descent to three open ones, one of them through an intermediate branch. It depicts no real manuscript tradition. Write the name <strong>Stemma</strong>, and <code>stemma</code> for the command. Keep clear space of a quarter of the mark's width around it, and do not use it below 16 pixels.</p>
<h2>Voice</h2>
<p>Tools and reports, not gates and approvals. Say what is wrong, show the evidence, say why it matters, suggest what to do.</p>
${table("Voice", ["Write", "Not"], [
    ["Nothing is blocked.", "You must fix this before continuing."],
    ["could not be checked", "probably fine"],
    ["The checks found nothing open. This does not mean that the book is correct.", "Verified. All good!"],
    ["planned, not built", "coming soon"],
  ])}
<h2>Color</h2>
<p>Surfaces, text and the accent are the default role tokens of <a href="https://github.com/DocumentDrivenDX/arras">arras</a>; Stemma sets no brand color. It adds a strong line and three status colors. Light and dark follow the system setting, or <code>data-appearance</code> on the page. Status colors only repeat a word.</p>
${table("Color tokens", ["Token", "Light", "Dark", "Current"], tokens.map((t) => [code(t.name), code(t.light), code(t.dark), `<span class="swatch" style="background: var(${t.name})">&#8195;&#8195;</span>`]))}
<h2 id="contrast">Contrast</h2>
<p>Computed with the WCAG 2.2 formula from the stylesheet's values. A browser test then reads the rendered colors of the samples below in light and dark and compares them with these numbers.</p>
${table("Contrast ratios", ["Foreground on background", "Needs", "Light", "Dark", "Sample"], light.map((p, i) => [`${short(p.fg)} on ${short(p.bg)}`, `${p.floor}:1`, `${p.ratio.toFixed(2)}:1`, `${dark[i]!.ratio.toFixed(2)}:1`,
    p.floor === 3
      ? `<span class="swatch" data-pair="${i}" style="color: var(${p.fg}); border: 2px solid var(${p.fg}); background: var(${p.bg})">&#8195;&#8195;</span>`
      : `<span class="swatch" data-pair="${i}" style="color: var(${p.fg}); background: var(${p.bg})">Aa 123</span>`]))}
<p>The arras border color is under 3:1 on all ${BACKGROUNDS.length} backgrounds, so it is for decorative dividers only. It never marks a control or carries meaning.</p>
<h2>Type</h2>
<p>Three families under the SIL Open Font License, served from this site: Source Serif 4 for headings, Inter for text, JetBrains Mono for command output and identifiers. Their licence texts are published beside the font files: <a href="fonts/LICENSE-source-serif-4.txt">Source Serif 4</a>, <a href="fonts/LICENSE-inter.txt">Inter</a>, <a href="fonts/LICENSE-jetbrains-mono.txt">JetBrains Mono</a>. Only Latin and extended Latin are bundled; other scripts fall back to system fonts and are untested.</p>
<p class="font-serif text-2xl">A line of descent to a stored source</p>
<p class="font-sans">A citation rests on a source record and a stored copy.</p>
<p class="font-mono text-sm">src-demo0harbour01 &nbsp; cite.key &nbsp; 0O 1lI</p>
<h2>Spacing and shape</h2>
<p>Spacing steps of 4, 8, 12 and 16 pixels; 6-pixel control corners and 10-pixel card corners. Borders that carry meaning use the strong line. No shadows and no animation.</p>
<h2>Components</h2>
<h3>Status label</h3>
<p>The script's own word in a bordered label. Never a check mark.</p>
<p><span class="status status-pass">pass</span> <span class="status status-fail">fail</span> <span class="status status-unverifiable">unverifiable</span> <span class="status status-none">not built</span></p>
<h3>Report excerpt</h3>
<p>Real command output in a monospace block. Its caption says what it is and what was replaced. Long lines wrap.</p>
${excerpt("<strong>Transcript</strong> of a real run.", generated("transcripts/check-clean.txt"))}
<h3>Finding</h3>
<p>Fixed order: outcome and check, what is wrong, why it matters, what to do, evidence. The example is filled from a real JSON report.</p>
${findingCard(unverifiable)}
<h3>Figure</h3>
<p>A screenshot or drawing has alternative text, a caption that says how it was made, and the same content available as text. A rendered page is never presented as a terminal window or as a Stemma screen.</p>
${shot("check-clean.png")}
<h2>Navigation and accessibility</h2>
<p>The target is WCAG 2.2 level AA. A skip link comes first, each page has one first-level heading, the current page is marked with <code>aria-current</code> by weight and an underline, focus shows a 2-pixel ring, and wide tables and long excerpts can be reached by keyboard. On narrow screens the navigation wraps; the site needs no JavaScript.</p>
<p>Automated checks run axe-core on every page in light and dark. A clean run does not show conformance. Screen readers, zoom at 200% by hand, Safari and Firefox are untested.</p>`;
}

const BODIES: Record<(typeof NAV)[number]["file"], () => string> = {
  "index.html": home, "principles.html": principles, "quickstart.html": quickstart, "status.html": status,
  "checks.html": checksPage, "examples.html": examples, "darwin.html": darwin, "design.html": design,
};

export const PAGES: Page[] = NAV.map((p) => ({ ...p, body: BODIES[p.file] }));

export function render(page: Page): string {
  const nav = PAGES.map((p) => `<li><a href="${p.file}"${p === page ? ' aria-current="page"' : ""}>${p.nav}</a></li>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; base-uri 'none'; form-action 'none'">
<meta name="description" content="${escape(page.description)}">
<title>${escape(page.title === "Stemma" ? "Stemma" : `${page.title} | Stemma`)}</title>
<link rel="icon" href="mark.svg" type="image/svg+xml">
<link rel="stylesheet" href="site.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="border-b border-line bg-surface">
<div class="mx-auto max-w-4xl px-4 py-3">
<a class="inline-flex items-center gap-2 font-serif text-xl font-semibold text-ink no-underline" href="index.html"><img src="mark.svg" alt="" width="28" height="28">Stemma</a>
<nav aria-label="Main"><ul class="nav mt-2 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-sm">${nav}</ul></nav>
</div>
</header>
<main id="main" tabindex="-1" class="prose mx-auto max-w-4xl px-4 py-8">
${page.body()}
</main>
<footer class="border-t border-line">
<div class="mx-auto max-w-4xl px-4 py-5 text-sm text-muted">Stemma is pre-release, MIT licensed, and part of <a href="https://documentdrivendx.github.io/">DocumentDrivenDX</a>. <a href="${REPOSITORY}">Source on GitHub</a>.</div>
</footer>
</body>
</html>
`;
}

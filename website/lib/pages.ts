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
const table = (label: string, head: string[], rows: string[][]) =>
  `<div class="table-wrap" tabindex="0" role="region" aria-label="${escape(label)}"><table><thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

interface Check {
  id: string; summary: string; limits: string;
  findings: { reason: string; message: string; why: string; suggestions: string[] }[];
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
<p class="lead">A Claude plugin that helps scholars write books with checked citations. Ask Claude in plain words; scripts check your project against your own stored copies and explain what they find.</p>
<p class="note"><strong>Pre-release.</strong></p>
<p><a class="button button-primary" href="install.html">Install and ask Claude</a> <a class="button" href="examples.html">See real output</a></p>
<h2>The name</h2>
<p>A <em>stemma codicum</em> is the family tree of a text's manuscripts: it shows which copy derives from which. Stemma gives a book's citations a line of descent to a stored source.</p>
<h2>What it does</h2>
<ul><li>Keeps sources and citations as plain record files in your project.</li>
<li>Keeps copies of your sources and their text in a private store outside the project, with where and when each came from.</li>
<li>Checks that each cited source is held with text that still matches, that citation keys resolve, that listed bibliography entries are cited, and that record files are well formed. It warns about coordinates written in project files.</li>
<li>Explains every finding: what is wrong, the evidence, why it matters and what to do. Nothing is blocked.</li></ul>
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
<p class="note">These are the rules Stemma is designed by, not a list of its features. For what it does, with real output, see <a href="checks.html">Checks</a> and <a href="examples.html">Examples</a>. This page is generated from the project's principles document.</p>
<ol>${items.map((m) => `<li><strong>${inline(m[1]!)}.</strong> ${inline(m[2]!.replace(/\s+/g, " ").trim())}</li>`).join("\n")}</ol>`;
}

/** What a person might say, and what Stemma then does. Each maps to a command the demo or tests run. */
const ASKS: [string, string][] = [
  ["Start a Stemma project in this folder.", "Creates the project files and overwrites nothing."],
  ["Add a source record for this book, taking the details from its title page.", "Writes a record of the work. Claude says where each detail came from."],
  ["Keep this PDF as my copy of that source. I downloaded it from the library today.", "Stores the file in a private store outside the project, with its digest, origin and the time you got it."],
  ["Attach the text of that copy, with its page breaks.", "Saves a plain-text file, or a text layer for a PDF or scan, page by page. A page gets a printed number only from stated evidence."],
  ["Record the citations in this chapter.", "Writes one record for each citation, with its sentence and page."],
  ["Check the project and explain what is open.", "Runs the checks and explains each finding in plain language."],
  ["Is anything missing from my source store?", "Names every stored file that is missing or has changed."],
];

function install(): string {
  return `<h1>Install and ask Claude</h1>
<p class="lead">Installing the plugin is the only installation there is. The plugin and Claude set up everything else themselves.</p>
<p class="note">Stemma is not published to a marketplace, so this page gives no install command. Installation through the plugin's marketplace entry has been tried with the Claude command-line tool on one Mac, using a local stand-in for the distribution repository. The Claude desktop app, Windows and Linux are untested.</p>
<h2>What happens on first use</h2>
<p>Claude fetches a pinned copy of the Bun runtime from the npm registry, checks it against a digest shipped in the plugin, and keeps it in the plugin's own data directory. It changes no system or shell setting, and Claude's usual permission prompts apply. If setup fails or you decline it, Claude says that nothing was checked, and your writing carries on.</p>
<h2>What to ask Claude</h2>
${table("Requests", ["You ask", "Stemma does"], ASKS.map(([ask, does]) => [`&ldquo;${escape(ask)}&rdquo;`, escape(does)]))}
<p class="note">The commands behind these requests are tested. A live Claude session following the plugin's skill has not been tested.</p>
<h2>Your copies stay yours</h2>
<p>Copies of sources and their text go to a private store outside your project, never into it. Backing that store up is your job. Stemma is for material that may be sent to a language model: it holds back no individual source.</p>`;
}

function checksPage(): string {
  const all = checks();
  const seeded = report("seeded").body.results;
  const built = all.map((c) => {
    const example = seeded.find((r) => r.check === c.id && r.open);
    return `<h3 id="${c.id.replace(".", "-")}">${code(c.id)}</h3>
<p>${escape(c.summary)}</p><p><strong>Limits:</strong> ${escape(c.limits)}</p>
${example ? `<p>An example from the <a href="examples.html#fixtures">seeded test fixture</a>. The card is this site's drawing of one entry in the JSON report; It is not a Stemma screen.</p>${findingCard(example)}` : ""}
${table(`Findings of ${c.id}`, ["Reason code", "What is wrong", "Why it matters", "What to do"], c.findings.map((f) => [code(f.reason), escape(f.message), escape(f.why), f.suggestions.map(escape).join(" ")]))}`;
  });
  return `<h1>Checks reference</h1>
<p class="lead">What each check looks at, what a pass does not show, and every finding it can report.</p>
<p class="note">This page is generated from the command line's own explanation texts and from a test run. Outcomes are <code>pass</code>, <code>fail</code> and <code>unverifiable</code> (could not check). No finding blocks anything. A <code>pass</code> covers only what the check says it reads. When a project holds something no check here covers, its report says so, and the project is not called checked clean.</p>
<h2 id="checks">The checks</h2>
${built.join("\n")}`;
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
  const source = JSON.parse(read("examples/coral-reefs/records/sources/src-darwinreefs1842.json"));
  const citations = [1, 2, 3].map((n) => JSON.parse(read(`examples/coral-reefs/records/citations/cit-darwinreefs000${n}.json`)));
  return `<h1>Worked example: Darwin and coral reefs</h1>
<p class="lead">One real source and three citations of it, kept as record files in the repository.</p>
<p class="note">The copy of the book and its text are private and are not published. Only records and digests are. A model read the facts below from images of the stored pages; no person has confirmed them.</p>
<h2>The source</h2>
<p><cite>${escape(source.title.value)}</cite>. Charles Darwin. London: Smith, Elder and Co., ${escape(source.issued.edtf)}.</p>
<p>The title and year were read from the image of the title page. The text layer of the same page, from unverified character recognition, gives one of the voyage's years wrongly and does not hold the year of publication.</p>
<h2>What cites it</h2>
<p>These sentences are paraphrases written for the example, each compared with the image of the cited page. They quote nothing.</p>
${table("Citations", ["Page", "Sentence"], citations.map((c) => [escape(c.locator.value), escape(c.sentence.text)]))}
<h2>What a check says without the private copy</h2>
<p>Where the stored copy is not present, Stemma cannot check these citations, and says so. With it, all three citations passed <code>source.held</code> on the maintainer's machine on 2026-11-26; that run depends on the private store and is not reproduced here. Even then the project is not called checked clean: its report lists checks of cited sources that were not run.</p>
${excerpt("<strong>Transcript</strong> of a real run with an empty store, paths replaced.", generated("transcripts/example-coral-reefs.txt"))}`;
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
<p class="note">This summarizes how this site looks and speaks, from the design system in the repository, <code>docs/stemma/02-design/DESIGN.md</code>.</p>
<h2>Identity</h2>
<p><img src="mark.svg" alt="The Stemma mark: a small family tree with one root and three descendants" width="96" height="96"></p>
<p>The mark is a small <em>stemma codicum</em>: one filled node for the earliest witness, and lines of descent to three open ones, one of them through an intermediate branch. It depicts no real manuscript tradition. Write the name <strong>Stemma</strong>, and <code>stemma</code> for the command. Keep clear space of a quarter of the mark's width around it, and do not use it below 16 pixels.</p>
<h2>Voice</h2>
<p>Tools and reports, not gates and approvals. Say what is wrong, show the evidence, say why it matters, suggest what to do.</p>
${table("Voice", ["Write", "Not"], [
    ["Nothing is blocked.", "You must fix this before continuing."],
    ["could not be checked", "probably fine"],
    ["The checks found nothing open. This does not mean that the book is correct.", "Verified. All good!"],
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
<p><span class="status status-pass">pass</span> <span class="status status-fail">fail</span> <span class="status status-unverifiable">unverifiable</span></p>
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
  "index.html": home, "principles.html": principles, "install.html": install,
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

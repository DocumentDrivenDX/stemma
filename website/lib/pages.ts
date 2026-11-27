// The site's pages. Command output, findings, the check list, the principles and
// the contrast table are read from files, never retyped here.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CheckReport, Result } from "@stemma/core";
import { BACKGROUNDS, colorTokens, measured } from "./contrast.ts";
import { descent } from "./descent.ts";
import { darwinBook, records } from "./example.ts";
import { cycle, pageMap, places, rounds } from "./diagrams.ts";
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
const table = (label: string, head: string[], rows: string[][]) =>
  `<div class="table-wrap" tabindex="0" role="region" aria-label="${escape(label)}"><table><thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

/** A section whose heading sits in the margin on wide screens. `body` and `aside` are trusted HTML. */
const band = (title: string, body: string, { id = "", aside = "" } = {}) =>
  `<section class="band"><div class="band-head"><h2${id ? ` id="${id}"` : ""}>${title}</h2>${aside}</div><div class="band-body">\n${body}\n</div></section>`;
/** The title block that opens a page. */
const opening = (title: string, lead: string, rest = "") => `<div class="opening"><h1>${title}</h1>\n<p class="lead">${lead}</p>\n${rest}</div>`;
/** Links to places on the same page. */
const contents = (label: string, links: [string, string][]) =>
  `<nav class="contents" aria-label="${escape(label)}"><ul>${links.map(([href, text]) => `<li><a href="#${href}">${text}</a></li>`).join("")}</ul></nav>`;

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
<p class="finding-id"><span class="status status-${word}">${word}</span> ${code(r.check)}${r.reason_code ? ` ${code(r.reason_code)}` : ""}</p>
<p class="message">${escape(r.message)}</p>
<dl><div><dt>Why it matters</dt><dd>${escape(r.why)}</dd></div><div><dt>What to do</dt>${r.suggestions.map((s) => `<dd>${escape(s)}</dd>`).join("")}</div></dl>
<ul class="evidence" aria-label="Evidence"><li>${escape(r.subject)}</li>${r.evidence.map((e) => `<li>${escape(e.name.replaceAll("_", " "))}: ${escape(e.value)}</li>`).join("")}</ul>
</article>`;
}

/** Detail that is there for whoever wants it. `body` is trusted HTML. */
const more = (summary: string, body: string) => `<details class="more"><summary>${summary}</summary>\n${body}\n</details>`;
const transcript = (text: string, caption = "<strong>Transcript</strong> of a real run, with folder names replaced.") => excerpt(caption, text);

function shot(file: string): string {
  const shots: Omit<ReturnType<typeof screenshotPlan>[number], "html">[] = JSON.parse(generated("screenshots/manifest.json"));
  const found = shots.find((s) => s.file === file);
  if (!found) throw new Error(`no screenshot ${file}`);
  const png = readFileSync(join(ROOT, "website/generated/screenshots", file));
  const scale = found.width < 500 ? 2 : 1.5;
  const width = Math.round(png.readUInt32BE(16) / scale);
  const height = Math.round(png.readUInt32BE(20) / scale);
  return `<figure class="shot"><a href="screenshots/${file}"><img src="screenshots/${file}" width="${width}" height="${height}" loading="lazy" alt="${escape(found.alt)}"></a><figcaption>${escape(found.title)}. ${LABEL} The picture is made from the real output of a run. Select it to see it full size. The same words are on the <a href="examples.html">Examples</a> page.</figcaption></figure>`;
}

/** One numbered finding from the demo transcript, from its first line to the next blank one. */
function demoFinding(heading: string): string {
  const text = generated("transcripts/demo.txt");
  const start = text.indexOf(heading);
  const end = text.indexOf("\n\n", start);
  if (start < 0 || end < 0) throw new Error(`the demo no longer holds "${heading}"`);
  return text.slice(start, end);
}

const CHECKED: [string, string][] = [
  ["Your sources", "Is each work you cite in your project, with its text complete and unchanged? If you replace one, you see what relied on the old one."],
  ["Your quotations", "Are the words in your source's text, on the page you cite? If something close is there instead, you see both side by side."],
  ["Your page numbers", "Is each page you cite actually in the work, and do its printed page numbers run on sensibly?"],
  ["Your source details", "Do authors, titles and dates agree with the title page and with saved library catalogue records? Where they differ, you see both."],
  ["Your references", "Does each citation point to one source? Is each work you list actually cited? Is a figure you attribute to a source in its text? Are the project files in order? You are also warned about map coordinates written into them."],
];

const entries = (list: [string, string][]) =>
  `<dl class="entries">${list.map(([term, text]) => `<div><dt>${term}</dt><dd>${text}</dd></div>`).join("")}</dl>`;

function home(): string {
  return `<div class="opening opening-home"><h1>Create academically rigorous research reports and books</h1>
<p class="lead">Research and write with Claude. The Stemma plugin keeps your sources in your project, checks your citations and quotations against them, and explains what it finds in plain language.</p>
<p class="actions"><a class="button button-primary" href="install.html">Get started</a> <a class="button" href="how.html">See how it works</a> <span class="stage">Pre-release</span></p></div>
${band("Why rigor takes more", `<p class="statement">An AI assistant can produce a reference that does not exist, give a real title the wrong author, cite a page the work does not have, or invent a quotation.</p>
<p>Checking all of that by hand can cost the time the assistant saved. With Stemma, the comparing that a computer can do reliably is done for you, against your own sources. The report also tells you what it could not check, so you know where to look yourself.</p>`)}
<section class="spread" aria-labelledby="cycle">
<h2 id="cycle">Research in rounds</h2>
<p>Research is rarely finished in one pass. You find another source, get a better scan, or rewrite a sentence. Stemma fits that loop.</p>
${cycle()}
<p><a href="how.html">How a round works, step by step</a></p>
</section>
<section class="spread" aria-labelledby="descent">
<h2 id="descent">Every citation has a family tree</h2>
<p>Scholars draw a <em>stemma codicum</em> to show which copy of a manuscript comes from which. Stemma does something similar for your work: each citation leads back to the words and page it came from, to the text of the source in your project, and to the original that text was made from.</p>
${descent()}
</section>
${band("What gets checked", `${entries(CHECKED)}
<p><a href="checks.html">Each check, and what passing it does not tell you</a></p>`)}
${band("When a quotation differs", `<p>In our made-up demo book, one typed citation quotes <q>All fields were abandoned by their holders.</q> The source's text begins with a different word. Stemma shows you both, so you can look at the page and decide.</p>
${transcript(demoFinding("3. PROBLEM: A quotation"), "<strong>Transcript</strong> of a real run of the demo: one finding of three, exactly as the tool printed it. All names and sources are invented. When you use Stemma, Claude explains findings like this to you.")}
<p><a href="examples.html#demo">The whole demo, step by step</a></p>`)}
${band("What stays yours", `<p>Judgment stays with you. A pass only means that your record agrees with the text made from your source, and that text can be wrong, especially when a computer read it from a scan. No check tells you that a source supports your argument.</p>
<p>Stemma does not compare text with pictures of pages, and it cannot read a scan itself. It checks the citations in manuscript files written in Stemma's marked-up Markdown, or else the citations that have been recorded; it does not check a Word file. Nothing ever stops you from writing.</p>`)}
${band("Part of a family", `<p>Stemma belongs to <a href="https://documentdrivendx.github.io/">DocumentDrivenDX</a>. The project plans its own work with <a href="https://github.com/DocumentDrivenDX/helix">HELIX</a>; you do not need it.</p>`)}`;
}

/** One round of research in detail, and the words the site uses. */
const ROUND: { title: string; you: string; happens: string[] }[] = [
  { title: "Start a project", you: "Start a Stemma project in this folder.", happens: [
    "Claude creates a few project files and overwrites nothing.",
    "One of them, <code>rules.md</code>, holds your standing rules, such as how to spell a place name. Claude is instructed to read it at the start of each session."] },
  { title: "Gather your sources", you: "Add a source record for this book, taking the details from its title page.", happens: [
    "Claude writes a record of the work and tells you where each detail came from. It is instructed never to invent one."] },
  { title: "Capture your sources", you: "Capture this PDF as my copy of that source. I downloaded it from the library today.", happens: [
    "Stemma turns it into text files in your project, one for each page, with where and when you got it. A digital fingerprint ties them to the exact original, which is not added to the project.",
    "It reads the text a PDF already contains, and reads EPUB, web pages, Word documents, Markdown, Project Gutenberg and plain text files. It cannot read words from a picture of a page: you supply that text, made by a recognition tool or typed.",
    "Anyone who can read your project can read these files, so publishing it publishes them. You can note that material is unpublished, restricted by a community, or under a particular license. These notes inform you; they stop nothing."] },
  { title: "Check the text and page numbers", you: "Compare the text with the original and look at the page numbers.", happens: [
    "Stemma proposes page numbers only where the numbers printed on the pages support them. A book with no pages is cited by chapter or paragraph.",
    "It can convert the original again to show that the text still matches. For text a computer recognized, you can compare it with another reading and note what you looked at. None of that is required."] },
  { title: "Write, and cite", you: "Find where that book discusses atolls, and cite the passage I choose.", happens: [
    "When you choose a passage, a script copies its words and page, so nobody retypes them.",
    "A citation you already have is recorded exactly as you wrote it, with its sentence, source, page and any quotation.",
    "You can ask to see a few pages while you write. They are marked as text quoted from the source, which may contain errors."] },
  { title: "Check", you: "Check the project and explain what is open.", happens: [
    "The whole project is checked. Claude explains what is wrong, shows the evidence, says why it matters and suggests what to do.",
    "A check that cannot be done is reported as <em>could not check</em>. It never counts as a pass.",
    "What nothing shows or contradicts, such as a source not compared with any catalogue, is listed as coverage. It is not a problem and asks nothing of you."] },
  { title: "Decide, and go round again", you: "I have a better scan of this book. Replace the old one.", happens: [
    "You choose what to fix. When a source is replaced, you see what relied on the old one. This version cannot note that you have looked again, so those items stay listed.",
    "Ask <q>Are any of my source files missing or changed?</q> to find files that have gone missing or been edited."] },
];

const BACK: [string, string][] = [
  ["A cited source is not in the project, or its files are damaged", "Capture the source, or repair its files"],
  ["A quotation differs from your source, or is on another page", "Look at the page, then correct your record or your sentence"],
  ["A cited page is not in the work", "Check the citation, then the page numbering"],
  ["A source's details differ from its title page or a catalogue", "Compare with the work itself; a catalogue can be wrong"],
  ["A citation does not point to one source", "Correct the citation or the source record"],
  ["Something relied on a source you replaced", "Compare it with the new one"],
];

const WORDS: [string, string][] = [
  ["Record", "A small plain file about one thing: a source, where its original came from, a passage or a citation."],
  ["Original", "The file the text was made from, such as a PDF. It is not added to the project."],
  ["Source files", "The text of a work, kept in your project: one file for each page, or for each section where there are no pages."],
  ["Passage", "A piece of a source chosen by its place. A script copies its words and page."],
  ["Page label", "The number printed on a page, where it could be established."],
  ["Finding", "One thing a check reports, with its evidence and a suggestion."],
  ["Could not check", "Something needed was missing, so there is no answer yet."],
  ["Coverage", "What a report covered by other means, or did not cover, and what it saw in an original. It is not a list of things to do."],
  ["Checked clean", "The checks found nothing open. It does not mean the book is correct."],
  ["Unreviewed, not admitted", "A report counts cited items that nobody has reviewed, and sources you have not accepted into your project. The count is information, not a finding."],
];

function how(): string {
  return `${opening("How it works", "You ask in plain words. Claude does the clerical work, scripts do the comparing, and you make the decisions.")}
<section class="spread" aria-labelledby="loop">
<h2 id="loop">The research cycle</h2>
${cycle()}
</section>
${band("One round, step by step", `<ol class="steps">${ROUND.map((r) => `<li><h3>${r.title}</h3><div><p class="ask"><span>You might say</span> &ldquo;${escape(r.you)}&rdquo;</p>${r.happens.map((h) => `<p>${h}</p>`).join("")}</div></li>`).join("")}</ol>`)}
<section class="spread" aria-labelledby="rounds">
<h2 id="rounds">What going round looks like</h2>
<p>In the demo, one project is checked four times. The numbers fall as things are fixed, added and looked at.</p>
${rounds()}
</section>
${band("Where a finding sends you", table("Where a finding sends you", ["When a check reports", "Go back to"], BACK.map(([a, b]) => [a, b])))}
<section class="spread" aria-labelledby="places">
<h2 id="places">Where your material lives</h2>
${places()}
</section>
${band("Words used here", entries(WORDS))}`;
}

/** Each principle in everyday words, keyed by its name in the principles file. */
const PLAIN: Record<string, string> = {
  "Tools and reports, not gates and approvals": "Stemma points things out and explains them. It never stops you writing, or asks you to approve something before you can carry on.",
  "No source, no citation": "A citation should rest on a source you hold. The assistant is told never to invent one, and a citation with no source to compare it with is shown as unchecked.",
  "Scripts verify, models propose": "Checks are done by ordinary programs that give the same answer every time. An AI's opinion is never counted as a check.",
  "The author decides": "Interpretation, structure, theory, method and what you disclose are your calls. The assistant helps; it does not settle them.",
  "Limits are stated": "A clean result means only that the checks found nothing open. Notes and sign-offs are records of what someone said, not proof.",
  "Plain text and hashes": "Your work is kept in ordinary files that you can read and compare, and that will outlast any one tool. Other files are recognized by a digital fingerprint.",
  "One source of truth": "Everything Stemma tells you comes from the same set of records, so there is no second copy to fall out of step.",
  "Reproducible with the same inputs": "Someone with your project, copies of the sources they are entitled to, and the same version of the tool should get the same check results.",
  "Respect what is not yours to share": "Permissions and community limits matter. Stemma does not filter what reaches a hosted AI model, so material that may not be sent there does not belong in such a project.",
  "Deliverable over machinery": "What helps authors comes before process for its own sake, without dropping checks that catch real mistakes.",
  "Verify what can be verified, and make the rest re-checkable": "Whatever a program can check, it checks. The rest is set out so that you can check it easily and see who looked at what. No AI model writes or quietly corrects the text of a source.",
  "The plugin is the product": "You install one plugin. It and Claude set up whatever else is needed, from versions that are fixed and verified, and you keep control of permissions.",
};

function principles(): string {
  const text = read("docs/stemma/01-frame/principles.md");
  const section = text.slice(text.indexOf("## Principles"), text.indexOf("## Tension Resolution"));
  const names = [...section.matchAll(/^\d+\. \*\*(.+?)\*\* — /gm)].map((m) => m[1]!);
  const missing = names.filter((name) => !PLAIN[name]);
  if (names.length !== Object.keys(PLAIN).length || missing.length > 0) throw new Error(`principles.md and the site's plain wording differ: ${missing.join(", ")}`);
  return `${opening("Principles", "What Stemma does when two reasonable choices pull apart.", `<p class="note">These are the rules Stemma is designed by, not a list of features. For what it does today, see <a href="how.html">How it works</a> and <a href="checks.html">Checks</a>. The wording here is simplified. The project's exact wording is in its <a href="${REPOSITORY}/blob/main/docs/stemma/01-frame/principles.md">principles document</a>.</p>`)}
<ol class="principles">${names.map((name) => `<li><strong>${escape(name)}.</strong> <span>${PLAIN[name]}</span></li>`).join("\n")}</ol>`;
}

/** What a person might say, and what Stemma then does. Each maps to a command the demo or tests run. */
const ASKS: [string, string][] = [
  ["Start a Stemma project in this folder.", "Creates the project files and overwrites nothing."],
  ["Add a source record for this book, taking the details from its title page.", "Writes a record of the work. Claude says where each detail came from."],
  ["Capture this PDF as my copy of that source. I downloaded it from the library today.", "Turns it into text files in your project, one for each page, noting where and when you got it, and proposes page numbers where the printed numbers support them."],
  ["Find where that book discusses atolls, and capture the passage I choose.", "Searches the source's text. A script copies the words and page of the passage you choose."],
  ["Record the citations in this chapter.", "Writes one record for each citation, with its sentence, page and quotation."],
  ["Check the project and explain what is open.", "Runs the checks and explains each finding. When a quotation differs, you see it beside the closest wording in your source."],
  ["What does that book say on page 89?", "Shows only the pages you ask for, up to five, marked as quoted from the source."],
  ["I have a better scan of this book. Replace the old one.", "Captures the new one, sets the old one aside, and lists what relied on it."],
  ["Are any of my source files missing or changed?", "Names every source file that is missing, added or edited."],
];

function install(): string {
  return `${opening("Get started", "Install one plugin, then ask Claude in plain words. There is nothing else for you to set up.")}
${band("What you need", `<p>Claude Code. A folder for your project. Your own copies of the works you cite, for example PDFs or EPUB books. On Windows, setup also needs Git Bash.</p>`)}
${band("Install the plugin", `<p>Type these two commands in a terminal. They add the DocumentDrivenDX catalog of plugins and install Stemma from it.</p>
${excerpt("Commands to type in a terminal.", "claude plugin marketplace add DocumentDrivenDX/plugins\nclaude plugin install stemma@documentdrivendx")}`)}
${band("The first time you use it", `<p>Stemma needs a small program called Bun to run. Claude downloads one fixed version, confirms it is the expected file, and keeps it inside the plugin's own folder. Your system settings stay as they are, and Claude asks permission as it usually does.</p>
<p>If setup fails, or you say no, Claude tells you that nothing was checked. You can keep writing either way.</p>`)}
${band("What to ask Claude", `<dl class="asks">${ASKS.map(([ask, does]) => `<div><dt>&ldquo;${escape(ask)}&rdquo;</dt><dd>${escape(does)}</dd></div>`).join("")}</dl>`)}
${band("Before you add material", `<p><strong>Anything in a project may be sent to the AI model.</strong> Stemma holds back no individual source. If you may not send something to a hosted model, do not put it in the project.</p>
<p><strong>Your project holds the text of your sources.</strong> Anyone who can read your repository can read them, so publishing it publishes them. Originals such as PDFs and page images are not added to it.</p>
<p><a href="how.html#places">Where your material lives</a></p>`)}`;
}

/** Each check in everyday words, in the order an author meets them. Must say no more than checks.json. */
const PLAIN_CHECKS: { id: string; question: string; looks: string; limit: string }[] = [
  { id: "source.held", question: "Do you hold what you cite?", looks: "Each cited source needs its text in your project, and that text must be undamaged.",
    limit: "It does not compare the text with the pictures of the pages, or show that the source supports your sentence." },
  { id: "source.pages", question: "Is each source's text complete and unchanged?", looks: "No page or section may be missing, extra, out of order or edited without a record, and there should be as many pages as the original had.",
    limit: "Complete and unchanged files can still hold wrong text." },
  { id: "source.original", question: "Does the text still match its original?", looks: "Each source's text must be tied to the original it was made from, and converting that original again must have given the same text.",
    limit: "It reads the recorded comparison, not the original. Converting again repeats any mistake already in the original's own text." },
  { id: "source.labels", question: "Do the page numbers make sense?", looks: "Printed page numbers should run on from page to page, and agree with the numbers printed on the pages.",
    limit: "Where every page of the original is held and the text plainly runs on across a jump, the report records it as something seen in the original. Otherwise a jump stays open: it may be a missing leaf or a wrong label." },
  { id: "source.footnotes", question: "Do footnotes and their markers pair up?", looks: "Where footnotes could be told apart, each marker should have its note and each note its marker.",
    limit: "It says nothing about pages whose footnotes could not be determined, which includes most scans." },
  { id: "quote.present", question: "Is the quotation in the source?", looks: "Each recorded quotation is looked for in the source's text. Differences in line breaks and spacing, and a few other quirks of printed and scanned text, are allowed. A close but different passage is shown next to your quotation.",
    limit: "A pass means agreement with the source's text, which can be wrong." },
  { id: "quote.page", question: "Is the quotation on the page you cite?", looks: "The quoted words must be on the page, or in the chapter or paragraph, that your citation gives.",
    limit: "It relies on the page numbers established for the source. Where a page has none, it says it could not check." },
  { id: "locator.extent", question: "Is the cited page really there?", looks: "The page, or other pointer such as a chapter, must fall within what is recorded for the work or within what its text holds.",
    limit: "It only tests the range. It does not show that what you describe is on that page." },
  { id: "number.present", question: "Is your figure in the source?", looks: "A figure in a sentence that cites one source should appear in that source's text.",
    limit: "It finds the figure anywhere in the source, whatever it counts there. It does not read figures written as words." },
  { id: "meta.source", question: "Do the details match the work itself?", looks: "Authors, title and date are compared with what the original states about itself and with the text of its title page.",
    limit: "Scanned text can garble a title page. A saved catalogue record that agrees then bears the detail out. With neither, the report says it was not covered; that is not a problem to fix." },
  { id: "meta.resolver", question: "Do the details match a library catalogue?", looks: "Authors, title and date are compared with catalogue records saved in your project. A body filed under its parent body, and a part entered after the title of its collection, count as the same name or title.",
    limit: "A catalogue can be wrong, or describe another edition or a whole set of volumes. A source not compared with any catalogue is reported as not covered, not as a problem." },
  { id: "id.resolves", question: "Does each identifier lead to the right work?", looks: "A DOI or library identifier should have a saved catalogue record naming the same work.",
    limit: "It compares titles. Some kinds of identifier cannot be looked up." },
  { id: "cite.key", question: "Which source does this citation mean?", looks: "The short label in each citation must match exactly one source.",
    limit: "It reads your manuscript only in Stemma's marked-up Markdown, and does not show that the source supports your sentence." },
  { id: "bib.uncited", question: "Is every listed work cited?", looks: "A work you have listed for the bibliography should be cited somewhere.",
    limit: "If a chapter file cannot be read, it may not be able to tell, and says so." },
  { id: "claim.complete", question: "Does each recorded claim say what it rests on?", looks: "A claim you have recorded needs a note behind it, a level of confidence, and your reason why the sources support it.",
    limit: "It only sees that the three are there. It does not show that the note supports the claim, or that the reason is a good one. It reads recorded claims, not your manuscript." },
  { id: "source.changed", question: "Did something you relied on change?", looks: "Lists passages, citations and other work that rest on a source you have replaced or set aside, or on text that has changed.",
    limit: "It cannot record that you have looked again, so an item stays listed." },
  { id: "record.valid", question: "Are the project files in order?", looks: "Reads the settings, every record, every source file and the headings of your standing rules.",
    limit: "Some kinds of record are only partly checked. The report says when your project has one." },
  { id: "coordinate.stray", question: "Is a location written where it should not be?", looks: "Warns about map coordinates written in project files, without repeating them.",
    limit: "It only recognizes some ways of writing coordinates, and cannot tell whether a place is sensitive." },
  { id: "project.binary", question: "Does your project hold only text?", looks: "Reports binary files, such as Word, PDF or image files, that git tracks or would add. Originals stay outside the project, and their text is converted into it.",
    limit: "It does not read files git ignores, or earlier history, where a file once added remains." },
];

function checksPage(): string {
  const all = checks();
  const ids = (list: { id: string }[]) => list.map((c) => c.id).sort().join(" ");
  if (ids(all) !== ids(PLAIN_CHECKS)) throw new Error("the site's plain wording does not match the list of checks");
  const seeded = report("seeded").body.results;
  const anchor = (id: string) => id.replace(".", "-");
  const built = PLAIN_CHECKS.map((plain) => {
    const c = all.find((x) => x.id === plain.id)!;
    const example = seeded.find((r) => r.check === c.id && r.open);
    return `<h3 class="check-name" id="${anchor(c.id)}">${plain.question} ${code(c.id)}</h3>
<p>${plain.looks}</p><p class="limits"><strong>What a pass does not tell you:</strong> ${plain.limit}</p>
${example ? more("See an example finding", `<p>From a <a href="examples.html#fixtures">test project</a> with mistakes planted in it. This card is the site's own layout of one entry in a report; it is not a Stemma screen.</p>${findingCard(example)}`) : ""}
${more(`Exact wording: the full description and every message (${c.findings.length})`, `<p>${escape(c.summary)}</p><p class="limits"><strong>Limits:</strong> ${escape(c.limits)}</p>
<ul class="reasons" aria-label="${escape(`Findings of ${c.id}`)}">${c.findings.map((f) => `<li>${code(f.reason)}<div><p class="message">${escape(f.message)}</p><dl><div><dt>Why it matters</dt><dd>${escape(f.why)}</dd></div><div><dt>What to do</dt><dd>${f.suggestions.map(escape).join(" ")}</dd></div></dl></div></li>`).join("")}</ul>`)}`;
  });
  return `${opening("What gets checked", `${all.length} checks, what each looks at, and what passing it does not tell you.`, `<p class="note">Each check answers <em>pass</em>, <em>fail</em> or <em>could not check</em> (the tool writes <code>unverifiable</code>). Nothing is ever blocked. A pass covers only what that check reads. You do not need the names in <code>small type</code>; they are how a report refers to a check.</p>`)}
${band("The checks", built.join("\n"), { id: "checks", aside: contents("Checks on this page", [...PLAIN_CHECKS.map((c): [string, string] => [anchor(c.id), c.question]), ["not-checked", "What is not checked"]]) })}
${band("What is not checked", `<p>A report runs the checks that apply to what is in your project. These are left to you:</p>
<ul class="plain-list"><li>Whether the text made from a source matches the pictures of its pages, unless a person compares them.</li>
<li>Figures written as words, and whether a figure in a source means what your sentence says.</li>
<li>Manuscripts in Word or another form. Only files in Stemma's marked-up Markdown are read.</li>
<li>In those files, what your own words say, apart from figures, and quotations marked in other ways than double quotation marks, block quotations or Stemma's own mark.</li></ul>
<p>No check tells you whether a source supports your argument, or whether you chose the right source.</p>`, { id: "not-checked" })}`;
}

/** What each numbered step of the demo shows, in everyday words. Keyed by its number. */
const STORY: [string, string][] = [
  ["Start a project", "A new project is created, and two invented books are recorded."],
  ["Cite, with a slip", "Two citations are added. One mistypes the short label of its source, and a book that is never cited is listed for the bibliography."],
  ["First check", "The check finds the slip and the uncited book, notices a file out of its standard layout, and says that a cited book is not in the project. It also notes that neither invented book was compared with a catalogue, which is not a problem."],
  ["Fix and check again", "Three problems are fixed. There is still no text of the cited book to compare with."],
  ["Add a scan's text", "A picture of a page holds no text, so text for the scan is supplied page by page and labelled as recognized. Nothing is left open. The report says what it could not cover: the title is not in the text, and the invented book is in no catalogue."],
  ["A PDF with its own text", "In a second project, one command turns a PDF into page files, converts it again to compare, and checks. The warnings shown come from the PDF-reading library and concern drawing pages, which Stemma does not do."],
  ["Cite a passage", "A passage is found and chosen by its place. A script copies its words and page into a citation."],
  ["Check typed quotations and pages", "Two more citations are typed. One differs by a word, and one cites a page the book does not have. The copied one passes, after rejoining a word split at the end of a line."],
  ["Look at one page", "Only the page asked for is shown, clearly marked as text quoted from the source."],
  ["Copy the project", "A copy of the project without the original files gives the same report."],
  ["What a clean result looks like", "A project that records a source but cites nothing is called checked clean. That says nothing about citations, because there are none."],
];

/** The demo transcript, one part for each of its numbered steps. */
function demoSteps(): string {
  const [, ...parts] = generated("transcripts/demo.txt").split(/^=============== /m);
  if (parts.length !== STORY.length) throw new Error("the demo's steps changed; update their plain descriptions");
  return `<ol class="steps">${parts.map((part, i) => {
    const [title, ...lines] = part.split("\n");
    return `<li><h3>${STORY[i]![0]}</h3><div><p>${STORY[i]![1]}</p>${more(`What the tool printed (step ${i + 1})`, `<p class="record">${escape(title!)}</p>${transcript(lines.join("\n").trim())}`)}</div></li>`;
  }).join("\n")}</ol>`;
}

const FIXTURE_NAMES: Record<string, string> = {
  seeded: "A project with planted mistakes", clean: "A project with nothing open", cited: "A cited source that is not in the project", manuscript: "A project with a manuscript file",
};

function examples(): string {
  const fixtures = Object.entries(FIXTURES);
  return `${opening("Examples", "Watch Stemma at work on a made-up book. Everything here comes from real runs of the tool.", `<p class="note">All names and sources on this page are invented. For a real book, see the <a href="darwin.html">worked example</a>. When you use Stemma you talk to Claude; what is shown here is what the tool prints behind the scenes. In it, <code>$DEMO</code>, <code>$PROJECTS</code> and <code>&lt;plugin root&gt;</code> stand for folder names.</p>
${contents("Parts of this page", [["demo", "The demo, step by step"], ["fixtures", "More test projects"], ["screenshots", "Pictures of the output"]])}`)}
${band("The demo, step by step", `<p>Eleven short steps, from an empty folder to checked quotations. IDs in the demo are fixed so that every run looks the same.</p>
${demoSteps()}`, { id: "demo" })}
${band("More test projects", `<p>Small projects that the tool's own tests run. Each has its printed report and the same report as a data file, with the run time and machine details removed.</p>
${fixtures.map(([name, about]) => { if (!FIXTURE_NAMES[name]) throw new Error(`no plain name for fixture ${name}`); return `<h3>${FIXTURE_NAMES[name]}</h3><p>${escape(about)} <a href="reports/check-${name}.json">Data file for the ${name} project</a>.</p>${more(`Printed report for the ${name} project`, transcript(generated(`transcripts/check-${name}.txt`)))}`; }).join("\n")}`, { id: "fixtures" })}
${band("Pictures of the output", `<p>The tool's output as pictures, including dark and narrow layouts.</p>
${more("Show six pictures", ["check-quotations.png", "demo-first-check.png", "check-findings-light.png", "check-findings-dark.png", "check-clean.png", "check-findings-phone.png"].map(shot).join("\n"))}`, { id: "screenshots" })}`;
}

/** Where each fact in the worked example comes from, in everyday words. */
const PROVENANCE: [string, string][] = [
  ["Title, author, publisher, place and year", "Read from the picture of the title page. The computer-read text of that page does not hold the year of publication; the saved Internet Archive record of the same item gives it, and the check names that record as its basis."],
  ["The four quotations", "An AI model chose the passages, and a script copied them. The model then compared each with the picture of its page: PDF pages 19, 105 and 106, counting from 0."],
  ["Where the original came from", "The web address it was downloaded from. The time it was obtained is the downloaded file's own date."],
  ["The text", "The text already inside the Internet Archive's PDF, made by character recognition that nobody has proofread."],
  ["The page numbers", "Proposed from the numbers printed on the pages. They agree with the Internet Archive's page-number file and with the numbering inside the PDF wherever those give a number."],
  ["The other works", "Their titles, names and years were read from pictures of their title pages or first pages."],
];

/** A source record as a plain reference. */
function reference(source: any): string {
  const names = (source.contributions ?? []).map((c: any) => {
    const n = c.as_printed;
    return `${n.literal ?? [n.given, n.family].filter(Boolean).join(" ")}${c.role === "editor" ? " (editor)" : ""}`;
  });
  const container = (source.bib ?? []).find((b: any) => b.name === "container-title")?.value.value;
  const title = source.type === "article-journal" ? `&ldquo;${escape(source.title.value)}&rdquo;` : `<cite>${escape(source.title.value)}</cite>`;
  const who = names.length > 3 ? `${names[0]} and others` : names.join(" and ");
  return `${who ? `${escape(who)}. ` : ""}${title}${container ? `. <cite>${escape(container)}</cite>` : ""}. ${escape(source.issued.edtf)}.`;
}

function darwin(): string {
  const { source, upstream, manifest, pages, citations, passages } = darwinBook();
  // The works whose text the example holds; a letter, chapter or article cited within one has its own record and is not listed.
  const works = records("sources").filter((s) => !(s.relations ?? []).some((r: any) => r.type === "part_of")).sort((a, b) => Number(a.issued.edtf) - Number(b.issued.edtf) || String(a.citation_key).localeCompare(String(b.citation_key)));
  const cited = citations.map((c) => {
    const [before, after] = c.sentence.text.split(c.quotation) as [string, string?];
    if (after === undefined) throw new Error(`${c.id}: the sentence no longer holds its quotation`);
    return `<li><p class="locator">${escape(`${c.locator.label} ${c.locator.value}`)}</p><div><p class="sentence">${escape(before)}<span class="quoted">${escape(c.quotation)}</span>${escape(after)}</p><p class="record">${code(c.id)}</p></div></li>`;
  }).join("");
  const file = (path: string) => more(`The record file: ${code(path.split("/").pop()!)}`, excerpt("A record file, as it is in the repository.", read(`examples/coral-reefs/${path}`)));
  const split = citations.find((c) => passages.get(c.passage)!.quote.exact.includes("-\n"));
  if (!split) throw new Error("no quotation of the example crosses a line-end hyphen any more; reword the page");
  const megabytes = (upstream.size / 1e6).toFixed(1);
  const without = pages.filter((p) => p.label_status !== "labelled").length;
  const checked = read("website/recorded/example-check.txt");
  const trial = read("website/recorded/example-trial.txt");
  if (!checked.includes("CHECKED CLEAN")) throw new Error("the worked example is no longer checked clean; reword the page");
  const page = `sources/${source.citation_key}/pages/p0105.md`;
  const parts: [string, string][] = [["works", "1. The works"], ["original", "2. One original"], ["text", "3. Its source files"], ["pages", "4. Its page numbers"], ["citations", "5. Four citations"], ["check", "6. The check"], ["mistakes", "7. Planted mistakes"], ["again", "8. Checking it again"], ["facts", "Where the facts come from"], ["limits", "What this does not show"]];
  return `${opening("Worked example: Darwin and coral reefs", "A real book from 1842, followed from its title page to four checked quotations.", `<p class="note">An AI model built this example and compared its facts and quotations with pictures of the pages. <strong>No person has confirmed them</strong>, and no record is marked as reviewed. The example holds the text of ${works.length} works on coral reefs. No PDF or page picture is published with it.</p>
${contents("Steps of the worked example", parts)}`)}
<section class="spread" aria-labelledby="whole">
<h2 id="whole">The whole example at a glance</h2>
${descent(true)}
</section>
${band("1. The works", `<p>The example gathers these works in the old argument over how coral reefs form. Its four citations are of Darwin's 1842 book.</p>
<ul class="plain-list">${works.map((w) => `<li>${reference(w)}</li>`).join("")}</ul>
<p>The short label <code>${escape(source.citation_key)}</code> is how citations refer to Darwin's book. It is marked as a <em>candidate</em>: nobody has formally accepted it into the project.</p>
${file(`records/sources/${source.id}.json`)}`, { id: "works" })}
${band("2. One original", `<p>The original of Darwin's book is a ${megabytes} MB scan from the Internet Archive (${escape(upstream.version)}). Its record notes the address it came from, when it was obtained, and a fingerprint of the exact file. If the file changed by even one character, the fingerprint would no longer match. The PDF itself is not in the project.</p>
<p class="record">Address: ${escape(upstream.url)}</p>
${file(`records/upstreams/${upstream.id}.json`)}`, { id: "original" })}
${band("3. Its source files", `<p>The PDF already contains text, made by a computer reading the page pictures. Stemma wrote it into the project as ${pages.length} files, one for each page, blank pages included. Nobody has proofread it, and its quality is marked as not assessed. Where the layout of a page, such as its paragraphs or footnotes, could not be told, the file says so.</p>
<p>The PDF was then converted a second time, and every page agreed.</p>
${more("The start of the file for printed page 88", excerpt("The first lines of a source file, as it is in the repository. The words are the recognized text, errors included.", read(`examples/coral-reefs/${page}`).split("\n").slice(0, 28).join("\n")))}
<p class="record">Source files: ${code(manifest.id)}</p>`, { id: "text" })}
${band("4. Its page numbers", `<p>The third page of a PDF is rarely page 3 of the book. Stemma took page numbers from the numbers printed on the pages, and left ${without} pages without one.</p>
<p>Among them is a publisher's list of other books, bound in at the back with numbering of its own. Its numbers repeat the book's, so they were not used. A number printed on a page does not always number the work.</p>
${pageMap()}`, { id: "pages" })}
${band("5. Four citations", `<p>Each sentence below is this example's own wording around a short quotation, which is underlined. The words and page of each quotation were copied by script from a passage in the source files.</p>
<ol class="citations">${cited}</ol>
${file(`records/passages/${citations[0]!.passage}.json`)}
${file(`records/citations/${citations[0]!.id}.json`)}`, { id: "citations" })}
${band("6. The check", `<p>All four citations pass: each quotation is in the source's text, on the page cited. One matched after rejoining the word <em>denying</em>, split at the end of a line; the report points that out so you can look.</p>
<p>The project as a whole is checked clean: nothing across the works is open. No person had to approve anything. The report also says how it got there. The computer-read text of Darwin's title page leaves out the year, and a saved library record of the same copy bears it out. In another volume the printed page numbers jump from 232 to 333; every page of the original is there and the text runs on, so the report records the jump as something seen in the original. <em>Checked clean</em> does not mean the work is correct, only that these checks found nothing wrong.</p>
${more("What the tool printed", transcript(checked, "<strong>Transcript</strong> of a real run on the example as published. Folder names are replaced."))}`, { id: "check" })}
${band("7. Planted mistakes", `<p>To see whether the checks would notice, two citations in a throwaway copy of the project were changed as if an author had typed them wrongly: <q>greater</q> became <q>smaller</q> in the second quotation, and the first citation was moved to page 412.</p>
<p>Both were caught. The changed quotation is shown beside the wording in the source (the mark ⏎ shows where a line ends). For the impossible page, the report also says where the quoted words are: page 88.</p>
${more("What the tool printed for the planted mistakes", transcript(trial, "<strong>Transcript</strong> of a real run on a throwaway copy with two planted mistakes."))}
<h3>A correct quotation that would be flagged</h3>
<p>On page 2, the computer-read text has a stray space after a quotation mark. A quotation typed correctly from the page across that mark would be reported as only a near match. A finding means <em>look at the page</em>, not <em>you are wrong</em>.</p>`, { id: "mistakes" })}
${band("8. Checking it again", `<p>The text of every source is in the project, so anyone who downloads the example gets the same check results without the PDFs. Someone who obtains the originals can also have them converted again and compared with the published text.</p>
<p><a href="${REPOSITORY}/tree/main/examples/coral-reefs">How to do that, with all the example's files and notes, on GitHub</a></p>`, { id: "again" })}
${band("Where the facts come from", `<p>Below, a <em>picture of a page</em> means an image drawn from an original PDF and read by an AI model (claude-sonnet-5-5). No person has read these pages for the example.</p>
${entries(PROVENANCE)}`, { id: "facts" })}
${band("What this does not show", `<p>The checks show that four quotations agree with computer-read text of one copy, on the pages cited. They do not show that Darwin is quoted fairly, that the sentences around the quotations are right, or that this is the best edition to cite. The other works are held but not yet cited, and no argument has been built from them here.</p>`, { id: "limits" })}`;
}

function design(): string {
  const tokens = colorTokens();
  const light = measured("light");
  const dark = measured("dark");
  const short = (name: string) => name.replace(/^--(arras|stm)-color-/, "");
  const seeded = report("seeded").body.results;
  const unverifiable = seeded.find((r) => r.outcome === "unverifiable")!;
  return `${opening("Design language", "How Stemma looks and speaks: like a careful report.", `<p class="note">This summarizes how this site looks and speaks, from the design system in the repository, <code>docs/stemma/02-design/DESIGN.md</code>.</p>`)}
${band("Identity", `<p><img src="mark.svg" alt="The Stemma mark: a small family tree with one root and three descendants" width="96" height="96"></p>
<p>The mark is a small <em>stemma codicum</em>: one filled node for the earliest witness, and lines of descent to three open ones, one of them through an intermediate branch. It depicts no real manuscript tradition. Write the name <strong>Stemma</strong>, and <code>stemma</code> for the command. Keep clear space of a quarter of the mark's width around it, and do not use it below 16 pixels.</p>`)}
${band("Voice", `<p>Tools and reports, not gates and approvals. Say what is wrong, show the evidence, say why it matters, suggest what to do.</p>
<p>These pages speak to an author, not a programmer: everyday words, <em>you</em> for the reader, and a term explained where it is first needed. What the tool prints is shown word for word, introduced in plain language and usually folded away until asked for.</p>
${table("Voice", ["Write", "Not"], [
    ["Nothing is blocked.", "You must fix this before continuing."],
    ["could not be checked", "probably fine"],
    ["The checks found nothing open. This does not mean that the book is correct.", "Verified. All good!"],
  ])}`)}
${band("Color", `<p>Surfaces, text and the accent are the default role tokens of <a href="https://github.com/DocumentDrivenDX/arras">arras</a>; Stemma sets no brand color. It adds a strong line and three status colors. Light and dark follow the system setting, or <code>data-appearance</code> on the page. Status colors only repeat a word.</p>
${table("Color tokens", ["Token", "Light", "Dark", "Current"], tokens.map((t) => [code(t.name), code(t.light), code(t.dark), `<span class="swatch" style="background: var(${t.name})">&#8195;&#8195;</span>`]))}`)}
${band("Contrast", `<p>Computed with the WCAG 2.2 formula from the stylesheet's values.</p>
${table("Contrast ratios", ["Foreground on background", "Needs", "Light", "Dark", "Sample"], light.map((p, i) => [`${short(p.fg)} on ${short(p.bg)}`, `${p.floor}:1`, `${p.ratio.toFixed(2)}:1`, `${dark[i]!.ratio.toFixed(2)}:1`,
    p.floor === 3
      ? `<span class="swatch" data-pair="${i}" style="color: var(${p.fg}); border: 2px solid var(${p.fg}); background: var(${p.bg})">&#8195;&#8195;</span>`
      : `<span class="swatch" data-pair="${i}" style="color: var(${p.fg}); background: var(${p.bg})">Aa 123</span>`]))}
<p>The arras border color is under 3:1 on all ${BACKGROUNDS.length} backgrounds, so it is for decorative dividers only. It never marks a control or carries meaning.</p>`, { id: "contrast" })}
${band("Type", `<p>Three families under the SIL Open Font License, served from this site: Source Serif 4 for headings, Inter for text, JetBrains Mono for command output and identifiers. Source Serif 4 also sets quoted words, at its optical sizes and with its own italic. Their licence texts are published beside the font files: <a href="fonts/LICENSE-source-serif-4.txt">Source Serif 4</a>, <a href="fonts/LICENSE-inter.txt">Inter</a>, <a href="fonts/LICENSE-jetbrains-mono.txt">JetBrains Mono</a>. Only Latin and extended Latin are bundled; other scripts fall back to system fonts.</p>
<p class="specimen-display">A line of descent back to each source</p>
<p class="specimen-quote">Some fields were abandoned by their holders.</p>
<p>A citation rests on a source record and the text of the source.</p>
<p class="specimen-mono">src-demo0harbour01 &nbsp; cite.key &nbsp; 0O 1lI</p>`)}
${band("Spacing and shape", `<p>Spacing steps of 4, 8, 12 and 16 pixels; 6-pixel control corners and 10-pixel card corners. Borders that carry meaning use the strong line. No shadows and no animation.</p>`)}
${band("Components", `<h3>Page layout</h3>
<p>A page opens with its title. On wide screens each section's heading sits in the margin and stays in view while the section is read; on narrow screens it sits above the text. Running text keeps a short line; transcripts and entries may use the whole column.</p>
<h3>Drawings</h3>
<p>The <a href="how.html#loop">research cycle</a>, the <a href="how.html#rounds">demo's rounds of checking</a>, <a href="how.html#places">where material lives</a> and the <a href="darwin.html#pages">example's page numbers</a> are drawn with HTML and lines, so the words in each drawing are its text.</p>
<h3>Line of descent</h3>
<p>The drawing on the <a href="index.html#descent">first page</a> is a nested list of records with lines drawn between them, so its text is the drawing. As in the mark, the filled node is the one the rest descend from. Its caption says where it came from.</p>
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
${shot("check-clean.png")}`)}
${band("Navigation and accessibility", `<p>The target is WCAG 2.2 level AA. A skip link comes first, each page has one first-level heading, the current page is marked with <code>aria-current</code> by weight and an underline, focus shows a 2-pixel ring, and wide tables and long excerpts can be reached by keyboard. On narrow screens the navigation wraps; the site needs no JavaScript.</p>`)}`;
}

const BODIES: Record<(typeof NAV)[number]["file"], () => string> = {
  "index.html": home, "how.html": how, "principles.html": principles, "install.html": install,
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
<header class="masthead">
<div class="shell">
<a class="wordmark" href="index.html"><img src="mark.svg" alt="" width="36" height="36">Stemma</a>
<nav aria-label="Main"><ul class="nav">${nav}</ul></nav>
</div>
</header>
<main id="main" tabindex="-1" class="shell page">
${page.body()}
</main>
<footer class="colophon">
<div class="shell">
<p>Stemma is pre-release, free and open source (MIT license), and part of <a href="https://documentdrivendx.github.io/">DocumentDrivenDX</a>. <a href="${REPOSITORY}">Source on GitHub</a>.</p>
<p>Set in Source Serif 4, Inter and JetBrains Mono. These pages run no scripts and request nothing from another host.</p>
</div>
</footer>
</body>
</html>
`;
}

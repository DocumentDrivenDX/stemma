// The PostgreSQL worked example as the site reads it: its records, its report
// and research log, and its recorded runs. The page and the drawings take names,
// counts and quoted words from here, and each reader throws when the files stop
// saying what the page says about them. It loads nothing heavy.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { exampleDir, frontMatter, readRecords } from "./example.ts";
import { keysNotCommitted, manifest } from "./held.ts";

export const POSTGRES = exampleDir("postgres-web-apps");
const RECORDED = join(import.meta.dir, "../recorded");
const read = (path: string) => readFileSync(join(POSTGRES, path), "utf8");
const records = (kind: string): any[] => readRecords(POSTGRES, kind);

function must<T>(value: T | undefined | null | false, what: string): T {
  if (!value) throw new Error(`the PostgreSQL example ${what}; reword its page`);
  return value;
}

export interface Work {
  key: string;
  title: string;
  kind: string;
  /** The version captured, where the record names one, and the date of the work or the day it was read. */
  when: string;
  /** Whether the published copy holds its text. */
  held: boolean;
}

const KINDS = ["Documentation", "Release notes", "Web page", "Article", "Paper"];

function kind(source: any): string {
  const container = String((source.bib ?? []).find((b: any) => b.name === "container-title")?.value.value ?? "");
  if (source.type === "paper-conference" || source.type === "article-journal") return "Paper";
  if (source.type === "post-weblog") return "Article";
  must(source.type === "webpage", `has a work of a type the page does not name: ${source.type}`);
  if (/^Release /.test(source.title.value)) return "Release notes";
  return container.endsWith("Documentation") ? "Documentation" : "Web page";
}

/** Every work of the example, by kind and then by key. */
export function works(): Work[] {
  const left = keysNotCommitted(POSTGRES);
  const upstreams = records("upstreams");
  const listed = records("sources").map((source): Work => {
    const key: string = source.citation_key;
    const version = upstreams.find((u) => u.source === source.id)?.version;
    const accessed = (source.dates ?? []).find((d: any) => d.variable === "accessed")?.date.edtf;
    const when = source.issued?.edtf ?? (accessed && `read ${accessed}`);
    const held = !left.includes(key);
    if (held) must(manifest(POSTGRES, key).pages.every((p: { file: string }) => existsSync(join(POSTGRES, "sources", key, p.file))), `lacks text that it commits, of ${key}`);
    return { key, title: source.title.value, kind: kind(source), when: [version, must(when, `gives no date for ${key}`)].filter(Boolean).join("; "), held };
  });
  must(left.every((key) => listed.some((w) => w.key === key)), "leaves out the text of a work it has no record of");
  return listed.sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || a.key.localeCompare(b.key));
}

/** The report's footnote that quotes these words: its number and its paragraphs. */
function footnote(report: string, quotation: string) {
  const bare = quotation.replace(/[.”"]+$/, "");
  const found = [...report.matchAll(/^\[\^(\d+)\]: (.*(?:\n(?: {4}.*)?)*?)(?=\n\[\^|\n*$)/gm)]
    .filter((m) => m[2]!.includes(bare));
  must(found.length === 1, "no longer has one footnote for the quotation the page follows");
  return { number: Number(found[0]![1]), paragraphs: found[0]![2]!.split("\n").map((l) => l.trim()).filter(Boolean) };
}

/** The citation the page follows from a documentation page to a footnote. */
const FOLLOWED = "cit-cs670qx1rx2s7se8ydx7";

/** One documentation page, from the record of its original to a footnote. */
export function followed() {
  const citation = must(records("citations").find((c) => c.id === FOLLOWED), `no longer has ${FOLLOWED}`);
  const source = must(records("sources").find((s) => s.citation_key === citation.key), "no longer records the page followed");
  const upstreams = records("upstreams").filter((u) => u.source === source.id);
  const text = manifest(POSTGRES, citation.key);
  const passage = must(records("passages").find((p) => p.id === citation.passage), "no longer has the passage followed");
  must(upstreams.length === 1 && text.source === source.id && text.original.files[0].sha256 === upstreams[0].sha256 && passage.text === text.id && !text.paged, "no longer forms one line of descent");
  must(works().find((w) => w.key === citation.key)?.held, "no longer commits the text of the page followed");
  must(citation.locator.label === "paragraph" && citation.locator.value === passage.locator.value, "cites the page followed by another place");
  const sections: { file: string; heading: string }[] = text.pages.map((p: { file: string }) => ({
    file: p.file, heading: String(frontMatter(`sources/${citation.key}/${p.file}`, POSTGRES).section ?? "").replace(/ #$/, ""),
  }));
  const anchored = sections[passage.anchor[0].index]!;
  // Notes on this passage, and the claims each is linked to.
  const claims = new Map(records("claims").map((c) => [c.id, c]));
  const note = must(records("notes").find((n) => (n.passages ?? []).includes(passage.id)), "no longer has a note on the passage followed");
  const links = records("attestations").filter((a) => a.evidence === note.id).map((a) => ({ stance: String(a.stance), claim: claims.get(a.claim) }));
  const link = must(links.find((l) => l.claim?.role === "claim" && l.stance === "supports"), "no longer links that note to a claim");
  must(links.some((l) => l.claim?.role === "thesis"), "no longer links that note to the thesis");
  const report = read("report/report.md");
  must(report.includes(citation.sentence.text), "'s report no longer holds the sentence followed");
  // The manuscript marks no claim, so nothing links this sentence to the claim but the passage.
  must(!read("report/report.src").includes("clm-"), "'s report now names claims");
  return {
    source, upstream: upstreams[0]!, manifest: text, sections, anchored, passage, citation, note,
    claim: link.claim!, footnote: footnote(report, citation.quotation),
  };
}

/** How the captures at the Internet Archive compared with the recorded originals, over every upstream record. */
export function archived() {
  const compared = records("upstreams").flatMap((u) => (u.locations ?? [])
    .filter((l: any) => l.kind === "web_archive" && l.compared)
    .map((l: any) => l.compared.sha256 === u.sha256));
  return { captures: compared.length, same: compared.filter(Boolean).length };
}

/** The theses the research log says were considered and dropped, in its words. */
export function rejected() {
  const log = read("report/research-log.md");
  const section = log.slice(log.indexOf("## Candidate theses considered"), log.indexOf("\n## ", log.indexOf("## Candidate theses considered") + 3));
  const found = [...section.matchAll(/^\d\. \*(.+?)\*(?: \([^)]*\))?: (.+?\.) (Rejected [^.]+\.) (.+)$/gm)]
    .map((m) => ({ name: m[1]!, thesis: m[2]!, verdict: m[3]!, why: m[4]! }));
  must(found.length === 2, "'s research log no longer holds two rejected theses");
  return found;
}

/** A passage of the research log or the report, which must hold it word for word. */
const quoted = (path: string, words: string): string => (must(read(path).includes(words), `no longer says “${words.slice(0, 50)}…” in ${path}`), words);

export function argument() {
  const claims = records("claims");
  const one = (role: string) => {
    const found = claims.filter((c) => c.role === role);
    must(found.length === 1, `no longer has one claim of role ${role}`);
    must(found[0].review?.state === "unreviewed", `has a reviewed ${role}`);
    return found[0];
  };
  const thesis = one("thesis");
  const against = records("attestations").filter((a) => a.claim === thesis.id && a.stance === "contradicts");
  must(against.length === 1, "no longer has one note that contradicts its thesis");
  const note = must(records("notes").find((n) => n.id === against[0].evidence), "lacks the contradicting note");
  const passage = must(records("passages").find((p) => p.id === note.passages[0]), "lacks the contradicting note's passage");
  const source = must(records("sources").find((s) => s.id === note.source), "lacks the contradicting note's source");
  return {
    thesis, rival: one("rival_reading"), objection: one("objection"), note, passage, source,
    question: quoted("report/report.md", "This report asks when PostgreSQL is a sound default for a web application’s primary datastore."),
    bothWays: quoted("report/research-log.md", "It cuts both ways: delta storage did about twice as well on rows of 100 attributes with one touched (p. 789), and append-only did better on the TPC-C-based test (p. 790)."),
    reportAnswers: quoted("report/report.md", "The objection therefore stands in a limited form."),
    reportSays: quoted("report/report.md", "It is not shown here that another database would do better."),
  };
}

/** The report's title and section headings. */
export function outline() {
  const report = read("report/report.md");
  const title = must(/^# (.+)$/m.exec(report)?.[1], "'s report has no title");
  const sections = [...report.matchAll(/^## (\d+\. .+)$/gm)].map((m) => m[1]!);
  must(sections.length > 0, "'s report has no numbered sections");
  const notes = [...report.matchAll(/^\[\^\d+\]: /gm)].length;
  return { title, sections, notes };
}

/** What the research did not do, as the example's README lists it. */
export function gaps(): string[] {
  const readme = read("README.md");
  const section = readme.slice(readme.indexOf("\n## Gaps"), readme.indexOf("\nSee [", readme.indexOf("\n## Gaps")));
  for (const words of ["OpenAI", "Uber", "no systematic search", "Nothing here measures PostgreSQL 18 or 19"]) {
    must(section.includes(words), `'s list of gaps no longer names “${words}”`);
  }
  return [
    "No systematic search was run. An AI model chose the sources from what it already knew, which favors well-known documents.",
    "Two articles are named as not used: OpenAI’s article of 2026 on scaling PostgreSQL, and Uber’s article of 2016 on leaving it. Nothing in the report rests on either.",
    "Nothing in it measures PostgreSQL 18 or 19, compares current releases with other databases, or shows how often applications meet the limits discussed.",
  ];
}

const recorded = (name: string) => readFileSync(join(RECORDED, name), "utf8");

/** The numbered findings of a printed report, each without its number. */
export const findings = (transcript: string): string[] =>
  transcript.split("\n\n").flatMap((block) => (/^\d+\. /.test(block) ? [block.replace(/^\d+\. /, "")] : []));

function run(name: string) {
  const text = recorded(name);
  const line = must(/^OPEN FINDINGS: (\d+) problem\(s\), (\d+) could not be checked, (\d+) kind\(s\) of check this version does not run\..*$/m.exec(text), `'s run ${name} no longer lists open findings`);
  must(text.includes("\nNOT CHECKED: "), `'s run ${name} no longer says what was not checked`);
  return {
    text, line: line[0], problems: Number(line[1]), unchecked: Number(line[2]), notRun: Number(line[3]),
    /** The report as printed from its first line to its first finding. */
    head: text.slice(0, text.indexOf("\n\n1. ")),
    findings: findings(text),
  };
}

/** The three recorded runs, checked against one another. */
export function runs() {
  const left = keysNotCommitted(POSTGRES);
  const published = run("postgres-check.txt");
  const complete = run("postgres-check-full.txt");
  const trial = run("postgres-trial.txt");
  const problems = (r: { findings: string[] }) => r.findings.filter((f) => f.startsWith("PROBLEM"));
  const open = problems(complete);
  must(complete.problems === 2 && complete.unchecked === 0 && open.length === 2, "no longer has two problems and nothing unchecked with all its text");
  must(published.problems === 2 && published.unchecked > 0 && problems(published).join("\n\n") === open.join("\n\n"), "no longer has the same two problems in the published copy");
  const footnotes = must(open.find((f) => f.includes("[source.footnotes]") && f.includes("explained by model")), "no longer has the footnote problem, explained by a model");
  const details = must(open.find((f) => f.includes("[meta.source]") && f.includes("explained by model") && f.includes("key: pg96notes")), "no longer has the source details problem, explained by a model");
  const notHeld = must(published.findings.find((f) => f.includes("The source's text is not held here")), "no longer reports text as not held");
  must(notHeld.includes(`[source.pages, ${left.length} places]`), "reports another number of works as not held than it leaves uncommitted");
  const added = trial.findings.filter((f) => !published.findings.includes(f));
  must(added.length === 2 && added.some((f) => f.includes("[quote.page]")) && added.some((f) => f.includes("[quote.present]") && f.includes("does immediately remove")), "'s planted mistakes no longer add the two findings the page describes");
  return { published, complete, trial, details, footnotes, notHeld, added };
}

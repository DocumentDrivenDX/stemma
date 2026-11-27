// The worked examples, as the home page's cards show them. A new example page
// adds its file name here (`page`) and an entry to lib/nav.ts, and its body to
// lib/pages.ts. Counts are read from the example's records.
import { exampleCounts, exampleDir } from "./example.ts";

export interface WorkedExample {
  /** Its folder under examples/. */
  folder: string;
  /** Its page on this site, once it has one. Without one, its card links to the folder on GitHub. */
  page?: string;
  subject: string;
  title: string;
  question: string;
  /** Which counts of lib/example.ts to show, with their labels. */
  figures: [keyof ReturnType<typeof exampleCounts>, string][];
}

export const WORKED_EXAMPLES: WorkedExample[] = [
  {
    folder: "postgres-web-apps",
    subject: "A technical subject",
    title: "PostgreSQL for web applications",
    question: "When is PostgreSQL a sound default for a web application’s main database, and where does that default end? It cites documentation, release notes, engineering articles and papers. An AI model made it, and no person has reviewed it.",
    figures: [["cited", "works cited"], ["citations", "citations"], ["claims", "claims recorded"]],
  },
  {
    folder: "coral-reefs",
    page: "darwin.html",
    subject: "History of science",
    title: "Darwin and coral reefs",
    question: "A real book from 1842, followed from its title page to four checked quotations. An AI model made it, and no person has confirmed its facts.",
    figures: [["works", "works held"], ["cited", "work cited"], ["citations", "citations"]],
  },
];

const REPOSITORY = "https://github.com/DocumentDrivenDX/stemma";

/** The cards of the worked examples. */
export function exampleCards(): string {
  return `<ul class="cards" aria-label="Worked examples">${WORKED_EXAMPLES.map((e) => {
    const counts = exampleCounts(exampleDir(e.folder));
    const link = e.page ? `<a class="card-link" href="${e.page}">Follow the ${e.title} example</a>`
      : `<a class="card-link" href="${REPOSITORY}/tree/main/examples/${e.folder}">Read the ${e.title} example on GitHub</a>`;
    return `<li class="card"><p class="card-subject">${e.subject}</p><h3>${e.title}</h3><p>${e.question}</p>${numbers(e.figures.map(([key, label]) => [counts[key], label]))}<p>${link}</p></li>`;
  }).join("")}</ul>`;
}

/** A short row of large figures, each read from records or a run, with its label. */
export const numbers = (figures: [number, string][]): string =>
  `<dl class="numbers">${figures.map(([value, label]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("")}</dl>`;

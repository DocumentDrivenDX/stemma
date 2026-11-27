// A worked example's page is listed here and in lib/examples.ts, with its body
// in lib/pages.ts.
// The page list, kept apart from the page bodies so that the browser tests,
// which may run under a different loader, can read it on its own.
export const PAGES = [
  { file: "index.html", nav: "What Stemma is", title: "Stemma", description: "Create academically rigorous research reports and books on technical subjects with Claude. Stemma checks citations and quotations against the sources in your project. Pre-release." },
  { file: "how.html", nav: "How it works", title: "How it works", description: "The research cycle with Stemma, step by step, and where your material lives." },
  { file: "install.html", nav: "Get started", title: "Get started", description: "Install the Stemma plugin, then ask Claude in plain words." },
  { file: "checks.html", nav: "Checks", title: "What gets checked", description: "What each check looks at and what passing it does not tell you." },
  { file: "postgres.html", nav: "PostgreSQL example", title: "Worked example: PostgreSQL for web applications", description: "A research report on a technical question, followed from its thesis to one documentation page, and to what its checks leave open." },
  { file: "darwin.html", nav: "Darwin example", title: "Worked example: Darwin and coral reefs", description: "A real book from 1842, followed from its title page to four checked quotations." },
  { file: "examples.html", nav: "Examples", title: "Examples", description: "Stemma at work on a made-up book, from real runs of the tool." },
  { file: "principles.html", nav: "Principles", title: "Principles", description: "What Stemma does when two reasonable choices pull apart." },
  { file: "design.html", nav: "Design", title: "Design language", description: "Identity, voice, color, type, components and accessibility." },
] as const;

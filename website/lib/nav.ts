// The page list, kept apart from the page bodies so that the browser tests,
// which may run under a different loader, can read it on its own.
export const PAGES = [
  { file: "index.html", nav: "What Stemma is", title: "Stemma", description: "Scripted citation checks and reports for scholarly books. Pre-release." },
  { file: "principles.html", nav: "Principles", title: "Principles", description: "How Stemma decides between two reasonable options." },
  { file: "quickstart.html", nav: "Quick start", title: "Quick start on macOS", description: "Run the first slice of the Stemma command line from a checkout." },
  { file: "status.html", nav: "What works today", title: "What works today", description: "What is built and what is only planned." },
  { file: "checks.html", nav: "Checks", title: "Checks reference", description: "What each check looks at and what it cannot show." },
  { file: "examples.html", nav: "Examples", title: "Examples", description: "Real command output from the demo and test fixtures." },
  { file: "darwin.html", nav: "Worked example", title: "Worked example: Darwin and coral reefs", description: "One real source, three citations, and what Stemma can and cannot check." },
  { file: "design.html", nav: "Design", title: "Design language", description: "Identity, voice, color, type, components and accessibility." },
] as const;

// The page list, kept apart from the page bodies so that the browser tests,
// which may run under a different loader, can read it on its own.
export const PAGES = [
  { file: "index.html", nav: "What Stemma is", title: "Stemma", description: "A Claude plugin: scripted citation checks and plain reports for scholarly books. Pre-release." },
  { file: "principles.html", nav: "Principles", title: "Principles", description: "How Stemma decides between two reasonable options." },
  { file: "install.html", nav: "Install and ask", title: "Install and ask Claude", description: "Install the Stemma plugin, then ask Claude in plain words." },
  { file: "checks.html", nav: "Checks", title: "Checks reference", description: "What each check looks at and what a pass does not show." },
  { file: "examples.html", nav: "Examples", title: "Examples", description: "Real command output from the demo and test fixtures." },
  { file: "darwin.html", nav: "Worked example", title: "Worked example: Darwin and coral reefs", description: "One real source, three citations, and what Stemma can and cannot check." },
  { file: "design.html", nav: "Design", title: "Design language", description: "Identity, voice, color, type, components and accessibility." },
] as const;

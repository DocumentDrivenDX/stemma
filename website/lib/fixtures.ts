// The fixtures the command line tests assert on, shown on the Examples page.
export const FIXTURES = {
  seeded: "Mistakes planted on purpose, one or more for each kind the tests expect.",
  cited: "One citation that resolves to a source that is not in the project, so it is reported as unchecked.",
  clean: "Sources recorded and nothing cited, so it is called checked clean. The label says nothing about citations.",
  manuscript: "A project with a manuscript file. Stemma does not read it, and says that it could not check.",
} as const;

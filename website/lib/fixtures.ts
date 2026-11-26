// The fixtures the command line tests assert on, shown on the Examples page.
export const FIXTURES = {
  seeded: "Mistakes planted on purpose, one or more for each kind the tests expect.",
  cited: "One citation that resolves. It stays open because some checks of cited sources are not built.",
  clean: "Sources recorded and nothing cited, so it is called checked clean. The label says nothing about citations.",
  manuscript: "A project with a manuscript file, which this version cannot read yet.",
} as const;

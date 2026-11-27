---
ddx:
  id: stemma.concerns
  type: concerns
  activity: frame
  authoring:
    home: repo
  depends_on:
    - stemma.prd
---

# Project Concerns

Project Concerns declare active cross-cutting context for downstream work.
"Library" means a concern in the HELIX concern catalog; its practices apply
except where Project Overrides changes them.

## Active Concerns

| Concern | Source | Areas | Why Active | Key Practices |
|---------|--------|-------|------------|---------------|
| typescript-bun | library; slot `language-runtime`; operator-override | all | The owner chose TypeScript on Bun only | Strict TypeScript, Bun tooling and tests, Biome, pinned lockfile |
| hexagonal-architecture | library; slot `architecture-style`; operator-override (owner decision, 2026-11-26) | all | Core rules must stay independent of apps, databases, and file tools; the command line, tests, and agent drive one core | Core owns its ports and imports no adapter; adapters do not depend on each other; only the composition root names concrete adapters; the modularity boundary check enforces the import rules |
| react-vite | library; slot `frontend-framework`; assumption | `area:ui` | The explorer builds on arras, which ships a React browser. The shipped default needs a server and does not fit an offline bundle | React client only, strict TypeScript, Tailwind alongside the arras styles, bundled build |
| e2e-playwright | library; slot `e2e-framework`; shipped-default | `area:ui` | The explorer and maps are an interactive web interface | Command-line end-to-end tests come first; each web interface function then has a Playwright test in a real browser against the built bundle |
| a11y-wcag-aa | library; shipped-default | `area:ui` | Explorer, maps, and typeset-page navigation are user interfaces | WCAG (Web Content Accessibility Guidelines) 2.2 AA; text alternatives for page images and maps |
| testing | library; shipped-default | all | Software will be implemented | Tests trace to acceptance criteria; a failing test is a defect to fix or to state at release (ADR-007) |
| verification | library; shipped-default | all | Feasibility results came from one system | Report only observed results; exercise real files and hosts at the boundary that changed |
| modularity-and-encapsulation | library; shipped-default | all | Checks, record formats, build, and explorer need separate interfaces | Explicit module boundaries behind public interfaces |
| code-shape-ceilings | library; shipped-default | all | A new code base can start with strict limits | Linter ceilings that only go down |
| security-owasp | library; assumption | all | Stemma parses untrusted Word, PDF, and library files, stores private sources, and feeds text to agents | Validate every parsed input; treat source text as data and never as instructions; audit dependencies |
| scope-discipline | library | all | Keeps the first version to the PRD | Deferred work goes to the parking lot with a revisit trigger |
| plain-file-graph ([concern](concerns/plain-file-graph/concern.md), [practices](concerns/plain-file-graph/practices.md)) | project-local; slot `datastore`; operator-override | `area:data` | Records are plain files and every database is derived | One JSON file per record, defined in UMF; rebuildable indexes |
| citation-integrity | project-local | `area:data`, `area:cli` | Every feature that creates or edits a citation, note, or claim must preserve the chain from original source to source file, passage, citation, and claim | Citation keys resolve to records; records resolve to source files tied to originals; quotations and locators are copied from passages and checked against source text |
| deterministic-checks | project-local | `area:cli`, `area:data` | Scripted checks must run without a model, offline, with stable results | Same inputs and tool versions give the same outputs; seeded-error test set per check; results carry evidence; model output is saved before any deterministic step reads it |
| honest-assurance | project-local | all | Review marks, annotations, and support verdicts can be altered by whoever can edit the files | State what each check proves; recompute scripted results at every build; never present a model verdict as verification; call an output checked clean only when nothing is open |
| report-not-gate | project-local | all | The owner chose tooling and reporting over gates and approvals | No finding stops work or a build; every finding states the problem, evidence, why it matters, and a suggested action; treat unexplained or noisy findings as defects; review and attestation stay out of the line of writing |
| cross-platform | project-local | `area:cli`, `area:data`, `area:build` | Tools must run natively on macOS, Linux, and Windows | No WSL or Docker for required features; fixed line endings and text normalization for hashes; safe file names; no shell-specific scripts; mark untested systems |
| ai-disclosure | project-local | `area:cli`, `area:data` | Reviewers and publishers need an accurate account of AI use | Record model, prompt version, role, review state, and annotations; generate the disclosure from the record; keep it separate from the book's research methodology |
| typesetting-fidelity | project-local | `area:build`, `area:ui` | Print output and browser preview must agree | Pin Typst, citeproc-js, fonts, and packages; check resolution, fonts, and bleed, reporting image problems; flag preview pages that differ from print |
| rights-and-permissions | project-local | `area:data`, `area:build`, `area:ui` | Sources and images are often copyrighted or restricted, and some places must not be located | Send hosted models only needed excerpts; no per-source gate, since project material is taken to be sendable to a model; treat rights fields as optional metadata that gate nothing; keep restricted coordinates outside the repository; a place is public unless marked restricted; leave source files out of reviewer outputs unless asked, shorten quoted source text, and report what cannot be removed; scan for stray coordinates and warn |
| family-reuse | project-local | all | Stemma belongs to the DocumentDrivenDX family | Use UMF, arras, and other family tools before writing new code; contribute gaps upstream; verify a tool's behavior before relying on it |
| plugin-distribution | project-local | `area:skill`, `area:infra` | One plugin is installed from the DocumentDrivenDX marketplace into agent hosts that differ; installing it is the only installation a person does; its command-line bundle ships in versioned release trees, not in the Stemma repository | One skill; claim only hosts that were exercised, with Claude desktop's local Code tab on macOS and Windows the only v1 promise, no desktop-app promise on Linux, and the command-line tool a test harness; publish release trees as `plugins/stemma` in the DocumentDrivenDX/plugins marketplace repository; set up pinned, verified tools in the plugin data directory with no step for the author; prevent runtime package downloads |
| lightweight-verification | project-local | `area:infra` | The project's test automation must not cost money or block progress | Local script during development; three systems on release tags, advisory; no paid model calls in automation (ADR-007) |

Slots left unfilled: `auth-provider` (no accounts) and `deploy-target` (a plugin
is distributed, not deployed).

Considered and not selected:

- `o11y-otel`: Stemma is a local tool, not a running service. Check reports are
  its diagnostics.
- `ux-interaction-patterns`: considered. The design system and flows state the
  interaction rules for the chat turns and the explorer. Reconsider if the
  explorer gains editing or a larger interactive surface.
- `relational-data-modeling`: SQLite holds a derived index. Reconsider in the
  graph engine design if its schema becomes a long-lived interface.
- `i18n-icu`: the requirements cover multilingual sources, not a translated
  interface. Reconsider when a pilot needs one.
- `mcp-server`: ADR-012 has the explorer expose itself over the Model Context
  Protocol (a protocol for connecting tools to AI hosts) as a child process of the
  author's session with read-only tools (CONTRACT-005 N). The concern's practices
  assume a deployed, operated server; reconsider for a remote transport.
- `frontend-architecture`: its server-state practices assume a backend the
  offline explorer lacks.

## Project Overrides

| Concern | Practice | Override | Authority |
|---------|----------|----------|-----------|
| typescript-bun | Quality gates run before commit and in CI | Run locally; no required CI job or blocking hook | ADR-007 |
| testing | Property, fuzz, and floor comparisons run in CI | Run locally and on release tags; results are advisory in automation | ADR-007 |
| verification | Reuse CI reports as evidence | Local run reports are the evidence; release-tag reports add the three systems | ADR-007 |
| modularity-and-encapsulation | One check command in local runs, pre-commit, and CI | One command in local runs and release-tag runs | ADR-007 |
| code-shape-ceilings | Git pre-commit hook and CI run the lint gate | Ceilings stay; the lint command runs locally and on release tags, with no required hook | ADR-007 |
| e2e-playwright | Same runs locally and in CI | Local runs, and release-tag runs where a browser is available | ADR-007 |
| a11y-wcag-aa | axe-core in CI | axe-core runs locally and on release tags | ADR-007 |
| security-owasp | Secret scanning and dependency audit as CI gates | Run both before a release | ADR-007 |
| react-vite | Backend `/api` routes, server-state library, history routing | The explorer is an offline bundle with no backend; routing must work from a local file. The local server of ADR-012 has a fixed set of calls and the same fragment routing | ADR-008, ADR-012 |

## Area Labels

- `area:cli` — command-line tools and checks
- `area:data` — corpus, record files, notes, claims, registers, indexes
- `area:build` — typesetting and rendering pipeline
- `area:ui` — explorer, maps, and typeset preview
- `area:infra` — project test automation and distribution
- `area:skill` — the plugin skill and its modes

## Concern Conflicts

| Conflict | Resolution |
|----------|------------|
| deterministic-checks vs. claim support | The support result is a saved record. The build reports its presence, currency, and findings, and does not call the model. |
| honest-assurance vs. citation-integrity | Recompute everything a script can; name what rests on a record alone in the disclosure. |
| rights-and-permissions vs. reviewer reproduction | The reviewer package leaves out source files unless the author includes them, and keeps quoted source text to short excerpts whose length is not yet set, so without the files a reviewer cannot rerun checks. |
| report-not-gate vs. rights-and-permissions | Shape outputs by exclusion and redaction; report and warn about what cannot be removed; the output is still produced. |
| rights-and-permissions vs. typescript-bun and e2e-playwright test data | Tests use synthetic or openly licensed sources only. |
| family-reuse vs. scope-discipline | Reuse or contribute only what a current requirement needs. |
| lightweight-verification vs. cross-platform | Mark a system untested until a run on it is observed. |

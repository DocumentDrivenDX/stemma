---
ddx:
  id: stemma.adr-004
  type: adr
  activity: design
  authoring:
    home: repo
  depends_on:
    - stemma.prd
---

# ADR-004: TypeScript on Bun, with any other tool pinned and recorded

## Problem

Scripted tools must run on macOS, Linux, and Windows (FR-75). Research found no
script runtime that every plugin host guarantees. Exploration and rendering code
runs in a browser.

## Decision

We will write the project's code in TypeScript. Deterministic tools run on one
pinned Bun version that the plugin obtains itself: Stemma is first and foremost
a Claude plugin, and installing it is the only installation a person does. The
plugin's launcher (`scripts/stemma.sh`) fetches the official `@oven` package for
the computer from the npm registry, checks its SHA-512 digest against the one
pinned in the launcher, unpacks only the program into the plugin's data
directory, and runs only that copy. It changes no system or shell setting. The
skill starts it, so the host's permission prompts apply; no hook downloads
anything unasked. Exploration and rendering
code is bundled for the browser. Another tool is allowed when its version is
pinned and recorded.

## Why We Chose This

### Over supporting Bun and Node
One runtime means one set of behaviors to test and support.

### Over Python
The browser code is TypeScript, and Python is not guaranteed on the hosts
either.

### Over a strict minimal-dependency rule
It would require writing a PDF text reader and a citation formatter.

## Consequences

**Good**: One language across checks and explorer; Bun runs TypeScript directly.

**Trade-offs**: First use needs the network and a download of some tens of
megabytes, which a host or sandbox may block. Windows needs a POSIX shell (Git
Bash) for the launcher; a session without one is not covered. Changing the
pinned version means changing every digest. Bun can fetch a missing package
while running, so runs must disable that. On macOS, Bun uses the system SQLite,
so pinning Bun does not pin SQLite.

**Drift signals to watch**: Any author-facing installation step beyond the
plugin; a second runtime; a check or build that downloads; an unrecorded tool.

## Validation

**Result**: partly tested
**Evidence**: The PDF text library, `pdfjs-dist` 6.5.438, is bundled and
recorded in each extraction it makes. It lists optional native packages that the
plugin does not ship (SD-002). On one macOS arm64 system, with the Claude command-line tool
2.1.236, a fresh profile and no Bun on the search path: the installed plugin's
launcher fetched and verified Bun 1.4.5 into a stand-in for the plugin data
directory and ran the installed command line. The host's substitution of that
directory into a live session, desktop apps, Linux, and Windows are untested.


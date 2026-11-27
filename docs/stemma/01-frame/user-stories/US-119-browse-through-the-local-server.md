---
ddx:
  id: US-119
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-012
---

# US-119: Browse through the local server

**Feature**: FEAT-012 — Explorer and typeset preview
**Feature Requirements**: SRV-01, SRV-02, SRV-03, SRV-04, SRV-05, SRV-06, SRV-07
**PRD Requirements**: FR-64, FR-61
**Priority**: P0

## Story

**As a** Margit, the AI-cautious humanist
**I want** Stemma to open the explorer for my whole project on my own computer
**So that** every source opens, however large the project, and I never read old records as current ones.

## Context

The offline file cuts source text to stay openable, and does not see edits. The
author's computer can serve the same views whole. Anything that listens on a port
can be reached by other pages, programs, and users, so it must give the project
to the author's own page only.

## Walkthrough

1. Margit asks to browse. The agent starts the command; her browser opens on the explorer.
2. She searches, follows links, reads her report, and opens its sources.
3. She, or the agent, changes a record. The page says the records changed, then shows the new ones.
4. When she is done, the server is stopped, or stops itself after an hour without use.

## Acceptance Criteria

- [ ] **US-119-AC1** — Given a project, when the command runs, then a browser on the same computer shows the explorer, and nothing is written in the project.
- [ ] **US-119-AC2** — Given a project whose offline file would cut source text, when she opens any passage, citation, or report quotation, then its text is there.
- [ ] **US-119-AC3** — Given the same project, when she searches and opens records, then the served explorer answers as the offline one does.
- [ ] **US-119-AC4** — Given an open page, when a record, source file, or report input changes, then no answer is given from the earlier data, the page says so, and afterwards it shows the new data.
- [ ] **US-119-AC5** — Given a request with a wrong or missing host, origin, secret, content type, or request header, a used one-time code, a cross-origin fetch or form post, an unknown path or method, or a request too large or too slow, when it arrives, then it is refused and reads nothing.
- [ ] **US-119-AC6** — Given a run, when its output, process arguments, and files are examined, then neither the secret nor, outside the private launch file, the one-time code is in them.
- [ ] **US-119-AC7** — Given a run, when its sockets and requests are observed, then it listens on 127.0.0.1 only and connects nowhere.
- [ ] **US-119-AC8** — Given the installed plugin with no packages, when the command runs, then it serves the explorer.
- [ ] **US-119-AC9** — Given an interrupt, or an hour without use, then the server and its child end and the launch file is gone.

## Edge Cases

- **The browser does not open**: The command prints the launch file's path.
- **A second tab**: A tab opened from the page keeps its access; a fresh one is told to run the command again.
- **The server stopped**: The page says so and shows nothing it had loaded.
- **A change that breaks the project**: The page says what is wrong and shows no earlier data.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Open | US-119-AC1 | Worked example | Run; open the launch file | Explorer; project unchanged |
| Whole sources | US-119-AC2 | Views past the offline cap | Open a passage | Text shown |
| Same answers | US-119-AC3 | Seeded project | Same queries both ways | Equal answers |
| Change | US-119-AC4 | Edit a record while open | Wait | Notice, then new data |
| Refusals | US-119-AC5 | Crafted requests | Send each | Refused |
| Secrets | US-119-AC6 | A run | Search output, arguments, files | Not found |
| Sockets | US-119-AC7 | A run | List sockets | Loopback listener only |
| Installed | US-119-AC8 | Plugin check | Run installed | Served |
| Stop | US-119-AC9 | Idle limit, interrupt | Wait, signal | Ended; file removed |

## Dependencies

- **Stories**: US-090; US-116; US-118.
- **Feature Spec**: FEAT-012
- **Feature Requirements**: SRV-01, SRV-02, SRV-03, SRV-04, SRV-05, SRV-06, SRV-07
- **PRD Requirements**: FR-64, FR-61
- **External**: arras static client.

## Out of Scope

- Search beyond the arras limits, originals, and MCP.
- Serving anyone on another computer, and a reviewer audience.

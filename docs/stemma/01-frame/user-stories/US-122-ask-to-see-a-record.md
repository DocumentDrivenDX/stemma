---
ddx:
  id: US-122
  type: user-stories
  activity: frame
  authoring:
    home: repo
  depends_on:
    - FEAT-012
    - US-119
---

# US-122: Ask the assistant to show a record

**Feature**: FEAT-012 — Explorer and typeset preview
**Feature Requirements**: SRV-12, SRV-13
**PRD Requirements**: FR-64, FR-61
**Priority**: P1

## Story

**As a** Margit, the AI-cautious humanist
**I want** my assistant to find a record and open it on my screen
**So that** I check a citation against its source without hunting for it.

## Context

The agent can run commands, but starting and watching a server that way is slow,
and its output is the only thing that keeps the secret out of the conversation.
MCP gives the agent tools instead. A host starts the tool server in every session,
and what a tool returns is read by a model, source text included.

## Walkthrough

1. Margit asks where her chapter's subsidence claim comes from.
2. The agent searches her records, reads the bounded source view of a citation, and tells her.
3. She asks to see it. Her browser opens on that citation.
4. When she is done, the agent stops the server, or it stops by itself.

## Acceptance Criteria

- [ ] **US-122-AC1** — Given the installed plugin, when a host starts the declared server, then it lists its tools, and before a tool is called nothing is downloaded, written, or listened on, in a project or not, with the pinned runtime or not.
- [ ] **US-122-AC2** — Given no pinned runtime or no project, when a tool is called, then it says what is missing and what to do, and does nothing else.
- [ ] **US-122-AC3** — Given a project, when the agent searches, asks for a source view, or asks for status, then it gets bounded results marked as quoted data, and the project is unchanged.
- [ ] **US-122-AC4** — Given a record of the project, when the agent opens it, then the author's browser shows that record, and the result holds neither code nor secret.
- [ ] **US-122-AC5** — Given an unknown ID, an address, a path, or an unnamed argument, when a tool is called with it, then nothing is opened or read from it.
- [ ] **US-122-AC6** — Given source text written as instructions or holding a recognized coordinate, when a tool returns it, then it stays inside the quoted data, the coordinate is withheld, and no tool can be made to write, run, fetch, or open anything but this server.
- [ ] **US-122-AC7** — Given a running server for a project, when a second is asked for, then it is refused with the first's address; the lock holds no key and is removed when the server stops.
- [ ] **US-122-AC8** — Given a closed session, an hour without use, or the stop tool, then the server and its child end.

## Edge Cases

- **Setup not run**: Every tool says so; after setup the next call works in the same session.
- **The browser does not open**: The result says to run `browse` instead; it names no launch file.
- **A host that does not load the server**: The skill uses `browse` and the offline page.

## Test Scenarios

| Scenario | AC ID | Input / State | Action | Expected Result |
|----------|-------|---------------|--------|-----------------|
| Quiet start | US-122-AC1 | Installed copy; empty directory | Start, list tools | Nothing written or listening |
| Not ready | US-122-AC2 | No Bun; no project | Call each tool | Says what to do |
| Read | US-122-AC3 | Worked example | Search, view, status | Bounded, marked; unchanged |
| Open | US-122-AC4 | Stubbed opener | Open a citation | Launch file leads to it; no key in output |
| Bad input | US-122-AC5 | Addresses, paths, extra keys | Call | Refused |
| Hostile text | US-122-AC6 | Seeded instructions and coordinate | Search, view | Quoted; withheld |
| One server | US-122-AC7 | Two processes | Open in both | Second refused |
| End | US-122-AC8 | Close input; idle; stop | Wait | Ended; files removed |

## Dependencies

- **Stories**: US-116; US-119; US-120.
- **Feature Spec**: FEAT-012
- **Feature Requirements**: SRV-12, SRV-13
- **PRD Requirements**: FR-64, FR-61
- **External**: the agent host's MCP support.

## Out of Scope

- Any tool that writes. Highlighting on originals. Report quotations by ID.

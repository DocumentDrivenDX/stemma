---
ddx:
  id: stemma.adr-003
  type: adr
  activity: design
  authoring:
    home: repo
  depends_on:
    - stemma.prd
---

# ADR-003: Checks report; nothing stops the author's work

## Problem

Stemma exists to make citation errors visible. The owner rejects gates and
approvals: the tool must not refuse to let the author work while it asks them to
verify something. Humanities authors do not run CI (continuous integration), and
an agent with ordinary file access could defeat a local gate or alter a record
in any case.

## Decision

We will run checks in the agent as work changes and again at every build, and
report what they find. No citation, claim, quotation, source, support,
bibliography, image, coordinate, or working-tree finding stops writing or any
build. Every build completes; only an ordinary tool failure, such as a compile
error, stops output. A build rechecks everything with scripts, does not rerun
support verdicts, and is labelled "checked clean" only when no finding is open.
The label reflects checks only; the report counts unreviewed items separately.
Items an AI proposes take effect at once, marked unreviewed; an AI change to a
reviewed item marks it unreviewed again, and the author's own edits keep it
reviewed. Review, confirmations, and annotations happen when the author
chooses and are plain records that are not forgery-proof. Every finding says what is wrong, shows the
evidence, says why it matters, and suggests what to do. Stemma installs no
commit hook and requires no CI. Removing structured restricted values and
redacting reviewer outputs is part of constructing an output, not a gate.

## Why We Chose This

### Over blocking final builds
A block makes the author stop and satisfy the tool, including over findings that
are wrong or unexplained.

### Over acceptance steps for AI proposals
An approval in the line of writing is the same gate. A visible unreviewed mark
keeps the information without stopping work.

### Over a commit hook or required CI
Each adds setup and friction; in tests the agent defeated a commit hook in every
way tried.

### Over rerunning support verdicts at build
It adds model cost and time, and verdicts can differ between runs.

## Consequences

**Good**: The author is never stopped, and one report and label show the state
of a build.

**Trade-offs**: A book or reviewer package with open findings can be produced
and sent. It can disclose a restricted site or protected material, cite a source
with no stored copy, or hold unsupported or unreviewed claims. Nothing but the
report and the label warns of it. An altered "supported" verdict, review mark,
or annotation goes undetected. The report is only useful if its findings are few
enough and clear enough to read.

**Drift signals to watch**: Any command, skill instruction, or screen that
stops work pending verification; an output with open findings described as
checked clean; findings without an explanation or a suggested action; wording
that calls a support record verification or a review mark proof.

## Validation

**Result**: not tested
**Evidence**: Feasibility tests on one system showed gate bypass and forged
verdicts passing, while recomputed quotation and page checks caught edits. The
reporting and label design has not been tried with authors.

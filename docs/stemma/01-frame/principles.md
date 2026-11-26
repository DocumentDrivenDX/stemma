---
ddx:
  id: stemma.principles
  authoring:
    home: repo
---

# Project Principles

These principles guide judgment calls across all activities. They are lenses
applied when two valid options compete. They are not requirements or process
rules.

## Principles

1. **No source, no citation** — A citation exists only when a verified source
   record and a stored copy back it. This changes decisions when a faster path
   would accept a reference on the assistant's word.

2. **Scripts verify, models propose** — A gate never depends on a model's
   judgment. A model-based result enters a gate only as a recorded artifact that
   a script can check for presence, currency, and resolution. This changes
   decisions when a model check would be simpler than a deterministic one.

3. **The author decides** — The assistant drafts, searches, and files.
   Interpretation, structure, and disclosure stay with the author. This changes
   decisions when automation could settle an interpretive question.

4. **Exceptions are recorded, never silent** — A gate can be excepted with a
   dated, reasoned entry that appears in the disclosure. A bypass that leaves no
   record is a defect. This changes decisions when strictness and convenience
   conflict.

5. **Plain text and hashes** — Prefer files that diff, merge, and survive a
   change of tool, and identify binaries by content hash. This changes
   decisions when a proprietary or opaque format would be easier today.

6. **One source of truth** — Notes, claims, citations, and the typeset book
   derive from the same files. This changes decisions when a second copy would
   save a build step.

7. **Reproducible by a stranger** — A reviewer on a clean checkout gets the same
   check results and the same PDF. This changes decisions when a result depends
   on a local setting, a network call, or an unrecorded step.

8. **Explain every failure** — A failed check states what failed, the evidence,
   and the fix. This changes decisions for cautious users, who abandon a tool
   that refuses without explanation.

9. **Respect what is not yours to share** — Rights, permissions, and community
   data limits constrain the corpus, the build, and the reviewer package. This
   changes decisions when completeness conflicts with permission.

## Tension Resolution

- **Scripts verify, models propose vs. The author decides**: a model may flag a
  problem, and only the author or a script closes it.
- **Explain every failure vs. Plain text and hashes**: render explanations from
  structured check results; do not store prose in the data.
- **Exceptions are recorded vs. Reproducible by a stranger**: exceptions travel
  in the reviewer package, so a reviewer sees the same gate state.

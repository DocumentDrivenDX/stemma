---
ddx:
  id: stemma.principles
  type: principles
  activity: frame
  authoring:
    home: repo
---

# Project Principles

These principles guide judgment calls across all activities. They are lenses
applied when two valid options compete. They are not requirements or process
rules.

## Principles

1. **Tools and reports, not gates and approvals** — Stemma finds problems and
   explains them. It never stops the author from writing, or asks them to verify
   or approve something before they can continue. Review and attestation happen
   out of line, when the author chooses. Every finding says what is wrong, shows
   the evidence, says why it matters and suggests what to do, in plain language;
   unexplained noise is a Stemma defect. This changes decisions when a block, a
   required confirmation, or one more warning would seem the safe choice.

2. **No source, no citation** — A citation rests on a source record and a stored
   copy. The assistant never invents one, and a citation without them is shown
   as unchecked. This changes decisions when a faster path would let an
   assistant's word look like a checked reference.

3. **Scripts verify, models propose** — A scripted check never depends on a
   model's judgment. A model result counts only as a record that a script checks
   for presence, currency, and findings. This changes decisions when a model
   check would be simpler than a deterministic one.

4. **The author decides** — The assistant drafts, searches, and files, and marks
   what it wrote as unreviewed. Interpretation, structure, theoretical framing,
   method, and disclosure stay with the author. This changes decisions when
   automation could settle an interpretive question.

5. **Limits are stated** — "Checked clean" means only that the checks found
   nothing open. Review marks, annotations, confirmations, and model verdicts are
   records, not proof, and the product says so. This changes decisions when a
   stronger-sounding claim would outrun what a check shows.

6. **Plain text and hashes** — Prefer files that diff, merge, and survive a
   change of tool, and identify binaries by content hash. This changes
   decisions when a proprietary or opaque format would be easier today.

7. **One source of truth** — Notes, claims, citations, maps, and the typeset
   book derive from the same record files. This changes decisions when a second
   writable copy would save a build step.

8. **Reproducible with the same inputs** — Someone with the project, the sources
   they have rights to, and the same tool versions gets the same scripted check
   results. This changes decisions when a result depends on a local setting, a
   network call, or an unrecorded step.

9. **Respect what is not yours to share** — Rights, permissions, restricted
   locations, and community data limits shape the corpus and what goes into
   outputs that leave the project. Material that may not be sent to a language
   model does not belong in a project that uses a hosted one; Stemma does not
   filter it by source. This changes decisions when completeness conflicts with
   permission.

10. **Deliverable over machinery** — Ship what authors use. Bound the process
    around it, freeze it, and deliver; reuse a family tool before building a new
    one. Real defect checks stay. This changes decisions when new checks,
    reviews, or automation would delay working behavior without catching a
    material defect.

11. **The plugin is the product** — Stemma is first and foremost a Claude
    plugin. Every other part is designed to support it. Installing the plugin is
    the only installation a person does; the plugin and Claude obtain and set up
    whatever else it needs, from pinned and verified downloads, within the
    host's permission prompts. This changes decisions when a feature would ask
    the author to install, configure, or type something.

## Tension Resolution

- **Tools and reports vs. No source, no citation**: report the unsupported
  citation plainly and keep it visible; do not stop the writing.
- **Tools and reports vs. Limits are stated**: let every build finish, and never
  call one with open findings checked clean.
- **Tools and reports vs. Respect what is not yours to share**: shape outputs by
  leaving restricted values out and redacting; warn about what cannot be
  removed.
- **Scripts verify, models propose vs. The author decides**: a model may flag a
  problem; the author or a changed script result resolves it.
- **Tools and reports vs. Plain text and hashes**: render explanations from
  structured check results; do not store prose in the data.
- **Limits are stated vs. Reproducible with the same inputs**: annotations and
  confirmations are record files in the project, so a rebuild sees the same
  ones.
- **One source of truth vs. Respect what is not yours to share**: restricted
  values stay outside the repository and are referenced, not copied.
- **Deliverable over machinery vs. No source, no citation**: keep every check
  that exposes a bad citation; cut automation that only guards the project's own
  process.

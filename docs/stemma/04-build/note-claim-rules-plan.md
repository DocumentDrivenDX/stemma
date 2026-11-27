# Implementation plan: iteration 2, note and claim rules and review marks

FR-20, FR-21, FR-23. Planned by an Opus pass over the code.

## Already built

The note extract check, `source.changed` through notes and claims, the review
schema and reference checks, digest-aware `unreviewed` export states, `retire`.

## Defects to fix

1. `unreviewedItems` (`core/src/run.ts`) looks only at `review.state`, so an
   edited reviewed claim counts as reviewed in the report while the export says
   unreviewed; it also omits a claim's evidence (CONTRACT-002 C).
2. `record add` writes notes and claims with no `review`, which the schema
   requires, so those records are invalid.
3. `record.valid` lacks the rule that an extract or paraphrase note names at
   least one passage (CONTRACT-001 G).

## Excluded

Takeover, rounds, manuscript-reading checks (iterations 1, 3, 6 to 8, 27);
`quote.self`, `claim.inactive`, `cite.unlinked`, `support.current`, and
inference, construct and method rules (9, 13); no record edit command.

## Steps, one commit each, with tests

1. Specs: CONTRACT-002 B and C (`claim.complete` reasons and unverifiable case;
   `reviewed --actor person:<name>`, model and software refused; the
   `unreviewed list` JSON), CONTRACT-005 J.
2. Records: `note_without_passage` with plain-language text; add note, claim and
   attestation to `FULLY_CHECKED_KINDS` (others stay out).
3. One review rule, `core/src/review.ts`: reviewed only when the state says so
   and `content_sha256` equals the current item digest. Use it in
   `unreviewedItems` and `states.ts`; reach goes from cited claims to live
   attestations and evidence notes, through one function iteration 1 can extend.
4. `claim.complete` (`checks/claims.ts`): a live claim passes with confidence, a
   reason, and a live attestation whose evidence is a live note; otherwise
   `claim_incomplete` listing what is missing (note, confidence, reason).
   `unverifiable record_unreadable` when no live note is reached and a related
   file is unreadable. Message, why and suggestion; never ask for review. Add to
   state checks.
5. `record add`: default `review` to unreviewed; reviewed from a model or
   software actor exits 5; from a person, fill digest and decision.
6. `unreviewed list` (every live record whose mark does not apply, with its
   origin text shown as data; writes nothing) and
   `reviewed <id@sha256>... --actor person:<name>` (batch token for several;
   unknown, retired or review-less exit 5; a stale digest leaves that record
   unmarked, marks the rest, exits 5). Output calls a mark what the author said,
   not proof.
7. Skill: both commands; run `reviewed` only when the author names the items;
   never ask for review before continuing.

## Chosen defaults, open to the product owner

The thesis claim is not exempt from `claim.complete`; confidence is low, medium
or high; a note is required and its stance does not matter; no edit command, so
FR-23's "an author's edit keeps the mark" is not met (a hand edit reads
unreviewed, per CONTRACT-001 G); a stale ID in a batch does not stop the others.

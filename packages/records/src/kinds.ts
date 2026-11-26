// Record kinds, ID prefixes, and directories (CONTRACT-001 C).
export const KINDS: Record<string, { prefix: string; directory: string }> = Object.fromEntries(
  (
    [
      ["source", "src-", "sources"], ["agent", "agt-", "agents"], ["capture", "cap-", "captures"],
      ["extraction", "ext-", "extractions"], ["passage", "psg-", "passages"], ["note", "nte-", "notes"],
      ["claim", "clm-", "claims"], ["attestation", "att-", "attestations"], ["inference", "inf-", "inferences"],
      ["construct", "con-", "constructs"], ["method", "mth-", "methods"], ["chapter", "chp-", "chapters"],
      ["citation", "cit-", "citations"], ["intake_item", "itm-", "intake-items"],
      ["round_choice", "chc-", "round-choices"], ["review_comment", "rvc-", "review-comments"],
      ["place", "plc-", "places"], ["place_name", "pnm-", "place-names"],
      ["place_location", "loc-", "place-locations"], ["place_assertion", "pas-", "place-assertions"],
      ["search", "sch-", "searches"], ["decision", "dec-", "decisions"],
      ["support_record", "sup-", "support-records"], ["annotation", "ann-", "annotations"],
      ["resolution", "res-", "resolutions"], ["import_batch", "imp-", "imports"],
      ["confirmation", "cnf-", "confirmations"], ["plan", "pln-", "plans"],
      ["checkpoint_input", "ckp-", "checkpoint-inputs"], ["authorship_mark", "aum-", "authorship-marks"],
      ["ai_activity", "act-", "ai-activities"], ["voice_profile", "vop-", "voice-profiles"],
      ["voice_example", "vex-", "voice-examples"], ["governing_record", "gvr-", "governing-records"],
      ["governing_entry", "gve-", "governing-entries"], ["ai_role", "rol-", "ai-roles"],
      ["audit_finding", "aud-", "audit-findings"], ["review_baseline", "rbl-", "review-baselines"],
      ["image", "img-", "images"], ["conversion", "cnv-", "conversions"],
    ] as const
  ).map(([kind, prefix, directory]) => [kind, { prefix, directory }]),
);

export const RECORD_SCHEMA = "stemma.record/0";
export const PROJECT_SCHEMA = "stemma.project/0";
export const PROJECT_FORMAT = 0;

export function recordPath(kind: string, id: string): string {
  return `records/${KINDS[kind]!.directory}/${id}.json`;
}

export function isRecordId(kind: string, id: string): boolean {
  const prefix = KINDS[kind]?.prefix;
  return prefix !== undefined && id.startsWith(prefix) && /^[0-9a-z]{8,40}$/.test(id.slice(prefix.length));
}

/** Kinds for which this version checks every CONTRACT-001 rule it knows to apply. */
export const FULLY_CHECKED_KINDS = new Set(["source", "citation", "agent"]);

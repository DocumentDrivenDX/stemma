// The stemma.check-report/0 shapes (CONTRACT-002 C and E).
import type { Coverage } from "./verification.ts";

export type Outcome = "pass" | "fail" | "unverifiable";

export interface Evidence { name: string; class: "source_text" | "manuscript" | "metadata" | "location"; value: string }

export interface Result {
  finding_key: string;
  check: string;
  outcome: Outcome;
  reason_code?: string;
  subject: string;
  sentence?: { text: string; sha256: string };
  source?: string;
  item?: { record: string; content_sha256: string };
  evidence: Evidence[];
  fixes: string[];
  rules: string[];
  message: string;
  why: string;
  suggestions: string[];
  annotations: { id: string; effect: string }[];
  /** A person's source-details review that covers what could not be compared. */
  confirmed_by?: string;
  open: boolean;
}

/** A check that applies to the project and that this version cannot run. */
export interface NotRun { check: string; reason: "not_implemented" }

export interface Unreviewed { record: string; kind: string; reason: "unreviewed" | "not_admitted"; locations: string[] }

export interface Summary {
  pass: number; fail: number; unverifiable: number; open: number; dismissed: number; confirmed: number;
  unreviewed: number; could_not_check: number; not_implemented: number;
}

export interface ReportBody {
  mode: "work";
  scope: "all";
  changed: string[];
  inputs: { corpus_sha256: string; manuscript: { path: string; sha256: string }[]; research: { path: string; sha256: string }[]; profiles: string[] };
  tools: Record<string, string>;
  results: Result[];
  not_run: NotRun[];
  /** What has been compared with and reviewed for each source file. Not findings. */
  verification: Coverage[];
  unreviewed: Unreviewed[];
  redaction: "none";
  label: "checked_clean" | "open_findings";
  summary: Summary;
}

export interface CheckReport {
  schema: "stemma.check-report/0";
  body: ReportBody;
  run: { started: string; duration_ms: number; platform: string };
}

// Said last by `dev.sh check`: some tests are skipped where this machine lacks
// what they need, and a passing run must not read as covering them. Without
// headless Chromium the tests that open the explorer page are skipped; without
// the text that the PostgreSQL example does not commit, those that need it are.
// It never fails the run for either.
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { textMissingHere } from "../website/lib/held.ts";

const missing = textMissingHere(join(import.meta.dir, "../examples/postgres-web-apps"));
if (missing.length > 0) {
  console.log(`NOT TESTED WITH ALL ITS TEXT: the PostgreSQL example. This copy does not hold the text of ${missing.join(", ")}, so the recorded run with all the text was not compared with a fresh one, and whether its report is current was not tested. examples/postgres-web-apps/README.md says how to fetch the text.`);
}

try {
  await (await chromium.launch()).close();
} catch (error) {
  if (!String(error).includes("Executable doesn't exist")) throw error;
  console.log("NOT TESTED IN A BROWSER: the explorer page. Its browser tests were skipped because headless Chromium is not fetched. Run ./scripts/dev.sh browsers, then check again.");
}

// Said last by `dev.sh check`: without headless Chromium the tests that open the
// explorer page are skipped, and a passing run must not read as covering them.
// It never fails the run for that.
import { chromium } from "@playwright/test";

try {
  await (await chromium.launch()).close();
} catch (error) {
  if (!String(error).includes("Executable doesn't exist")) throw error;
  console.log("NOT TESTED IN A BROWSER: the explorer page. Its browser tests were skipped because headless Chromium is not fetched. Run ./scripts/dev.sh browsers, then check again.");
}

// Browser tests of the built website. Run with ./scripts/dev.sh e2e, which
// builds first. Everything written goes into the git-ignored .tools/.
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.STEMMA_E2E_PORT ?? 4317);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  outputDir: join(import.meta.dirname, "../.tools/playwright-results"),
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${PORT}/` },
  webServer: {
    command: `"${process.execPath}" --no-install --no-env-file --config=/dev/null preview.ts`,
    cwd: import.meta.dirname,
    url: `http://127.0.0.1:${PORT}/`,
    env: { PORT: String(PORT) },
    reuseExistingServer: false,
  },
});

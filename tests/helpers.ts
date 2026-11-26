import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "bun:test";

export const ROOT = join(import.meta.dir, "..");

const made: string[] = [];
afterAll(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

export function temporary(): string {
  const dir = mkdtempSync(join(tmpdir(), "stemma-test-"));
  made.push(dir);
  return dir;
}

export function fixture(name: string, parent = temporary()): string {
  const dir = join(parent, name);
  cpSync(join(ROOT, "fixtures", name), dir, { recursive: true });
  return dir;
}

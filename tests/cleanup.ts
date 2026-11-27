// Preloaded by `./scripts/dev.sh check`. A hook registered in a helper module
// runs after only the first file that imports it, so the cleanup is here.
import { afterAll } from "bun:test";
import { removeTemporaries } from "./helpers.ts";

afterAll(removeTemporaries);

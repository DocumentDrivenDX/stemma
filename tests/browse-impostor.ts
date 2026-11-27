// Another program that takes the port a served explorer has left (US-119-AC10).
import { expect } from "bun:test";
import type { Page } from "@playwright/test";
import { notice, stored, takenDown } from "./browse-page.ts";

export const FAKE = "FAKE RECORD FROM ANOTHER PROGRAM";

/** What the page asked of another program, which answers every call with 200 and data of the right shape. */
export interface Impostor {
  asked: { path: string; headers: Record<string, string>; body: string }[];
  stop(): void;
}

export type Answer = (path: string) => { body: string; proof?: string | undefined };

/** Data as the real server would give it, naming the data the page loaded. */
export const plausible = (identity: string): Answer => (path) => ({
  body: JSON.stringify(path === "/api/session" ? { secret: "A".repeat(43) }
    : path === "/api/status" ? { state: "current", data_identity: identity }
    : { data_identity: identity, result: path === "/api/boot" ? { banner: { warnings: [FAKE] }, manuscript_state: "none" } : { data: { marker: FAKE }, errors: [] } }),
});

/** Takes the port a server has just left. */
export function impostor(address: string, answer: Answer): Impostor {
  const asked: Impostor["asked"] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1", port: Number(new URL(address).port),
    async fetch(request) {
      const path = new URL(request.url).pathname;
      asked.push({ path, headers: Object.fromEntries(request.headers), body: await request.text() });
      const { body, proof } = answer(path);
      return new Response(body, { headers: { "content-type": "application/json", ...(proof === undefined ? {} : { "x-stemma-proof": proof }) } });
    },
  });
  return { asked, stop: () => void server.stop(true) };
}

/**
 * The page has said it stopped, shows and keeps nothing, and asks no more. The
 * page must be on Playwright's clock (`watched(browser!, { clock: true })`): its
 * clock is moved on 4.5 s, past two of its 2-second polls, at once.
 */
export async function givenUp(page: Page, other: Impostor, kept: string[]) {
  await notice(page, "Stemma’s server has stopped").waitFor({ timeout: 15_000 });
  await takenDown(page);
  expect(await page.content()).not.toContain(FAKE);
  expect(await page.title()).toBe("Stemma explorer");
  expect(Object.keys((await stored(page)).session)).toEqual([]);
  const so = other.asked.length;
  await page.clock.runFor(4500);
  // Time for a request a timer began to arrive.
  await Bun.sleep(250);
  expect(other.asked.length).toBe(so);
  // It was sent signatures, never a key.
  expect(other.asked.length).toBeGreaterThan(0);
  for (const key of kept) expect(JSON.stringify(other.asked).includes(key)).toBe(false);
}

// The run's secret and its one-time code (CONTRACT-005 M, rules 6 to 8).
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const CODE_MINUTES = 10;

const digest = (text: string) => createHash("sha256").update(text, "utf8").digest();
/** Compared as digests, so that neither the time nor a length check tells how much of a guess was right. */
const same = (a: string, b: Buffer) => timingSafeEqual(digest(a), b);

export interface Session {
  /** The one-time code, for the launch file only. */
  readonly code: string;
  /** The secret, once, for the right code in time; nothing otherwise. A wrong code uses nothing up. */
  exchange(code: string): string | undefined;
  allows(secret: string | undefined): boolean;
  /** Ends the code's life: it is refused from now on. */
  expire(): void;
}

/** `onCodeGone` runs once, when the code is used or expires, so that the launch file can be removed. */
export function createSession(onCodeGone: () => void = () => {}, lifeMs = CODE_MINUTES * 60_000, now: () => number = Date.now): Session {
  const code = randomBytes(32).toString("base64url");
  const secret = randomBytes(32).toString("base64url");
  const codeDigest = digest(code);
  const secretDigest = digest(secret);
  const until = now() + lifeMs;
  let live = true;
  const expire = () => {
    if (!live) return;
    live = false;
    clearTimeout(timer);
    onCodeGone();
  };
  const timer = setTimeout(expire, lifeMs);
  timer.unref();
  return {
    code,
    exchange(given) {
      const right = same(given, codeDigest);
      if (now() >= until) expire();
      if (!live || !right) return undefined;
      expire();
      return secret;
    },
    allows: (given) => given !== undefined && same(given, secretDigest),
    expire,
  };
}

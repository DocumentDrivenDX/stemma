// The run's secret and its one-time code (CONTRACT-005 M, rules 6, 7 and
// "Proofs"). Neither is ever received: a request is signed with one of them, and
// the answer is proved with the same one.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { MAC_SHAPE, NONCE_SHAPE, requestMessage, responseMessage, TAGS, type TagPair } from "../../core/src/browse-proof.ts";

export const CODE_MINUTES = 10;
/**
 * How far a call's nonce time may be from the server's clock, either way, and
 * the most nonces remembered at once. Only a call signed with the secret is
 * remembered, until its time is too old to be accepted, so nothing without the
 * secret can use this memory.
 */
export const NONCES = { windowMs: 60_000, most: 50_000 };

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest();
const hmac = (key: string, message: Uint8Array) => createHmac("sha256", key).update(message).digest();

/** A request as it arrived, with what its two signing headers hold. */
export interface Signed {
  method: string;
  path: string;
  body: Uint8Array;
  nonce: string;
  mac: string;
}

/** The proof of an answer to one signed request. */
export type Prove = (status: number, body: string | Uint8Array) => string;

function signedWith(key: string, tags: TagPair, request: Signed): boolean {
  if (!NONCE_SHAPE.test(request.nonce) || !MAC_SHAPE.test(request.mac)) return false;
  const right = hmac(key, requestMessage(tags, request.method, request.path, sha256(request.body), request.nonce));
  const given = Buffer.from(request.mac, "base64url");
  return given.length === right.length && timingSafeEqual(given, right);
}

const proverOf = (key: string, tags: TagPair, { nonce, path }: Signed): Prove =>
  (status, body) => hmac(key, responseMessage(tags, nonce, path, status, sha256(typeof body === "string" ? Buffer.from(body, "utf8") : body))).toString("base64url");

export type Redeemed = { prove: Prove } & ({ secret: string } | { refused: "code_used" | "code_expired" });
export interface Admitted {
  prove: Prove;
  /** `replayed` covers a nonce seen before and one whose time is outside the window. */
  verdict: "accepted" | "replayed" | "too_many";
}

export interface Session {
  /** The one-time code, for the launch file only. */
  readonly code: string;
  /**
   * A request to redeem the code. Nothing for one not signed with it, which uses
   * nothing up. One signed with it gets the secret once, in time, and after
   * that is told whether the code was used or expired.
   */
  redeem(request: Signed): Redeemed | undefined;
  /** A call. Nothing for one not signed with the secret. Each nonce is accepted once. */
  admit(request: Signed): Admitted | undefined;
  /** Ends the code's life: it is refused from now on. */
  expire(): void;
}

/**
 * `onCodeGone` runs once, when the code is used or expires, with which and when,
 * so that the launch file can be removed and the author told.
 */
export function createSession(
  onCodeGone: (how: "used" | "expired", at: number) => void = () => {},
  lifeMs = CODE_MINUTES * 60_000, now: () => number = Date.now, nonces = NONCES,
): Session {
  const code = randomBytes(32).toString("base64url");
  const secret = randomBytes(32).toString("base64url");
  const until = now() + lifeMs;
  let gone: "used" | "expired" | undefined;
  const end = (how: "used" | "expired") => {
    if (gone) return;
    gone = how;
    clearTimeout(timer);
    onCodeGone(how, now());
  };
  const timer = setTimeout(() => end("expired"), lifeMs);
  timer.unref();

  /** Accepted nonces with their times, in the order they came. */
  const seen = new Map<string, number>();
  /** The latest time forgotten: nothing that old is accepted again, even if the clock is set back. */
  let forgotten = -1;
  function fresh(nonce: string): Admitted["verdict"] {
    const oldest = now() - nonces.windowMs;
    // They came nearly in the order of their times; one out of order only stays a little longer.
    for (const [old, at] of seen) {
      if (at >= oldest) break;
      seen.delete(old);
      forgotten = Math.max(forgotten, at);
    }
    const at = Number(NONCE_SHAPE.exec(nonce)![1]);
    if (at < oldest || at > now() + nonces.windowMs || at <= forgotten || seen.has(nonce)) return "replayed";
    // Full, it refuses rather than forgets one that could still be sent again.
    if (seen.size >= nonces.most) return "too_many";
    seen.set(nonce, at);
    return "accepted";
  }

  return {
    code,
    redeem(request) {
      if (!signedWith(code, TAGS.code, request)) return undefined;
      const prove = proverOf(code, TAGS.code, request);
      if (now() >= until) end("expired");
      if (gone) return { prove, refused: gone === "used" ? "code_used" : "code_expired" };
      end("used");
      return { prove, secret };
    },
    admit(request) {
      if (!signedWith(secret, TAGS.call, request)) return undefined;
      return { prove: proverOf(secret, TAGS.call, request), verdict: fresh(request.nonce) };
    },
    expire: () => end("expired"),
  };
}

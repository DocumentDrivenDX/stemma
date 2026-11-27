// What the local server and its page sign (CONTRACT-005 M, "Proofs"). Both
// sides build the bytes here; each computes the HMAC-SHA-256 with its own
// platform. Pure and browser-safe: no key and no state.

export const NONCE_HEADER = "x-stemma-nonce";
export const MAC_HEADER = "x-stemma-mac";
export const PROOF_HEADER = "x-stemma-proof";

/** A nonce: when it was made, in milliseconds since 1970, a dot, and 128 random bits in base64url. */
export const NONCE_SHAPE = /^([0-9]{1,15})\.[A-Za-z0-9_-]{22}$/;
/** 256 bits in base64url, without padding. */
export const MAC_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/**
 * The domain tags. No two uses share one, so that nothing signed for one use is
 * accepted for another. The exchange is signed with the one-time code as the
 * key, every other call with the secret.
 */
export const TAGS = {
  code: { request: "stemma-browse-1 code request", response: "stemma-browse-1 code response" },
  call: { request: "stemma-browse-1 call request", response: "stemma-browse-1 call response" },
} as const;
export type TagPair = (typeof TAGS)[keyof typeof TAGS];

/** Each field as its length in bytes (4 bytes, big-endian) and then its bytes, so that no two lists of fields give the same bytes. */
export function framed(fields: (string | Uint8Array)[]): Uint8Array<ArrayBuffer> {
  const parts = fields.map((field) => (typeof field === "string" ? new TextEncoder().encode(field) : field));
  const whole = new Uint8Array(parts.reduce((size, part) => size + 4 + part.length, 0));
  let at = 0;
  for (const part of parts) {
    new DataView(whole.buffer).setUint32(at, part.length);
    whole.set(part, at + 4);
    at += 4 + part.length;
  }
  return whole;
}

export const requestMessage = (tags: TagPair, method: string, path: string, bodyHash: Uint8Array, nonce: string) =>
  framed([tags.request, method, path, bodyHash, nonce]);

export const responseMessage = (tags: TagPair, nonce: string, path: string, status: number, bodyHash: Uint8Array) =>
  framed([tags.response, nonce, path, String(status), bodyHash]);

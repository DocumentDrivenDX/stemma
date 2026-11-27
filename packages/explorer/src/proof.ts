// The page's side of the proofs (CONTRACT-005 M), with WebCrypto: it signs what
// it sends, and gives nothing of an answer until the answer has proved that it
// comes from a holder of the same key. The key itself is never sent.
import { MAC_HEADER, MAC_SHAPE, NONCE_HEADER, PROOF_HEADER, requestMessage, responseMessage, type TagPair } from "../../core/src/browse-proof.ts";

const encoded = (text: string) => new TextEncoder().encode(text);
const sha256 = async (bytes: Uint8Array<ArrayBuffer>) => new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));

const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64url = (text: string) => Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

export const newNonce = (): string => `${Date.now()}.${base64url(crypto.getRandomValues(new Uint8Array(16)))}`;

const hmacKey = (text: string) => crypto.subtle.importKey("raw", encoded(text), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

/** The headers that sign a POST of this body to this path. */
export async function signed(keyText: string, tags: TagPair, path: string, body: string, nonce = newNonce()): Promise<Record<string, string>> {
  const message = requestMessage(tags, "POST", path, await sha256(encoded(body)), nonce);
  const mac = await crypto.subtle.sign("HMAC", await hmacKey(keyText), message);
  return { [NONCE_HEADER]: nonce, [MAC_HEADER]: base64url(new Uint8Array(mac)) };
}

/** Whether the proof is that of this answer to the request with this nonce and path. `verify` compares in constant time. */
export async function proves(keyText: string, tags: TagPair, nonce: string, path: string, status: number, body: Uint8Array<ArrayBuffer>, proof: string | null): Promise<boolean> {
  if (proof === null || !MAC_SHAPE.test(proof)) return false;
  const message = responseMessage(tags, nonce, path, status, await sha256(body));
  return crypto.subtle.verify("HMAC", await hmacKey(keyText), fromBase64url(proof), message);
}

export interface Proved {
  status: number;
  text: string;
}

export interface ProvedBytes {
  status: number;
  bytes: Uint8Array<ArrayBuffer>;
}

export type Send = (path: string, init: { headers: Record<string, string>; body: string }) => Promise<Response>;

/**
 * Sends a signed POST. Nothing is given when the answer's proof is missing or
 * wrong, whatever its status: not a byte of such an answer is read further.
 */
export async function provedBytes(send: Send, keyText: string, tags: TagPair, path: string, body: string): Promise<ProvedBytes | undefined> {
  const headers = await signed(keyText, tags, path, body);
  const response = await send(path, { headers, body });
  const bytes = new Uint8Array(await response.arrayBuffer());
  const right = await proves(keyText, tags, headers[NONCE_HEADER]!, path, response.status, bytes, response.headers.get(PROOF_HEADER));
  return right ? { status: response.status, bytes } : undefined;
}

/** The same, for an answer that is text. */
export async function provedPost(send: Send, keyText: string, tags: TagPair, path: string, body: string): Promise<Proved | undefined> {
  const got = await provedBytes(send, keyText, tags, path, body);
  return got && { status: got.status, text: new TextDecoder().decode(got.bytes) };
}

// The only network use in Stemma: fetching an original or a catalogue response
// when a command asks for it (SEC-013). HTTPS only, bounded, with redirects
// followed by hand and each address checked. Only the address and a user agent
// naming Stemma and its version are sent. A refusal is reported, never worked
// around.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const FETCH_LIMITS = { bytes: 200 * 1024 * 1024, milliseconds: 300_000, redirects: 5 };

export class FetchRefused extends Error {}

export const privateAddress = (address: string): boolean => {
  // An IPv4 address written inside IPv6 (::ffff:7f00:1, ::7f00:1, 64:ff9b::7f00:1) is judged as the IPv4 address it reaches.
  const embedded = /^(?:::(?:ffff:(?:0:)?)?|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(address);
  if (embedded) {
    const [high, low] = [parseInt(embedded[1]!, 16), parseInt(embedded[2]!, 16)];
    return privateAddress(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
  }
  const v4 =/^(?:::ffff:)?(\d+)\.(\d+)\.\d+\.\d+$/i.exec(address);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b < 128) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b < 32) || (a === 192 && b === 168) || a >= 224;
  }
  return /^(::1?$|f[cd]|fe[89ab]|ff)/i.test(address);
};

async function checkAddress(url: URL): Promise<void> {
  if (url.protocol !== "https:") throw new FetchRefused(`Only https addresses are fetched, not ${url.protocol}//.`);
  if (url.username || url.password) throw new FetchRefused("An address with a user name or password is not fetched.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let addresses: string[];
  try {
    addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  } catch {
    throw new FetchRefused(`The host ${host} could not be found.`);
  }
  if (addresses.some(privateAddress)) throw new FetchRefused(`${host} is a local or private address, which is not fetched.`);
}

export async function fetchBytes(address: string, userAgent: string, limit = FETCH_LIMITS.bytes): Promise<{ bytes: Uint8Array; status: number }> {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    throw new FetchRefused("That is not a web address.");
  }
  const signal = AbortSignal.timeout(FETCH_LIMITS.milliseconds);
  for (let hop = 0; hop <= FETCH_LIMITS.redirects; hop++) {
    await checkAddress(url);
    let response: Response;
    try {
      response = await fetch(url, { redirect: "manual", signal, headers: { "user-agent": userAgent } });
    } catch (error) {
      throw new FetchRefused(`The request to ${url.host} failed: ${error instanceof Error ? error.message : "no response"}.`);
    }
    const next = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && next) {
      url = new URL(next, url);
      continue;
    }
    if (response.status === 404) return { bytes: new Uint8Array(await response.arrayBuffer()).slice(0, 4096), status: 404 };
    if (!response.ok) throw new FetchRefused(`${url.host} answered ${response.status}, so nothing was fetched.`);
    const chunks: Uint8Array[] = [];
    let size = 0;
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      size += chunk.length;
      if (size > limit) throw new FetchRefused(`The response passed the limit of ${Math.round(limit / 1048576)} MiB.`);
      chunks.push(chunk);
    }
    return { bytes: new Uint8Array(Buffer.concat(chunks)), status: response.status };
  }
  throw new FetchRefused("Too many redirects.");
}

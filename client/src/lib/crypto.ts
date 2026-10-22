// Web Crypto helpers. Password hashing and per-channel AES-GCM encryption are
// real cryptographic operations, but keys live in the browser — this is an
// educational simulation of E2EE, not a security guarantee.

const enc = new TextEncoder();
const dec = new TextDecoder();

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

const toB64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
};

const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export function randomSalt(bytes = 16): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return toHex(a.buffer);
}

export async function sha256(input: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(input)));
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  // PBKDF2 with 100k iterations — what a real backend would do server-side.
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 100_000, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(bits);
}

/** Derive a deterministic channel key from the channel id + participant ids. */
async function channelKey(channelId: string, members: string[]): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    enc.encode([channelId, ...[...members].sort()].join("|")),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode("pulse-e2ee-v1"), iterations: 50_000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptForChannel(text: string, channelId: string, members: string[]): Promise<string> {
  const key = await channelKey(channelId, members);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(text));
  return `${toB64(iv)}.${toB64(ct)}`;
}

export async function decryptForChannel(payload: string, channelId: string, members: string[]): Promise<string> {
  const [iv, ct] = payload.split(".");
  const key = await channelKey(channelId, members);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv) }, key, fromB64(ct));
  return dec.decode(pt);
}

/** Signal-style "safety number": 12 groups of 5 digits derived from both identities. */
export async function safetyNumber(a: string, b: string): Promise<string[]> {
  const hex = await sha256([a, b].sort().join(":") + ":pulse-safety");
  const hex2 = await sha256(hex);
  const digits = (hex + hex2).replace(/[a-f]/g, (c) => String(c.charCodeAt(0) % 10));
  return Array.from({ length: 12 }, (_, i) => digits.slice(i * 5, i * 5 + 5));
}

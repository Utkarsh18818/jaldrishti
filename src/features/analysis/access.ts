import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const sessionCookie = "jaldrishti-analysis-session";
export const sessionSeconds = 8 * 60 * 60;
export function equalSecret(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}
export function issueSession(secret: string, now = Date.now()): string {
  const payload = `${now + sessionSeconds * 1000}.${randomBytes(16).toString("hex")}`;
  return payload + "." + createHmac("sha256", secret).update(payload).digest("hex");
}
export function validSession(value: string, secret: string, now = Date.now()): boolean {
  if (secret.length < 32 || !/^\d+\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(value)) return false;
  const [expires, nonce, signature] = value.split(".");
  const expiry = Number(expires);
  return expiry > now && expiry <= now + sessionSeconds * 1000 &&
    equalSecret(signature, createHmac("sha256", secret).update(`${expires}.${nonce}`).digest("hex"));
}
export function cookieValue(request: Request): string {
  return request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith(sessionCookie + "="))?.slice(sessionCookie.length + 1) ?? "";
}
export function approvedOrigin(request: Request, configured?: string): boolean {
  let target: URL;
  try { target = new URL(configured || request.url); } catch { return false; }
  if (target.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(target.hostname)) return false;
  // Public production hosting must set its exact HTTPS origin. Loopback remains testable.
  if (!configured && !["localhost", "127.0.0.1"].includes(target.hostname)) return false;
  return request.headers.get("origin") === target.origin;
}
export async function boundedBody(request: Request, maxBytes: number): Promise<string> {
  if (Number(request.headers.get("content-length")) > maxBytes) throw new RangeError("Request too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new RangeError("Request body required.");
  let size = 0;
  const parts: Uint8Array[] = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new RangeError("Request too large."); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(parts).toString("utf8");
}

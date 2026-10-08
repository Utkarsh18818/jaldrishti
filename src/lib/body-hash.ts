// Hash the exact serialized UTF-8 payload; this never contains AWS credentials.
export async function jsonBody(payload: unknown) {
  const body = JSON.stringify(payload);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  return { body, headers: { "content-type": "application/json", "x-amz-content-sha256": hash } };
}

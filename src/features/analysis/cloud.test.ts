import { test } from "node:test";
import assert from "node:assert/strict";
import { valued, assertNoDemo } from "./provenance.ts";
import type { RealAnalysis } from "./model.ts";
import { runAnalysis } from "./model.ts";
import { parseCSV } from "./records.ts";
import { createAnalysisCampus, parseAnalysisCampus } from "./contract.ts";
import { createRealClient, parseRealForecast, parseRegionalEnvelope, recordsSummary } from "./client.ts";
import { createAnalysisGateway } from "./server.ts";
import { issueSession, validSession, sessionCookie, approvedOrigin } from "./access.ts";
import { createHandler } from "../../../infra/lambda/handlers.ts";
const now = Date.parse("2026-10-08T10:00:00Z"), time = new Date(now).toISOString();
const location = { name: "Test fixture only", latitude: 18.5204, longitude: 73.8567, timezone: "Asia/Kolkata" };
function fixture(): RealAnalysis {
  const input = (n: number) => valued(n, "USER_PROVIDED", "Automated fixture, not a measured reading", time);
  return { mode: "REAL_ANALYSIS", location: valued(location, "USER_PROVIDED", "Test location", time), readingTimestamp: time,
    capacity: input(80000), storage: input(42000), supply: input(9000), demand: input(14000), population: input(12), demandMethod: "entered", additionalLoss: input(0),
    reserve: valued({ kind: "volume", essentialFraction: 0.5, essentialReserveHours: 24, warningReserveHours: 48, volumeLitres: 7000 }, "USER_PROVIDED", "Test explicit policy", time),
    records: parseCSV(`timestamp,consumption_liters,zone\n${time},14000,site`).records };
}
const secret = "a".repeat(64), backend = "b".repeat(64), code = "c".repeat(64);
const session = issueSession(secret, now);
const cookie = `${sessionCookie}=${session}`;
function gateway(fetcher?: typeof fetch) { return createAnalysisGateway({ baseUrl: "https://example.execute-api.ap-southeast-2.amazonaws.com", backendToken: backend, accessCode: code, sessionSecret: secret, now: () => now, fetcher }); }
function request(path = "campus", method = "GET", body?: unknown, auth = true, origin = "http://127.0.0.1:3000") {
  return new Request(`http://127.0.0.1:3000/api/real-analysis/${path}`, { method, headers: { origin, ...(auth ? { cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
test("signed sessions reject tampering, expiry and missing configuration", () => {
  assert.ok(validSession(session, secret, now));
  assert.ok(!validSession(session.replace(/^\d/, "0"), secret, now));
  assert.ok(!validSession(session, secret, now + 8 * 3600000));
  assert.ok(!validSession(session, "", now));
  assert.ok(!validSession(session, "d".repeat(64), now));
});
test("private session uses HttpOnly SameSite cookies and never returns a secret", async () => {
  const g = gateway();
  const r = await g.session(request("session", "POST", { accessCode: code }, false));
  assert.equal(r.status, 200);
  const c = r.headers.get("set-cookie")!;
  assert.match(c, /HttpOnly; SameSite=Strict; Path=\/api; /);
  assert.ok(!c.includes(code) && !c.includes(backend));
  assert.deepEqual(await r.json(), { authenticated: true });
  const logout = await g.session(request("session", "POST", { action: "logout" }));
  assert.match(logout.headers.get("set-cookie")!, /Max-Age=0/);
});
test("wrong access codes, brute-force window and cross-origin writes are rejected", async () => {
  const g = gateway();
  assert.equal((await g.session(request("session", "POST", { accessCode: code }, false, "https://attacker.example"))).status, 403);
  for (let i = 0; i < 10; i++) assert.equal((await g.session(request("session", "POST", { accessCode: "wrong" }))).status, 401);
  assert.equal((await g.session(request("session", "POST", { accessCode: code }))).status, 429);
  assert.ok(!approvedOrigin(new Request("https://hosted.example/api", { headers: { origin: "https://hosted.example" } })));
  assert.ok(approvedOrigin(new Request("https://hosted.example/api", { headers: { origin: "https://hosted.example" } }), "https://hosted.example"));
  assert.ok(!approvedOrigin(new Request("http://hosted.example/api", { headers: { origin: "http://hosted.example" } }), "http://hosted.example"));
  assert.ok(!approvedOrigin(request(), "invalid-origin"));
});
test("proxy fails closed and never contacts AWS for anonymous or Sample Demo requests", async () => {
  let calls = 0;
  const g = gateway(async () => { calls++; return Response.json({}); });
  assert.equal((await g.proxy(request("campus", "GET", undefined, false), "campus")).status, 401);
  assert.equal((await g.proxy(request("anything"), "anything")).status, 404);
  assert.equal((await g.proxy(request("forecast", "POST", { campusId: "pune-demo-campus", expectedVersion: 1, horizonDays: 30 }), "forecast")).status, 400);
  assert.equal((await g.proxy(request("campus", "PUT", { analysis: fixture(), expectedVersion: 0 }, true, "https://attacker.example"), "campus")).status, 403);
  assert.equal(calls, 0);
});
test("proxy restricts schema v2, validates no-demo values and bounds uploads", async () => {
  let calls = 0;
  const g = gateway(async () => { calls++; return Response.json({}); });
  const a = fixture(); a.storage.provenance.category = "DEMO_SYNTHETIC";
  assert.equal((await g.proxy(request("campus", "PUT", { analysis: a, expectedVersion: 0 }), "campus")).status, 400);
  assert.equal((await g.proxy(request("campus", "PUT", { analysis: fixture(), expectedVersion: 0, arbitrary: true }), "campus")).status, 400);
  assert.equal((await g.proxy(new Request("http://127.0.0.1:3000/api", { method: "PUT", headers: { cookie, origin: "http://127.0.0.1:3000" }, body: "x".repeat(300001) }), "campus")).status, 400);
  assert.equal(calls, 0);
});
test("authorized schema-v2 roundtrip preserves inputs, records, reserve, provenance and model versions", async () => {
  const saved = createAnalysisCampus(fixture(), 3, now);
  let headers: Headers | null = null;
  const g = gateway(async (url, init) => {
    assert.match(String(url), /\/campus\/real-site$/);
    headers = new Headers(init?.headers);
    return Response.json({ campus: saved, execution: "aws-lambda" });
  });
  const r = await g.proxy(request(), "campus");
  assert.equal(r.status, 200);
  assert.equal((headers as Headers | null)?.get("x-jaldrishti-access-token"), backend);
  assert.equal((headers as Headers | null)?.get("cookie"), null);
  const client = createRealClient({ fetcher: async (_, init) => {
    assert.equal(init?.credentials, "same-origin");
    assert.equal(new Headers(init?.headers).get("x-jaldrishti-access-token"), null);
    return Response.json(await r.clone().json());
  } });
  const restored = await client.load();
  assert.deepEqual(restored, saved);
  assert.deepEqual(recordsSummary(restored.analysis.records).records, saved.analysis.records);
  assertNoDemo(restored);
});
test("schema-v2 model version mismatch and synthetic cloud data cannot be loaded", () => {
  const a = createAnalysisCampus(fixture(), 1, now);
  assert.throws(() => parseAnalysisCampus({ ...a, modelMetadata: { ...a.modelMetadata, forecast: "other-model" } }));
  const b = structuredClone(a); b.analysis.records[0].consumption_liters!.provenance.category = "DEMO_SYNTHETIC";
  assert.throws(() => parseAnalysisCampus(b), /Synthetic/);
});
test("AWS forecast must reproduce original operational engine and contextual index", () => {
  const campus = createAnalysisCampus(fixture(), 1, now);
  const expected = runAnalysis(campus.analysis, { rainfallRatio: 0.7317, rainfallProvenance: { category: "CALCULATED", source: "Mock history", timestamp: time } });
  const envelope = { campusId: "real-site", campusVersion: 1, execution: "aws-lambda", executedAt: time, input: expected.input, baseline: expected.baseline, analysis: expected };
  assert.deepEqual(parseRealForecast(envelope, campus), expected);
  assert.throws(() => parseRealForecast({ ...envelope, campusVersion: 2 }, campus));
  const corrupted = structuredClone(envelope); corrupted.baseline.points[0].storageLitres++;
  assert.throws(() => parseRealForecast(corrupted, campus), /differs/);
});
test("environment unavailable remains explicit and wrong location/demo substitution is rejected", () => {
  const environment = { location, attemptedAt: time, weather: { status: "unavailable", data: null, issue: "rate-limit" }, history: { status: "unavailable", data: null, issue: "timeout" } };
  assert.deepEqual(parseRegionalEnvelope({ environment, execution: "aws-lambda" }, location), environment);
  assert.throws(() => parseRegionalEnvelope({ environment: { ...environment, location: { ...location, latitude: 0 } }, execution: "aws-lambda" }, location));
  assert.throws(() => parseRegionalEnvelope({ environment: { ...environment, weather: { status: "unavailable", data: {}, issue: null } }, execution: "aws-lambda" }, location));
});
test("cloud errors retain conflict/auth/rate-limit and timeout never fabricates saved state", async () => {
  for (const [status, code] of [[409, "CONFLICT"], [401, "UNAUTHORIZED"], [429, "RATE_LIMIT"], [503, "BACKEND_UNAVAILABLE"]] as const) {
    const c = createRealClient({ fetcher: async () => Response.json({ error: { code } }, { status }) });
    await assert.rejects(c.save(fixture(), 0), (e: unknown) => (e as { code: string }).code === code);
  }
  const stalled = createRealClient({ timeoutMs: 5, fetcher: () => new Promise(() => {}) });
  await assert.rejects(stalled.load(), /timed out/);
  const invalid = createRealClient({ fetcher: async () => Response.json({ execution: "local-mock", campus: createAnalysisCampus(fixture(), 1, now) }) });
  await assert.rejects(invalid.load(), /Invalid cloud/);
});
test("Lambda rejects real reads/writes/forecasts/environment without authorization before repository access", async () => {
  let reads = 0;
  const h = createHandler({ repository: { get: async () => { reads++; return null; }, put: async () => {} }, environment: { load: async () => { throw new Error(); } }, authorizeReal: () => false });
  for (const [method, path, payload] of [["GET", "/campus/real-site", null], ["PUT", "/campus/real-site", { analysis: fixture(), expectedVersion: 0 }], ["GET", "/environment/real-site", null], ["POST", "/forecast", { campusId: "real-site", expectedVersion: 1, horizonDays: 30 }]] as const) {
    const r = await h({ rawPath: path, requestContext: { http: { method } }, body: payload ? JSON.stringify(payload) : null });
    assert.equal(r.statusCode, 401);
  }
  assert.equal(reads, 0);
  assert.equal((await h({ rawPath: "/campus/pune-demo-campus", requestContext: { http: { method: "GET" } } })).statusCode, 404);
  assert.equal(reads, 1);
});
test("Lambda's actual token gate fails closed and accepts only the configured server token", async () => {
  const previous = process.env.JALDRISHTI_BACKEND_TOKEN;
  const h = createHandler({ repository: { get: async () => null, put: async () => {} }, environment: { load: async () => { throw new Error(); } } });
  const event = { rawPath: "/campus/real-site", requestContext: { http: { method: "GET" } } };
  try {
    delete process.env.JALDRISHTI_BACKEND_TOKEN;
    assert.equal((await h({ ...event, headers: { "x-jaldrishti-access-token": backend } })).statusCode, 401);
    process.env.JALDRISHTI_BACKEND_TOKEN = backend;
    assert.equal((await h(event)).statusCode, 401);
    assert.equal((await h({ ...event, headers: { "x-jaldrishti-access-token": "wrong" } })).statusCode, 401);
    assert.equal((await h({ ...event, headers: { "X-Jaldrishti-Access-Token": backend } })).statusCode, 404);
  } finally {
    if (previous === undefined) delete process.env.JALDRISHTI_BACKEND_TOKEN;
    else process.env.JALDRISHTI_BACKEND_TOKEN = previous;
  }
});

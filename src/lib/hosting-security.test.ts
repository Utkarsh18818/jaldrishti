import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { signedFetch, temporaryCredentials, validateRuntimeSecrets, invokeBackend, secretKeys } from "./aws-runtime.mjs";
import { jsonBody } from "./body-hash.ts";
import { createApiClient } from "./api-client.ts";
import { createAnalysisGateway } from "../features/analysis/server.ts";
import { issueSession, sessionCookie } from "../features/analysis/access.ts";
import { readFile } from "node:fs/promises";
const base = "https://test.execute-api.ap-southeast-2.amazonaws.com";
const credentials = { accessKeyId: "test-access", secretAccessKey: "test-secret", sessionToken: "test-temporary-token" };
for (const method of ["GET", "POST", "PUT"]) test(`SigV4 ${method} signs exact body, session token and Sydney scope`, async () => {
  const body = method === "GET" ? undefined : JSON.stringify({ location: "पुणे", method });
  await signedFetch(base + "/forecast", { method, body, headers: { "content-type": "application/json" } }, {
    credentials, now: new Date("2026-10-08T00:00:00Z"), fetcher: async (url, init) => {
      assert.equal(String(url), base + "/forecast"); assert.equal(init?.body, body);
      const headers = new Headers(init?.headers);
      assert.match(headers.get("authorization")!, /20261008\/ap-southeast-2\/execute-api\/aws4_request/);
      assert.equal(headers.get("x-amz-security-token"), credentials.sessionToken);
      assert.equal(headers.get("x-amz-content-sha256"), createHash("sha256").update(body ?? "").digest("hex"));
      assert.equal(init?.redirect, "error"); return Response.json({ ok: true });
    },
  });
});
test("AWS runtime rejects permanent or missing credentials", () => {
  assert.throws(() => temporaryCredentials({ AWS_ACCESS_KEY_ID: "x", AWS_SECRET_ACCESS_KEY: "y" }));
  assert.throws(() => temporaryCredentials({ ACCESS_KEY: "x", SECRET_ACCESS_KEY: "y" }));
});
for (const url of ["https://attacker.example/campus", base + "?x=1", "http://test.execute-api.ap-southeast-2.amazonaws.com", "https://test.execute-api.ap-south-1.amazonaws.com"])
  test(`AWS signer rejects unapproved target ${url}`, async () => { await assert.rejects(signedFetch(url, {}, { credentials })); });
test("browser body hash covers exact serialized UTF-8 bytes", async () => {
  const result = await jsonBody({ text: "पुणे", nested: [1, 2] });
  assert.equal(result.headers["x-amz-content-sha256"], createHash("sha256").update(result.body).digest("hex"));
});
function environment(): Record<string, string | undefined> {
  return Object.fromEntries(secretKeys.map((key, i) => [key, String(i).repeat(64)]));
}
test("Lambda runtime validates independent server environment secrets without changing them", () => {
  const env = environment(), before = structuredClone(env); validateRuntimeSecrets(env); assert.deepEqual(env, before);
});
for (const value of [undefined, "short", "", "1".repeat(64)])
  test("invalid or reused Lambda environment secret fails closed", () => {
    const env = { ...environment(), JALDRISHTI_ACCESS_CODE: value }, before = structuredClone(env);
    assert.throws(() => validateRuntimeSecrets(env), /Runtime secrets unavailable/); assert.deepEqual(env, before);
  });
test("runtime validation does not print secret values in errors", () => {
  assert.throws(() => validateRuntimeSecrets({}), /Runtime secrets unavailable/);
});
const secret = "s".repeat(64), code = "c".repeat(64), token = "t".repeat(64);
const cookie = `${sessionCookie}=${issueSession(secret)}`;
function req(method: string, payload?: unknown, auth = true, origin = "http://127.0.0.1:3000") {
  return new Request("http://127.0.0.1:3000/api/sample-demo/campus", { method,
    headers: { origin, ...(auth ? { cookie } : {}) }, ...(payload === undefined || method === "GET" ? {} : { body: JSON.stringify(payload) }) });
}
const demo = (fetcher: typeof fetch) => createAnalysisGateway({ baseUrl: base, backendToken: token, accessCode: code, sessionSecret: secret, fetcher });
test("demo protected reads and writes never invoke backend without session", async () => {
  const g = demo(async () => { throw new Error("Must not fetch"); });
  for (const [method, operation] of [["GET", "campus"], ["PUT", "campus"], ["POST", "forecast"], ["GET", "environment"]])
    assert.equal((await g.proxy(req(method, {}, false), operation, true)).status, 401);
});
test("demo proxy rejects real keys, arbitrary paths and cross-origin mutations", async () => {
  const g = demo(async () => { throw new Error("Must not fetch"); });
  assert.equal((await g.proxy(req("POST", { campusId: "real-site", horizonDays: 30, expectedVersion: 1 }), "forecast", true)).status, 400);
  assert.equal((await g.proxy(req("GET"), "../real-site", true)).status, 404);
  assert.equal((await g.proxy(req("PUT", {}, true, "https://attacker.example"), "campus", true)).status, 403);
  assert.equal((await g.proxy(req("PUT", { analysis: {}, expectedVersion: 0 }), "campus", true)).status, 400);
});
test("authorized demo GET and POST use fixed demo key and no-store", async () => {
  const paths: string[] = [];
  const g = demo(async (url, init) => { paths.push(String(url)); assert.equal(init?.cache, "no-store"); return Response.json({ ok: true }); });
  assert.equal((await g.proxy(req("GET"), "campus", true)).status, 200);
  assert.equal((await g.proxy(req("POST", { campusId: "pune-demo-campus", horizonDays: 30, expectedVersion: 1 }), "forecast", true)).status, 200);
  assert.deepEqual(paths, [base + "/campus/pune-demo-campus", base + "/forecast"]);
});
test("browser demo client routes through same-origin authenticated proxy", async () => {
  const client = createApiClient({ baseUrl: "/api/sample-demo", fetcher: async (url, init) => {
    assert.equal(url, "/api/sample-demo/campus"); assert.equal(init?.credentials, "same-origin");
    return Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  } });
  assert.ok(client.configured); await assert.rejects(client.loadCampus());
});
test("demo PUT validates only demo operational values and pins destination", async () => {
  const g = demo(async (url, init) => {
    assert.equal(String(url), base + "/campus/pune-demo-campus");
    assert.equal(init?.method, "PUT");
    const body = JSON.parse(String(init?.body)); assert.equal(body.expectedVersion, 1); assert.equal(body.analysis, undefined);
    return Response.json({ error: { code: "CONFLICT" } }, { status: 409 });
  });
  const payload = { values: { storageCapacity: 80000, currentStorage: 42000, population: 12, dailyDemand: 14000, expectedDailySupply: 9000 }, expectedVersion: 1, resetToDemo: false };
  assert.equal((await g.proxy(req("PUT", payload), "campus", true)).status, 409);
  assert.equal((await g.proxy(req("PUT", { ...payload, campusId: "real-site" }), "campus", true)).status, 400);
});
test("session migration and logout clear both cookie scopes", async () => {
  const g = demo(async () => Response.json({}));
  const result = await g.session(req("POST", { action: "logout" }));
  const cookies = result.headers.getSetCookie();
  assert.equal(cookies.length, 2);
  assert.match(cookies[0], /Path=\/api; Max-Age=0/);
  assert.match(cookies[1], /Path=\/api\/real-analysis; Max-Age=0/);
});
test("frontend preparation contains only Lambda resources and required execution role", async () => {
  const template = JSON.parse(await readFile(new URL("../../infra/frontend/template.json", import.meta.url), "utf8"));
  const resources = template.Resources;
  assert.equal(resources.FrontendUrl.Properties.AuthType, "AWS_IAM");
  assert.ok(Object.values(resources).every(r => ["AWS::Lambda::Function", "AWS::Lambda::Url", "AWS::IAM::Role"].includes((r as { Type: string }).Type)));
  assert.equal(Object.values(resources).filter(r => (r as { Type: string }).Type === "AWS::Lambda::Permission").length, 0);
  assert.equal(resources.Frontend.Properties.ReservedConcurrentExecutions, undefined);
  for (const key of secretKeys) assert.equal(resources.Frontend.Properties.Environment.Variables[key], undefined);
  assert.equal(resources.Frontend.Properties.Code.S3Bucket, undefined);
});
test("deployment plan keeps public access disabled and selects Lambda/DynamoDB only", async () => {
  const plan = JSON.parse(await readFile(new URL("../../infra/frontend/deployment-plan.json", import.meta.url), "utf8"));
  assert.deepEqual(plan.runtimeServices, ["Lambda", "DynamoDB"]); assert.equal(plan.deploy, false); assert.equal(plan.publicAccess, false);
});
test("Lambda startup uses LF, fixed port and runtime bootstrap", async () => {
  const script = await readFile(new URL("../../infra/frontend/run.sh", import.meta.url), "utf8");
  assert.ok(!script.includes("\r")); assert.ok(script.startsWith("#!/bin/sh\n"));
  assert.match(script, /exec node bootstrap\.mjs/); assert.match(script, /PORT=8080/);
});
for (const [method, path] of [["GET", "/campus/real-site"], ["PUT", "/campus/pune-demo-campus"], ["POST", "/forecast"]])
  test(`direct Lambda transport preserves ${method} ${path}`, async () => {
    const response = await invokeBackend("https://lambda-backend.invalid" + path, { method, body: method === "GET" ? undefined : "{}" }, {
      transport: async (url, init, options) => {
        assert.equal(options?.service, "lambda"); assert.match(String(url), /functions\/jaldrishti-real-backend\/invocations$/);
        const event = JSON.parse(String(init?.body)); assert.equal(event.rawPath, path); assert.equal(event.requestContext.http.method, method);
        return Response.json({ statusCode: 409, body: JSON.stringify({ error: { code: "CONFLICT" } }) });
      },
    });
    assert.equal(response.status, 409); assert.equal(response.headers.get("cache-control"), "no-store");
  });
test("Lambda function errors are sanitized before presentation", async () => {
  await assert.rejects(invokeBackend("https://lambda-backend.invalid/forecast", { method: "POST", body: "{}" }, {
    transport: async () => Response.json({ secret: "must-not-leak" }, { headers: { "x-amz-function-error": "Unhandled" } }),
  }), /Backend invocation unavailable/);
});
test("direct invocation rejects unknown destination or operation before AWS call", async () => {
  const transport: typeof signedFetch = async () => { throw new Error("Must not invoke"); };
  await assert.rejects(invokeBackend("https://attacker.example/forecast", { method: "POST" }, { transport }), /Unapproved/);
  await assert.rejects(invokeBackend("https://lambda-backend.invalid/campus/unknown", {}, { transport }), /Unapproved/);
  await assert.rejects(invokeBackend("https://lambda-backend.invalid/campus/real-site", {}, { env: { JALDRISHTI_BACKEND_FUNCTION_NAME: "other" }, transport }), /Unapproved/);
});

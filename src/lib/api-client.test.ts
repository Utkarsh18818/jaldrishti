import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createApiClient,
  ApiError,
  parseCampusEnvelope,
  parseForecastEnvelope,
  clipForecast,
  backendLabel,
} from "./api-client.ts";
import {
  seedCampus,
  parseCampus,
  campusId,
  campusToState,
  stateToCampus,
} from "./backend-contract.ts";
import { seedOperations } from "../features/system/model.ts";
import { createHandler } from "../../infra/lambda/handlers.ts";
const now = Date.parse("2026-10-07T08:30:00Z");
const campus = seedCampus(now),
  envelope = { campus, execution: "aws-lambda" };
test("campus serialization round-trips expected supply, location and provenance", () => {
  const decoded = parseCampus(JSON.parse(JSON.stringify(campus)));
  assert.deepEqual(campusToState(decoded), seedOperations());
  assert.equal(decoded.expectedSupply, 8000);
  assert.equal("expectedDailySupply" in decoded, false);
  assert.deepEqual(stateToCampus(campusToState(decoded), 1, now), campus);
});
test("campus parsing rejects missing, invalid values, timestamps and location", () => {
  for (const raw of [
    { ...campus, expectedSupply: undefined },
    { ...campus, currentStorage: 60000 },
    { ...campus, updatedAt: "invalid" },
    { ...campus, location: { ...campus.location, latitude: 0 } },
    { ...campus, provenance: {} },
  ])
    assert.throws(() => parseCampus(raw));
});
test("GET client validates serialized response and never sends credentials", async () => {
  let url = "",
    init: RequestInit | undefined;
  const client = createApiClient({
    baseUrl: "https://api.example.test/",
    fetcher: async (u, i) => {
      url = String(u);
      init = i;
      return Response.json(envelope);
    },
  });
  const r = await client.loadCampus();
  assert.equal(r.campus.currentStorage, 31000);
  assert.equal(url, `https://api.example.test/campus/${campusId}`);
  assert.equal(init?.credentials, "omit");
  assert.equal(init?.headers, undefined);
});
test("PUT client sends only editable values, revision and reset intent", async () => {
  let body: Record<string, unknown> = {};
  const client = createApiClient({
    baseUrl: "https://api.example.test",
    fetcher: async (_, i) => {
      body = JSON.parse(String(i?.body));
      return Response.json(envelope);
    },
  });
  await client.saveCampus(seedOperations().values, 1);
  assert.deepEqual(Object.keys(body), [
    "values",
    "expectedVersion",
    "resetToDemo",
  ]);
  assert.equal(body.expectedVersion, 1);
  assert.equal("provenance" in body, false);
});
test("conflict and unavailable responses remain explicit client errors", async () => {
  for (const [status, code] of [
    [409, "CONFLICT"],
    [503, "BACKEND_UNAVAILABLE"],
  ] as const) {
    const c = createApiClient({
      baseUrl: "https://api.example.test",
      fetcher: async () => Response.json({ error: { code } }, { status }),
    });
    await assert.rejects(
      c.loadCampus(),
      (e: unknown) => e instanceof ApiError && e.code === code,
    );
  }
});
test("offline client does not fabricate saved campus data", async () => {
  const c = createApiClient({
    baseUrl: "https://api.example.test",
    fetcher: async () => {
      throw new Error("offline");
    },
  });
  await assert.rejects(c.loadCampus(), ApiError);
});
test("client timeout bounds even a noncooperating transport", async () => {
  const c = createApiClient({
    baseUrl: "https://api.example.test",
    timeoutMs: 5,
    fetcher: () => new Promise(() => {}),
  });
  await assert.rejects(
    c.loadCampus(),
    (e: unknown) => e instanceof ApiError && e.code === "TIMEOUT",
  );
});
test("invalid response cannot be labeled connected", async () => {
  const c = createApiClient({
    baseUrl: "https://api.example.test",
    fetcher: async () => Response.json({ campus }),
  });
  await assert.rejects(c.loadCampus(), ApiError);
  assert.throws(() => parseCampusEnvelope({ campus, execution: "unknown" }));
});
test("local mode disables campus network access and production HTTP is rejected", async () => {
  const local = createApiClient();
  assert.equal(local.configured, false);
  await assert.rejects(local.loadCampus(), ApiError);
  const insecure = createApiClient({ baseUrl: "http://api.example.test" });
  await assert.rejects(insecure.loadCampus(), ApiError);
});
test("environment transport failure uses explicitly labeled local API fallback", async () => {
  const calls: string[] = [];
  const local = {
    status: "unavailable",
    snapshot: null,
    freshness: null,
    issue: "timeout",
    attemptedAt: new Date(now).toISOString(),
  };
  const c = createApiClient({
    baseUrl: "https://api.example.test",
    fetcher: async (url) => {
      calls.push(String(url));
      if (String(url).startsWith("https")) throw new Error("offline");
      return Response.json(local);
    },
  });
  const r = await c.environment();
  assert.equal(r.boundary, "LOCAL API · AWS UNAVAILABLE");
  assert.equal(r.data.snapshot, null);
  assert.equal(calls[1], "/api/environment");
});
test("AWS environmental provider errors preserve AWS boundary without automatic demo", async () => {
  const c = createApiClient({
    baseUrl: "https://api.example.test",
    fetcher: async () =>
      Response.json({
        execution: "aws-lambda",
        environment: {
          status: "unavailable",
          snapshot: null,
          freshness: null,
          issue: "rate-limit",
          attemptedAt: new Date(now).toISOString(),
        },
      }),
  });
  const r = await c.environment();
  assert.equal(r.boundary, "AWS LAMBDA");
  assert.equal(r.data.issue, "rate-limit");
});
test("frontend forecast client executes the real shared handler with a mocked repository", async () => {
  const h = createHandler({
    repository: { get: async () => campus, put: async () => {} },
    environment: {
      load: async () => ({
        status: "unavailable",
        snapshot: null,
        freshness: null,
        issue: "timeout",
        attemptedAt: new Date(now).toISOString(),
      }),
    },
    now: () => now,
    execution: "local-mock",
  });
  const c = createApiClient({
    baseUrl: "http://127.0.0.1:3100",
    fetcher: async (url, init) => {
      const r = await h({
        rawPath: new URL(String(url)).pathname,
        requestContext: { http: { method: init?.method ?? "GET" } },
        body: String(init?.body),
      });
      return new Response(r.body, { status: r.statusCode });
    },
  });
  const result = await c.forecast(1);
  assert.equal(result.execution, "local-mock");
  assert.equal(result.comparison.waterPreservedLitres, 13489);
  const clipped = clipForecast(result.comparison.intervention, 7);
  assert.equal(clipped.points.length, 8);
  assert.equal(clipped.criticalCrossing, null);
  assert.equal(result.comparison.intervention.horizonDays, 30);
});
test("forecast parser rejects malformed trajectories and preserves null crossings", async () => {
  const h = createHandler({
    repository: { get: async () => campus, put: async () => {} },
    environment: {
      load: async () => {
        throw new Error();
      },
    },
    now: () => now,
  });
  const response = await h({
    rawPath: "/forecast",
    requestContext: { http: { method: "POST" } },
    body: JSON.stringify({ campusId, horizonDays: 30, expectedVersion: 1 }),
  });
  const value = JSON.parse(response.body);
  assert.equal(
    parseForecastEnvelope(value).baseline.netDailyDeficitLitres,
    6120,
  );
  const missing = structuredClone(value);
  delete missing.input.dailySupplyLitres;
  assert.throws(() => parseForecastEnvelope(missing));
  const overCapacity = structuredClone(value);
  overCapacity.baseline.points[0].storageLitres = 50001;
  assert.throws(() => parseForecastEnvelope(overCapacity));
  value.baseline.points = [];
  assert.throws(() => parseForecastEnvelope(value));
});
test("connection labels never describe a mock backend as AWS connected", () => {
  assert.equal(backendLabel("local"), "LOCAL DEMO");
  assert.equal(backendLabel("connected", "aws-lambda"), "AWS CONNECTED");
  assert.equal(backendLabel("connected", "local-mock"), "LOCAL BACKEND TEST");
  assert.equal(backendLabel("fallback"), "BACKEND UNAVAILABLE · LOCAL DEMO");
});

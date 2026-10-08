import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { apiClient, ApiError } from "./api-client.ts";
import { createAnalysisGateway } from "../features/analysis/server.ts";
test("public demo defaults to a disconnected local engine and cannot persist", async () => {
  assert.equal(apiClient.configured, false);
  await assert.rejects(apiClient.loadCampus(), ApiError);
  await assert.rejects(apiClient.saveCampus({ storageCapacity: 80000, currentStorage: 42000, population: 12, dailyDemand: 14000, expectedDailySupply: 9000 }, 0), ApiError);
  await assert.rejects(apiClient.forecast(0), ApiError);
});
test("anonymous real and demo operations never invoke the privileged backend", async () => {
  let calls = 0;
  const gateway = createAnalysisGateway({ baseUrl: "https://lambda-backend.invalid", accessCode: "a".repeat(40), sessionSecret: "b".repeat(40), backendToken: "c".repeat(40),
    origin: "https://frontend.invalid", fetcher: async () => { calls++; throw new Error("Forbidden backend call"); } });
  for (const demo of [false, true]) for (const method of ["GET", "PUT", "POST"]) {
    const operation = method === "POST" ? "forecast" : "campus";
    const response = await gateway.proxy(new Request(`https://frontend.invalid/api/${demo ? "sample-demo" : "real-analysis"}/${operation}`, { method }), operation, demo);
    assert.equal(response.status, 401);
  }
  assert.equal(calls, 0);
});
test("public Data workspace starts with explicitly labeled offline data", async () => {
  const source = await readFile(new URL("../features/environment/workspace.tsx", import.meta.url), "utf8");
  assert.match(source, /useState<"api" \| "demo">\("demo"\)/);
  assert.match(source, /if \(mode === "demo"\) return/);
  assert.match(source, /OFFLINE DEMO/);
});
test("hosted anonymous environmental routes reject before provider work", async () => {
  for (const path of ["environment", "analysis-environment"]) {
    const source = await readFile(new URL(`../app/api/${path}/route.ts`, import.meta.url), "utf8");
    assert.ok(source.indexOf("!gateway.authenticated(request)") < source.indexOf("await provider.load"));
    assert.match(source, /status: 401/);
  }
});

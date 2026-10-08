import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeOpenMeteo,
  classifyFreshness,
  demoEnvironment,
} from "./model.ts";
import { createProvider } from "./provider.ts";
import { forecastStorage, compareIntervention } from "../forecast/model.ts";
import { evaluateScenario, scenarioPresets } from "../simulator/adapter.ts";
const now = Date.parse("2026-10-07T08:30:00Z");
function fixture() {
  return {
    latitude: 18.5,
    longitude: 73.875,
    utc_offset_seconds: 0,
    hourly_units: {
      time: "unixtime",
      rain: "mm",
      showers: "mm",
      precipitation: "mm",
    },
    hourly: {
      time: Array.from(
        { length: 120 },
        (_, i) => Date.parse("2026-10-05T00:00:00Z") / 1000 + i * 3600,
      ),
      rain: Array(120).fill(1),
      showers: Array(120).fill(0.5),
      precipitation: Array(120).fill(2),
    },
  };
}
const success: typeof fetch = async () => Response.json(fixture());
test("normalizes complete preceding-hour windows, including showers", () => {
  const s = normalizeOpenMeteo(fixture(), now);
  assert.equal(s.recentRain.value, 36);
  assert.equal(s.forecastPrecipitation.value, 48);
  assert.equal(s.recentRain.kind, "estimated");
  assert.equal(s.forecastPrecipitation.kind, "forecast");
});
test("preserves source-valid time separate from retrieval and observation", () => {
  const s = normalizeOpenMeteo(fixture(), now);
  assert.equal(s.latestAvailableEstimate, "2026-10-07T08:00:00.000Z");
  assert.equal(s.recentRain.start, "2026-10-06T08:00:00.000Z");
  assert.equal(s.forecastPrecipitation.end, "2026-10-08T08:00:00.000Z");
  assert.equal(s.fetchedAt, new Date(now).toISOString());
  assert.equal(s.observationTimestamp, null);
  assert.equal(s.modelRunTimestamp, null);
});
test("rejects missing fields, invalid units and null values", () => {
  assert.throws(() => normalizeOpenMeteo({}, now));
  const f = fixture();
  f.hourly_units.rain = "inches";
  assert.throws(() => normalizeOpenMeteo(f, now));
  const g = fixture();
  g.hourly.rain[0] = null;
  assert.throws(() => normalizeOpenMeteo(g, now));
});
test("rejects gaps, duplicates, truncated coverage, negative and nonfinite values", () => {
  for (const mutate of [
    (f: ReturnType<typeof fixture>) => {
      f.hourly.time[10] += 3600;
    },
    (f: ReturnType<typeof fixture>) => {
      f.hourly.rain[1] = -1;
    },
    (f: ReturnType<typeof fixture>) => {
      f.hourly.showers[1] = Infinity;
    },
    (f: ReturnType<typeof fixture>) => {
      f.latitude = 0;
    },
  ]) {
    const f = fixture();
    mutate(f);
    assert.throws(() => normalizeOpenMeteo(f, now));
  }
  assert.throws(() => normalizeOpenMeteo(fixture(), now + 8 * 86400000));
});
test("freshness uses source coverage and retrieval age", () => {
  const s = normalizeOpenMeteo(fixture(), now);
  assert.equal(classifyFreshness(s, now), "fresh");
  assert.equal(classifyFreshness(s, now + 7 * 3600000), "aging");
  assert.equal(classifyFreshness(s, now + 25 * 3600000), "stale");
  assert.equal(
    classifyFreshness(
      { ...s, fetchedAt: new Date(now - 30 * 3600000).toISOString() },
      now,
    ),
    "stale",
  );
});
test("successful ingestion is cached and simultaneous requests coalesce", async () => {
  let calls = 0;
  const p = createProvider({
    now: () => now,
    fetcher: async () => {
      calls++;
      return Response.json(fixture());
    },
  });
  const [a, b] = await Promise.all([p.load(), p.load()]);
  assert.equal(a.status, "available");
  assert.deepEqual(a, b);
  await p.load();
  assert.equal(calls, 1);
});
test("invalid response is unavailable without simulated substitution", async () => {
  const r = await createProvider({
    now: () => now,
    fetcher: async () => Response.json({}),
  }).load();
  assert.equal(r.issue, "invalid-data");
  assert.equal(r.snapshot, null);
});
test("HTTP 429, unavailable HTTP and network failures remain explicit", async () => {
  for (const status of [429, 503]) {
    const r = await createProvider({
      fetcher: async () => new Response(null, { status }),
      now: () => now,
    }).load();
    assert.equal(r.issue, status === 429 ? "rate-limit" : "unavailable");
    assert.equal(r.status, "unavailable");
  }
  const r = await createProvider({
    fetcher: async () => {
      throw new Error("offline");
    },
    now: () => now,
  }).load();
  assert.equal(r.snapshot, null);
});
test("timeout is bounded even when fetch does not honor abort", async () => {
  const r = await createProvider({
    timeoutMs: 5,
    now: () => now,
    fetcher: () => new Promise(() => {}),
  }).load();
  assert.equal(r.issue, "timeout");
  assert.equal(r.status, "unavailable");
});
test("failed refresh retains original source timestamps and labels stale data", async () => {
  let clock = now,
    calls = 0;
  const p = createProvider({
    now: () => clock,
    fetcher: async () =>
      ++calls === 1
        ? Response.json(fixture())
        : new Response(null, { status: 429 }),
  });
  const first = await p.load();
  clock += 26 * 3600000;
  const stale = await p.load();
  assert.equal(stale.status, "cached");
  assert.equal(stale.freshness, "stale");
  assert.equal(stale.snapshot?.fetchedAt, first.snapshot?.fetchedAt);
  await p.load();
  assert.equal(calls, 2);
});
test("offline demo is explicitly requested and labeled without public observation attribution", () => {
  const d = demoEnvironment(now);
  assert.equal(d.status, "demo");
  assert.equal(d.freshness, null);
  assert.equal(d.snapshot?.recentRain.kind, "demo");
});
test("external failure and successful context cannot change forecast or simulator regressions", async () => {
  const input = {
    capacityLitres: 50000,
    startingStorageLitres: 31000,
    dailySupplyLitres: 8000,
    dailyDemandLitres: 12500,
    dailyAnomalyLossLitres: 1620,
    warningReserveLitres: 10000,
    criticalReserveLitres: 2236,
    horizonDays: 30,
    startTimeMs: now,
  };
  const before = forecastStorage(input),
    scenario = evaluateScenario(input, scenarioPresets.recommended);
  await createProvider({ fetcher: success, now: () => now }).load();
  await createProvider({
    fetcher: async () => new Response(null, { status: 503 }),
  }).load();
  assert.deepEqual(forecastStorage(input), before);
  assert.deepEqual(
    evaluateScenario(input, scenarioPresets.recommended),
    scenario,
  );
  assert.equal(before.criticalCrossing?.day, 4.7);
  assert.equal(compareIntervention(input, 10).waterPreservedLitres, 13489);
  assert.ok(Math.abs(scenario.resilienceHours! - 99.611076923) < 1e-8);
});

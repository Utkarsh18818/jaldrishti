import { test } from "node:test";
import assert from "node:assert/strict";
import {
  valued,
  parseLocation,
  assertNoDemo,
  timestamp,
} from "./provenance.ts";
import { parseCSV, median, demandBaseline, zoneAnomalies } from "./records.ts";
import {
  realForecastInput,
  runAnalysis,
  reserveVolumes,
  waterSecurityIndex,
  indexPolicy,
} from "./model.ts";
import type { RealAnalysis } from "./model.ts";
import {
  weatherURL,
  weatherFields,
  normalizeWeather,
  normalizeHistory,
  historicalWindows,
  createRegionalProvider,
} from "./environment.ts";
import { importGroundwater } from "./groundwater.ts";
import {
  createAnalysisCampus,
  parseAnalysisCampus,
  environmentProvenance,
} from "./contract.ts";
import { evaluateScenario, scenarioPresets } from "../simulator/adapter.ts";
import { createHandler } from "../../../infra/lambda/handlers.ts";
import type { AnalysisCampus } from "./contract.ts";
const now = Date.parse("2026-10-07T10:00:00Z"),
  time = new Date(now).toISOString(),
  location = {
    name: "User test site",
    latitude: 12.97,
    longitude: 77.59,
    timezone: "Asia/Kolkata",
  };
const user = (n: number) =>
  valued(n, "USER_PROVIDED", "Test-only user input", time);
function fixture(): RealAnalysis {
  return {
    mode: "REAL_ANALYSIS",
    location: valued(
      location,
      "USER_PROVIDED",
      "User-selected coordinates",
      time,
    ),
    readingTimestamp: time,
    capacity: user(80000),
    storage: user(42000),
    supply: user(9000),
    population: null,
    demand: user(14000),
    demandMethod: "entered",
    records: [],
    additionalLoss: user(0),
    reserve: valued(
      {
        kind: "essential-hours",
        essentialFraction: 0.5,
        essentialReserveHours: 24,
        warningReserveHours: 48,
        volumeLitres: 0,
      },
      "USER_PROVIDED",
      "Explicit policy",
      time,
    ),
  };
}
function history(values: number[], zone = "site") {
  return parseCSV(
    "timestamp,consumption_liters,zone\n" +
      values
        .map(
          (v, i) =>
            new Date(now - (values.length - 1 - i) * 86400000).toISOString() +
            "," +
            v +
            "," +
            zone,
        )
        .join("\n"),
  ).records;
}
function weather() {
  const times = Array.from(
    { length: 240 },
    (_, i) => now / 1000 - 167 * 3600 + i * 3600,
  );
  return {
    latitude: 13,
    longitude: 77.5,
    hourly_units: { time: "unixtime", ...weatherFields },
    hourly: {
      time: times,
      ...Object.fromEntries(
        Object.keys(weatherFields).map((n) => [
          n,
          times.map(() => (n.startsWith("soil_") ? 0.25 : 1)),
        ]),
      ),
    },
  };
}
function archives() {
  return historicalWindows(now).map((w, i) => ({
    latitude: 13,
    longitude: 77.5,
    daily_units: { precipitation_sum: "mm", temperature_2m_mean: "°C" },
    daily: {
      time: Array.from({ length: 7 }, (_, d) =>
        new Date(Date.parse(w[0]) + d * 86400000).toISOString().slice(0, 10),
      ),
      precipitation_sum: Array(7).fill(i ? 2 : 1),
      temperature_2m_mean: Array(7).fill(i ? 25 : 27),
    },
  }));
}
test("location validates coordinates and IANA timezone", () => {
  assert.deepEqual(parseLocation(location), location);
  for (const p of [
    { latitude: 91 },
    { longitude: -181 },
    { timezone: "invalid" },
    { name: "" },
  ])
    assert.throws(() => parseLocation({ ...location, ...p }));
});
test("selected coordinates drive ECMWF query, never fixed Pune", () => {
  const q = new URL(weatherURL(location)).searchParams;
  assert.equal(q.get("latitude"), "12.97");
  assert.equal(q.get("longitude"), "77.59");
  assert.equal(q.get("models"), "ecmwf_ifs025");
});
test("ISO timestamps reject naive time and invalid calendar dates", () => {
  assert.equal(timestamp("2026-02-30T00:00:00+05:30"), false);
  assert.equal(timestamp("2026-10-07T10:00:00"), false);
  assert.equal(timestamp(time), true);
});
test("soil moisture normalization preserves fractions and depth units", () => {
  const w = normalizeWeather(weather(), location, now);
  for (const i of w.indicators.filter((i) => i.name.startsWith("soil"))) {
    assert.equal(i.value!.value, 0.25);
    assert.equal(i.unit, "m³/m³");
    assert.equal(i.value!.provenance.category, "LIVE_API");
  }
  assert.equal(w.label, "REGIONAL MODEL DATA");
});
test("ET0 and runoff normalize seven-day hourly sums in mm", () => {
  const w = normalizeWeather(weather(), location, now);
  for (const name of ["runoff", "et0_fao_evapotranspiration"])
    assert.equal(w.indicators.find((i) => i.name === name)!.value!.value, 168);
  assert.equal(w.potentialEvapotranspiration.status, "unavailable");
});
test("missing variable stays unavailable rather than zero or demo", () => {
  const raw = weather();
  delete (raw.hourly as Record<string, unknown>).runoff;
  const w = normalizeWeather(raw, location, now);
  assert.equal(w.indicators.find((i) => i.name === "runoff")!.value, null);
});
test("invalid moisture range and incorrect units are unavailable", () => {
  const raw = weather();
  (raw.hourly as Record<string, number[]>).soil_moisture_0_to_7cm.fill(2);
  raw.hourly_units.runoff = "m³/m³" as "mm";
  const w = normalizeWeather(raw, location, now);
  assert.equal(w.indicators[2].status, "unavailable");
  assert.equal(w.indicators[4].status, "unavailable");
});
test("weather validTime is model time, retrievedAt remains separate", () => {
  const w = normalizeWeather(weather(), location, now + 1800000);
  assert.equal(w.validTime, time);
  assert.equal(w.retrievedAt, new Date(now + 1800000).toISOString());
  assert.equal(w.freshness, "fresh");
});
test("invalid timestamp ordering and wrong region reject API response", () => {
  const raw = weather();
  raw.hourly.time.reverse();
  assert.throws(() => normalizeWeather(raw, location, now));
  assert.throws(() =>
    normalizeWeather({ ...weather(), latitude: 50 }, location, now),
  );
});
test("ERA5 baseline compares three same-season windows without claiming climatology", () => {
  const h = normalizeHistory(archives(), location, now);
  assert.equal(h.historicalMean.value, 14);
  assert.equal(h.recentPrecipitation.value, 7);
  assert.equal(h.ratio!.value, 0.5);
  assert.equal(h.historicalWindows.length, 3);
  assert.match(h.description, /not a 30-year/);
});
test("incomplete history is rejected, zero historical mean has unavailable ratio", () => {
  const raw = archives();
  raw[1].daily.precipitation_sum[0] = null as unknown as number;
  assert.throws(() => normalizeHistory(raw, location, now));
  const zero = archives();
  zero.forEach((r) => r.daily.precipitation_sum.fill(0));
  assert.equal(normalizeHistory(zero, location, now).ratio, null);
});
test("environment failure contains zero synthetic substitutes", async () => {
  const p = createRegionalProvider({
    fetcher: async () => {
      throw new Error("offline");
    },
    now: () => now,
  });
  const b = await p.load(location);
  assert.equal(b.weather.status, "unavailable");
  assert.equal(b.history.data, null);
  assertNoDemo(b);
});
test("rate limit and timeout are explicit and bounded", async () => {
  const limited = createRegionalProvider({
    fetcher: async () => new Response("", { status: 429 }),
    now: () => now,
  });
  assert.equal((await limited.load(location)).weather.issue, "Rate limited");
  const timeout = createRegionalProvider({
    fetcher: () => new Promise(() => {}),
    now: () => now,
    timeoutMs: 5,
  });
  assert.equal((await timeout.load(location)).weather.issue, "Timeout");
});
test("cached environmental fallback preserves original retrieval time and is stale", async () => {
  let clock = now,
    offline = false;
  const payloads = archives();
  const p = createRegionalProvider({
    now: () => clock,
    fetcher: async (url) => {
      if (offline) throw new Error("offline");
      const u = new URL(String(url));
      const data = u.hostname.startsWith("archive")
        ? payloads[
            historicalWindows(now).findIndex(
              (w) => w[0] === u.searchParams.get("start_date"),
            )
          ]
        : weather();
      return Response.json(data);
    },
  });
  const a = await p.load(location);
  clock += 16 * 60000;
  offline = true;
  const b = await p.load(location);
  assert.equal(b.weather.status, "cached");
  assert.equal(b.weather.data!.freshness, "stale");
  assert.equal(b.weather.data!.retrievedAt, a.weather.data!.retrievedAt);
});
test("CSV quoted zones and optional columns work with provenance", () => {
  const r = parseCSV(
    "timestamp,consumption_liters,zone\r\n" + time + ',100,"East, wing"',
  );
  assert.equal(r.accepted, 1);
  assert.equal(r.records[0].zone, "East, wing");
  assert.equal(
    r.records[0].consumption_liters!.provenance.category,
    "IMPORTED_RECORD",
  );
});
test("CSV rejects duplicate, negative, invalid time and missing-value rows", () => {
  const r = parseCSV(
    "timestamp,consumption_liters\n" +
      time +
      ",10\n" +
      time +
      ",11\n2026-10-06T10:00:00Z,-1\nno,5\n2026-10-05T10:00:00Z,",
  );
  assert.equal(r.accepted, 1);
  assert.equal(r.rejected, 4);
});
test("CSV rejects undocumented units, oversized files and malformed quotes", () => {
  assert.throws(() =>
    parseCSV("timestamp,consumption_gallons\n" + time + ",1"),
  );
  assert.throws(() => parseCSV("x".repeat(500001)));
  assert.throws(() => parseCSV('timestamp,consumption_liters\n"unclosed'));
});
test("CSV summaries report chronology, ranges, zones and missing fields", () => {
  const r = parseCSV(
    "timestamp,consumption_liters,zone\n" +
      time +
      ",5,site\n2026-10-06T10:00:00Z,4,wing",
  );
  assert.equal(r.reordered, true);
  assert.equal(r.zones.length, 2);
  assert.ok(r.missingFields.includes("storage_liters"));
  assert.equal(r.dateRange![0], "2026-10-06T10:00:00.000Z");
});
test("median demand baseline resists isolated outliers", () => {
  assert.equal(median([1, 2, 3, 100]), 2.5);
  assert.equal(
    demandBaseline(history([100, 100, 100, 100, 100, 100, 9999]), now).value,
    100,
  );
});
test("insufficient, sparse and stale consumption history cannot supply demand", () => {
  assert.throws(() => demandBaseline(history([100, 100]), now));
  const rows = history(Array(8).fill(100));
  rows.splice(5, 1);
  assert.throws(() => demandBaseline(rows, now));
  assert.throws(() =>
    demandBaseline(history(Array(7).fill(100)), now + 3 * 86400000),
  );
});
test("zone anomalies use prior median MAD with zero-MAD floor and reason", () => {
  const a = zoneAnomalies(
    history([100, 100, 100, 100, 100, 100, 100, 150], "North"),
    now,
  )[0];
  assert.equal(a.status, "POTENTIAL ANOMALY");
  assert.equal(a.expected, 100);
  assert.equal(a.deviationPercent, 50);
  assert.match(a.reason, /Inspection/);
});
test("zone insufficient history never fabricates expected usage", () => {
  const a = zoneAnomalies(history([100, 150], "North"), now)[0];
  assert.equal(a.status, "INSUFFICIENT HISTORY");
  assert.equal("expected" in a, false);
});
test("explicit reserve hours and volume derive thresholds without demo calibration", () => {
  assert.deepEqual(reserveVolumes(14000, fixture().reserve.value, 80000), {
    critical: 7000,
    warning: 14000,
  });
  assert.equal(
    reserveVolumes(
      14000,
      { ...fixture().reserve.value, kind: "volume", volumeLitres: 12000 },
      80000,
    ).critical,
    12000,
  );
  assert.throws(() => reserveVolumes(14000, fixture().reserve.value, 5000));
});
test("REAL ANALYSIS has zero DEMO_SYNTHETIC values in decision inputs", () => {
  const a = fixture(),
    r = runAnalysis(a);
  assertNoDemo(a);
  assertNoDemo(r.input);
  assert.equal(r.input.dailyAnomalyLossLitres, 0);
  assert.equal(r.input.criticalReserveLitres, 7000);
  assert.equal(r.input.startTimeMs, now);
  const contaminated = fixture();
  contaminated.storage = valued(31000, "DEMO_SYNTHETIC", "Seed", time);
  assert.throws(() => realForecastInput(contaminated), /Synthetic/);
});
test("missing real demand cannot fall back to demo demand", () => {
  const a = fixture();
  a.demand = null;
  assert.throws(() => runAnalysis(a), /consumption/);
  a.demandMethod = "history";
  assert.throws(() => runAnalysis(a), /7 consecutive/);
});
test("real forecast regression uses dynamic rates and policy", () => {
  const r = runAnalysis(fixture());
  assert.equal(r.baseline.netDailyDeficitLitres, 5000);
  assert.equal(r.baseline.criticalCrossing!.day, 7);
  assert.equal(r.baseline.points[1].storageLitres, 37000);
});
test("anomaly flag does not double-count measured consumption", () => {
  const a = fixture();
  a.records = history([100, 100, 100, 100, 100, 100, 100, 150], "North");
  const r = runAnalysis(a);
  assert.equal(r.anomalies[0].status, "POTENTIAL ANOMALY");
  assert.equal(r.input.dailyAnomalyLossLitres, 0);
});
test("index handles missing components by renormalizing available weights", () => {
  const r = runAnalysis(fixture());
  assert.equal(r.index.dataCompleteness.available, 3);
  assert.equal(r.index.dataCompleteness.availableWeight, 80);
  assert.equal(
    r.index.components.find((c) => c.key === "rainfall")!.contribution,
    null,
  );
  assert.equal(r.index.modelVersion, indexPolicy.version);
  assert.ok(
    Math.abs(
      r.index.components.reduce((s, c) => s + (c.contribution ?? 0), 0) -
        r.index.score,
    ) <= 0.5,
  );
});
test("index adds a documented rainfall component and responds to operational changes", () => {
  const a = fixture(),
    input = realForecastInput(a),
    r = waterSecurityIndex(input, [], {
      rainfallRatio: 0.5,
      rainfallProvenance: valued(0.5, "CALCULATED", "ERA5 comparison", time)
        .provenance,
    });
  assert.equal(r.dataCompleteness.available, 4);
  const changed = waterSecurityIndex(
    { ...input, startingStorageLitres: 10000 },
    [],
  );
  assert.notEqual(changed.score, runAnalysis(a).index.score);
});
test("simulator recalculates from real baseline, no hardcoded outcomes", () => {
  const input = realForecastInput(fixture()),
    s = evaluateScenario(input, {
      ...scenarioPresets.baseline,
      reductionPercent: 20,
    });
  assert.equal(s.intervention.netDailyDeficitLitres, 2200);
  assert.ok(s.waterPreservedLitres! > 0);
  assert.ok(s.resilienceHours! > 0);
  assert.notEqual(s.baseline.criticalCrossing!.day, 4.7);
});
test("groundwater import requires authoritative metadata and makes no trend", () => {
  const g = importGroundwater({
    region: "Regional well record",
    location,
    depthBelowGroundMetres: 10,
    validTime: time,
    sourceURL: "https://cgwb.gov.in/example-dataset",
  });
  assert.equal(g.depthBelowGroundMetres.provenance.category, "IMPORTED_RECORD");
  assert.match(g.limitations, /cannot establish trend/);
  assert.throws(() =>
    importGroundwater({
      region: "x",
      location,
      depthBelowGroundMetres: 10,
      validTime: time,
      sourceURL: "https://example.com",
    }),
  );
});
test("schema v2 roundtrip preserves real inputs and independent campus key", () => {
  const campus = createAnalysisCampus(fixture(), 1, now);
  assert.deepEqual(parseAnalysisCampus(campus), campus);
  assert.equal(campus.campusId, "real-site");
  assertNoDemo(campus);
});
test("server environmental provenance retains source/model/grid/time metadata", () => {
  const campus = createAnalysisCampus(fixture(), 1, now);
  campus.environmentalProvenance = environmentProvenance({
    location,
    attemptedAt: time,
    weather: {
      status: "available",
      data: normalizeWeather(weather(), location, now),
      issue: null,
    },
    history: {
      status: "available",
      data: normalizeHistory(archives(), location, now),
      issue: null,
    },
  });
  const parsed = parseAnalysisCampus(campus);
  assert.equal(parsed.environmentalProvenance.length, 11);
  assert.equal(parsed.environmentalProvenance[0].model, "ECMWF IFS 0.25°");
  assert.equal(parsed.environmentalProvenance[0].retrievedAt, time);
  assertNoDemo(parsed);
});
test("mismatched storage reading and synthetic imported history are rejected", () => {
  const a = fixture();
  a.storage.provenance.timestamp = "2026-10-06T10:00:00Z";
  assert.throws(() => realForecastInput(a), /match/);
  const b = fixture();
  b.records = history(Array(7).fill(100));
  b.records[0].consumption_liters!.provenance.category = "DEMO_SYNTHETIC";
  assert.throws(() => realForecastInput(b), /Synthetic/);
});
test("AWS real handler validation, persistence, forecast and location boundary are mocked", async () => {
  let stored: AnalysisCampus | null = null,
    queried = "";
  const h = createHandler({
    authorizeReal: () => true,
    repository: {
      get: async () => stored,
      put: async () => {
        throw new Error("legacy write forbidden");
      },
      putAnalysis: async (next) => {
        stored = next;
      },
    },
    environment: {
      load: async () => {
        throw new Error("legacy provider forbidden");
      },
    },
    regionalEnvironment: {
      load: async (l) => {
        queried = l.name;
        return {
          location: l,
          attemptedAt: time,
          weather: { status: "unavailable", data: null, issue: "offline" },
          history: { status: "unavailable", data: null, issue: "offline" },
        };
      },
    },
    now: () => now,
  });
  const event = (method: string, path: string, payload?: unknown) => ({
    rawPath: path,
    requestContext: { http: { method } },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  assert.equal((await h(event("GET", "/campus/real-site"))).statusCode, 404);
  assert.equal(
    (
      await h(
        event("PUT", "/campus/real-site", {
          analysis: fixture(),
          expectedVersion: 0,
        }),
      )
    ).statusCode,
    201,
  );
  const f = await h(
    event("POST", "/forecast", {
      campusId: "real-site",
      expectedVersion: 1,
      horizonDays: 14,
    }),
  );
  assert.equal(f.statusCode, 200);
  assert.equal(JSON.parse(f.body).baseline.criticalCrossing.day, 7);
  assert.equal(JSON.parse(f.body).input.horizonDays, 14);
  assert.equal(
    (await h(event("GET", "/environment/real-site"))).statusCode,
    200,
  );
  assert.equal(queried, location.name);
  assert.equal(
    (
      await h(
        event("PUT", "/campus/real-site", {
          analysis: fixture(),
          expectedVersion: 0,
        }),
      )
    ).statusCode,
    409,
  );
});
test("real Lambda index uses validated regional context without altering storage forecast", async () => {
  const campus = createAnalysisCampus(fixture(), 1, now);
  const h = createHandler({
    authorizeReal: () => true,
    repository: { get: async () => campus, put: async () => {} },
    environment: {
      load: async () => {
        throw new Error("legacy forbidden");
      },
    },
    regionalEnvironment: {
      load: async () => ({
        location,
        attemptedAt: time,
        weather: { status: "unavailable", data: null, issue: "offline" },
        history: {
          status: "available",
          data: normalizeHistory(archives(), location, now),
          issue: null,
        },
      }),
    },
    now: () => now,
  });
  const r = await h({
    rawPath: "/forecast",
    requestContext: { http: { method: "POST" } },
    body: JSON.stringify({
      campusId: "real-site",
      expectedVersion: 1,
      horizonDays: 30,
    }),
  });
  assert.equal(r.statusCode, 200);
  const b = JSON.parse(r.body);
  assert.equal(b.analysis.index.dataCompleteness.available, 4);
  assert.equal(
    b.analysis.index.components.find(
      (c: { key: string }) => c.key === "rainfall",
    ).score,
    50,
  );
  assert.equal(b.baseline.netDailyDeficitLitres, 5000);
  assert.equal(b.baseline.criticalCrossing.day, 7);
});

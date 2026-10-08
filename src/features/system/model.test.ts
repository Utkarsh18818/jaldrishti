import { test } from "node:test";
import assert from "node:assert/strict";
import {
  seedOperations,
  updateOperations,
  deriveOperations,
  operationalForecastInput,
  validateOperations,
  provenanceLabels,
} from "./model.ts";
import { forecastStorage } from "../forecast/model.ts";
import { evaluateScenario, scenarioPresets } from "../simulator/adapter.ts";
import { environmentalLocation } from "../environment/model.ts";
import { siteLocation } from "../../lib/location.ts";
import { campusSeed } from "../../lib/campus-seed.ts";
const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
test("seeded water balance uses the existing engine", () => {
  const d = deriveOperations(seedOperations());
  assert.equal(d.netDeficit, 6120);
  assert.equal(d.input.criticalReserveLitres, 2236);
  near(d.comparison.baseline.criticalCrossing!.day, 4.7);
  assert.equal(d.comparison.waterPreservedLitres, 13489);
});
test("zone baseline sums demand and modeled use includes additional loss once", () => {
  const d = deriveOperations(seedOperations());
  near(
    d.zones.reduce((sum, z) => sum + z.baseline, 0),
    12500,
  );
  near(d.zoneTotal, 14120);
  near(d.zoneTotal - d.input.dailySupplyLitres, d.netDeficit);
});
test("Block C variance is calculated from a seeded usage profile", () => {
  const d = deriveOperations(seedOperations());
  assert.equal(d.anomaly.baseline, 6000);
  assert.equal(d.anomaly.estimatedUse, 7620);
  assert.equal(d.anomaly.excess, 1620);
  near(d.anomaly.variancePercent!, 27);
  assert.equal(d.anomaly.status, "Potential anomaly");
  assert.equal(d.anomaly.provenance, provenanceLabels.detected);
});
test("input edits are atomic, immutable and provenance is per field", () => {
  const seed = seedOperations(),
    now = Date.parse("2026-10-07T10:00:00Z");
  const changed = updateOperations(
    seed,
    { ...seed.values, currentStorage: 40000 },
    now,
  );
  assert.equal(seed.values.currentStorage, 31000);
  assert.equal(changed.origins.currentStorage.kind, "user");
  assert.equal(
    changed.origins.currentStorage.timestamp,
    new Date(now).toISOString(),
  );
  assert.deepEqual(changed.origins.dailyDemand, seed.origins.dailyDemand);
  assert.equal(changed.values.currentStorage, 40000);
});
test("unchanged resubmission preserves provenance and reset restores seed", () => {
  const seed = seedOperations();
  const changed = updateOperations(
    seed,
    { ...seed.values, dailyDemand: 15000 },
    1,
  );
  const same = updateOperations(changed, { ...changed.values }, 2);
  assert.equal(same.origins.dailyDemand.timestamp, new Date(1).toISOString());
  assert.deepEqual(seedOperations(), seed);
});
test("storage, demand and supply edits recalculate critical dates", () => {
  const seed = seedOperations();
  for (const patch of [
    { currentStorage: 40000 },
    { dailyDemand: 15000 },
    { expectedDailySupply: 10000 },
  ]) {
    const state = updateOperations(seed, { ...seed.values, ...patch }, 1);
    const d = deriveOperations(state);
    assert.notEqual(
      d.comparison.baseline.criticalCrossing!.timeMs,
      deriveOperations(seed).comparison.baseline.criticalCrossing!.timeMs,
    );
    assert.deepEqual(
      d.comparison.baseline,
      forecastStorage(operationalForecastInput(state.values)),
    );
  }
});
test("simulator uses the updated operational baseline and preserves recommended regression", () => {
  const seed = seedOperations();
  const original = evaluateScenario(
    operationalForecastInput(seed.values),
    scenarioPresets.recommended,
  );
  near(original.resilienceHours!, 99.611076923);
  const edited = updateOperations(
    seed,
    {
      ...seed.values,
      dailyDemand: 15000,
      currentStorage: 40000,
      storageCapacity: 60000,
    },
    1,
  );
  const input = operationalForecastInput(edited.values);
  const sim = evaluateScenario(input, scenarioPresets.recommended);
  assert.equal(sim.scenarioInput.capacityLitres, 60000);
  assert.equal(sim.scenarioInput.startingStorageLitres, 40000);
  assert.equal(sim.scenarioInput.dailyDemandLitres, 13500);
  assert.deepEqual(sim.baseline, deriveOperations(edited).comparison.baseline);
  assert.notEqual(
    sim.baseline.criticalCrossing!.day,
    original.baseline.criticalCrossing!.day,
  );
});
test("population is context only and does not implicitly change demand", () => {
  const seed = seedOperations();
  const edited = updateOperations(seed, { ...seed.values, population: 800 }, 1);
  assert.deepEqual(
    deriveOperations(edited).comparison,
    deriveOperations(seed).comparison,
  );
});
test("capacity edits preserve fixed reserve policy and cap supplementary water", () => {
  const seed = seedOperations();
  const edited = updateOperations(
    seed,
    { ...seed.values, storageCapacity: 35000 },
    1,
  );
  const input = operationalForecastInput(edited.values);
  assert.equal(input.warningReserveLitres, 10000);
  assert.equal(input.criticalReserveLitres, 2236);
  const sim = evaluateScenario(input, {
    ...scenarioPresets.recommended,
    supplementaryLitres: 25000,
  });
  assert.equal(sim.retainedSupplementaryLitres, 4000);
});
test("edited demand scales all zone baselines and recomputes variance", () => {
  const seed = seedOperations();
  const d = deriveOperations(
    updateOperations(seed, { ...seed.values, dailyDemand: 15000 }, 1),
  );
  near(
    d.zones.reduce((sum, z) => sum + z.baseline, 0),
    15000,
  );
  near(d.zoneTotal, 16620);
  near(d.anomaly.variancePercent!, 22.5);
  assert.equal(d.anomaly.excess, 1620);
});
test("zero demand has no fabricated infinite variance", () => {
  const seed = seedOperations();
  const d = deriveOperations(
    updateOperations(seed, { ...seed.values, dailyDemand: 0 }, 1),
  );
  assert.equal(d.anomaly.variancePercent, null);
  assert.equal(d.zoneTotal, 1620);
});
test("surplus and already critical input cases keep engine semantics", () => {
  const seed = seedOperations();
  const surplus = deriveOperations(
    updateOperations(seed, { ...seed.values, expectedDailySupply: 20000 }, 1),
  );
  assert.equal(surplus.netDeficit, -5880);
  assert.equal(surplus.comparison.baseline.criticalCrossing, null);
  assert.equal(surplus.comparison.waterPreservedLitres, null);
  const critical = deriveOperations(
    updateOperations(seed, { ...seed.values, currentStorage: 1000 }, 1),
  );
  assert.equal(critical.comparison.baseline.criticalCrossing!.day, 0);
});
test("rejects invalid inputs before replacing applied state", () => {
  const seed = seedOperations();
  for (const patch of [
    { storageCapacity: 9000 },
    { currentStorage: 50001 },
    { dailyDemand: -1 },
    { expectedDailySupply: NaN },
    { population: 1.5 },
    { population: 0 },
    { dailyDemand: Infinity },
  ])
    assert.throws(() =>
      updateOperations(seed, { ...seed.values, ...patch }, 1),
    );
  validateOperations(seed.values);
  assert.equal(seed.values.currentStorage, 31000);
});
test("provenance vocabulary separates inputs, calculations, demo detection and output", () => {
  assert.deepEqual(Object.values(provenanceLabels), [
    "SEEDED DEMO",
    "USER PROVIDED",
    "CALCULATED",
    "DETECTED FROM SEEDED USAGE PROFILE",
    "MODEL OUTPUT",
  ]);
});
test("campus and public weather share one explicit example location", () => {
  assert.equal(campusSeed.location, siteLocation.campusName);
  assert.equal(campusSeed.location, "Pune Demo Campus");
  assert.equal(environmentalLocation.name, siteLocation.regionName);
  assert.equal(environmentalLocation.latitude, siteLocation.latitude);
  assert.equal(environmentalLocation.longitude, siteLocation.longitude);
});

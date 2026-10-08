import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scenarioPresets,
  scenarioToForecast,
  evaluateScenario,
} from "./adapter.ts";
import {
  forecastStorage,
  compareIntervention,
  storageAtDay,
} from "../forecast/model.ts";
import type { ForecastInput } from "../forecast/model.ts";
const base: ForecastInput = {
  capacityLitres: 50000,
  startingStorageLitres: 31000,
  dailySupplyLitres: 8000,
  dailyDemandLitres: 12500,
  dailyAnomalyLossLitres: 1620,
  warningReserveLitres: 10000,
  criticalReserveLitres: 2236,
  horizonDays: 30,
  startTimeMs: Date.parse("2026-10-07T08:30:00Z"),
};
const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
test("repair removes only anomaly loss", () => {
  const input = scenarioToForecast(base, {
    ...scenarioPresets.baseline,
    repairAnomaly: true,
  });
  assert.equal(input.dailyAnomalyLossLitres, 0);
  assert.equal(input.dailyDemandLitres, 12500);
  assert.equal(base.dailyAnomalyLossLitres, 1620);
});
test("10 percent reduction changes metered demand", () =>
  assert.equal(
    scenarioToForecast(base, {
      ...scenarioPresets.baseline,
      reductionPercent: 10,
    }).dailyDemandLitres,
    11250,
  ));
test("supplementary water arrives once at day zero", () => {
  const r = evaluateScenario(base, {
    ...scenarioPresets.baseline,
    supplementaryLitres: 10000,
  });
  assert.equal(r.intervention.points[0].storageLitres, 41000);
  assert.equal(r.intervention.points[1].storageLitres, 34880);
  assert.equal(r.intervention.points[2].storageLitres, 28760);
});
test("supply delay withholds first day, resumes without catch up", () => {
  const r = evaluateScenario(base, scenarioPresets.interruption);
  assert.equal(r.intervention.points[1].storageLitres, 16880);
  assert.equal(r.intervention.points[2].storageLitres, 10760);
  near(r.intervention.criticalCrossing!.day, 1 + (16880 - 2236) / 6120);
  near(r.resilienceHours!, -31.37254901960785);
  near(r.waterPreservedLitres!, -2236);
});
test("occupancy scales demand but does not scale leak or supply", () => {
  const input = scenarioToForecast(base, {
    ...scenarioPresets.baseline,
    occupancyPercent: 110,
  });
  near(input.dailyDemandLitres, 13750);
  assert.equal(input.dailyAnomalyLossLitres, 1620);
  assert.equal(input.dailySupplyLitres, 8000);
});
test("combined scenario composes occupancy, reduction, repair, top-up and delay", () => {
  const r = evaluateScenario(base, {
    reductionPercent: 10,
    supplementaryLitres: 10000,
    supplyDelayDays: 1,
    repairAnomaly: true,
    occupancyPercent: 110,
  });
  near(r.scenarioInput.dailyDemandLitres, 12375);
  assert.equal(r.intervention.points[0].storageLitres, 41000);
  near(r.intervention.points[1].storageLitres, 28625);
  near(r.intervention.points[2].storageLitres, 24250);
});
test("baseline reset matches untouched original baseline", () => {
  const r = evaluateScenario(base, scenarioPresets.baseline);
  assert.deepEqual(r.intervention.points, forecastStorage(base).points);
  assert.equal(r.resilienceHours, 0);
  assert.equal(r.waterPreservedLitres, 0);
});
test("recommended preset reproduces Phase 2 outputs", () => {
  const a = evaluateScenario(base, scenarioPresets.recommended),
    b = compareIntervention(base, 10);
  assert.deepEqual(a.intervention.points, b.intervention.points);
  near(a.resilienceHours!, 99.6110769230769);
  near(a.waterPreservedLitres!, 13489);
  assert.equal(
    a.intervention.criticalCrossing!.timeMs,
    b.intervention.criticalCrossing!.timeMs,
  );
});
test("capacity caps supplementary water and reports unretained volume", () => {
  const r = evaluateScenario(base, {
    ...scenarioPresets.baseline,
    supplementaryLitres: 25000,
  });
  assert.equal(r.intervention.points[0].storageLitres, 50000);
  assert.equal(r.retainedSupplementaryLitres, 19000);
  assert.equal(r.unretainedSupplementaryLitres, 6000);
});
test("no crossing within horizon produces bounded resilience, not infinity", () => {
  const r = evaluateScenario(base, {
    ...scenarioPresets.recommended,
    reductionPercent: 30,
    occupancyPercent: 80,
  });
  assert.equal(r.intervention.criticalCrossing, null);
  assert.equal(r.resilienceHours, null);
  near(r.resilienceLowerBoundHours!, 607.2);
});
test("first unsafe crossing remains even after later refill", () => {
  const input = {
    ...base,
    dailyDemandLitres: 1000,
    dailyAnomalyLossLitres: 0,
    startingStorageLitres: 3000,
    supplyDelayDays: 2,
  };
  const r = forecastStorage(input);
  near(r.criticalCrossing!.day, 0.764);
  assert.ok(r.points[3].storageLitres > 2236);
});
test("fractional-day storage agrees with daily points through delays", () => {
  const input = scenarioToForecast(base, scenarioPresets.interruption),
    r = forecastStorage(input);
  for (let day = 0; day <= 30; day++)
    near(storageAtDay(input, day), r.points[day].storageLitres);
  near(storageAtDay(input, 0.5), 23940);
});
test("controls outside approved bounds are rejected", () => {
  for (const patch of [
    { reductionPercent: 31 },
    { supplementaryLitres: -1 },
    { supplyDelayDays: 4 },
    { supplyDelayDays: 0.5 },
    { occupancyPercent: 121 },
    { occupancyPercent: NaN },
  ])
    assert.throws(
      () => scenarioToForecast(base, { ...scenarioPresets.baseline, ...patch }),
      RangeError,
    );
});

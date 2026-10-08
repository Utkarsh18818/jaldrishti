import { test } from "node:test";
import assert from "node:assert/strict";
import {
  forecastStorage,
  recommendedIntervention,
  compareIntervention,
  storageAtDay,
} from "./model.ts";
import type { ForecastInput } from "./model.ts";
const input: ForecastInput = {
  capacityLitres: 50000,
  startingStorageLitres: 31000,
  dailySupplyLitres: 8000,
  dailyDemandLitres: 12500,
  dailyAnomalyLossLitres: 1620,
  warningReserveLitres: 10000,
  criticalReserveLitres: 2236,
  horizonDays: 14,
  startTimeMs: 0,
};
const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
test("baseline depletes by demand plus additional anomaly less supply", () => {
  const r = forecastStorage(input);
  assert.equal(r.netDailyDeficitLitres, 6120);
  assert.equal(r.points[1].storageLitres, 24880);
  near(r.criticalCrossing!.day, 4.7);
});
test("supply exceeding demand increases storage without reserve crossing", () => {
  const r = forecastStorage({ ...input, dailySupplyLitres: 20000 });
  assert.equal(r.points[1].storageLitres, 36880);
  assert.equal(r.criticalCrossing, null);
  assert.equal(r.warningCrossing, null);
});
test("removing anomaly loss changes depletion to 4500", () =>
  assert.equal(
    forecastStorage(recommendedIntervention(input, 0)).netDailyDeficitLitres,
    4500,
  ));
test("ten percent reduction applies to demand only", () => {
  const scenario = recommendedIntervention(input, 10);
  assert.equal(scenario.dailyDemandLitres, 11250);
  assert.equal(scenario.dailyAnomalyLossLitres, 0);
  assert.equal(scenario.dailySupplyLitres, 8000);
  assert.equal(forecastStorage(scenario).netDailyDeficitLitres, 3250);
  assert.equal(input.dailyDemandLitres, 12500);
});
test("storage is clamped at zero and capacity", () => {
  assert.equal(forecastStorage(input).points[14].storageLitres, 0);
  assert.equal(
    forecastStorage({ ...input, dailySupplyLitres: 100000 }).points[1]
      .storageLitres,
    50000,
  );
});
test("threshold crossing uses unclamped rate within final depleted day", () => {
  const r = forecastStorage({ ...input, startingStorageLitres: 3000 });
  near(r.criticalCrossing!.day, (3000 - 2236) / 6120);
  assert.equal(r.warningCrossing!.day, 0);
  near(forecastStorage(input).warningCrossing!.day, 21000 / 6120);
});
test("horizons include day zero and hide crossings beyond selected window", () => {
  for (const horizonDays of [7, 14, 30]) {
    const r = forecastStorage({ ...input, horizonDays });
    assert.equal(r.points.length, horizonDays + 1);
    assert.equal(r.points.at(-1)!.day, horizonDays);
  }
  assert.equal(
    forecastStorage({ ...recommendedIntervention(input, 10), horizonDays: 7 })
      .criticalCrossing,
    null,
  );
  assert.notEqual(
    forecastStorage({ ...recommendedIntervention(input, 10), horizonDays: 14 })
      .criticalCrossing,
    null,
  );
});
test("critical crossing at exact horizon is included", () =>
  near(
    forecastStorage({
      ...input,
      criticalReserveLitres: 24880,
      horizonDays: 1,
      warningReserveLitres: 25000,
    }).criticalCrossing!.day,
    1,
  ));
test("comparison computes revised resilience and storage difference at baseline crossing", () => {
  const r = compareIntervention(input, 10);
  near(r.resilienceHours!, 99.6110769230769);
  near(r.waterPreservedLitres!, 13489);
  near(storageAtDay(input, 4.7), 2236);
  near(r.intervention.criticalCrossing!.timeMs, 8.850461538461538 * 86400000);
});
test("already critical reports day zero, balanced supply has no future crossing", () => {
  assert.equal(
    forecastStorage({ ...input, startingStorageLitres: 1000 }).criticalCrossing!
      .day,
    0,
  );
  assert.equal(
    forecastStorage({ ...input, dailySupplyLitres: 14120 }).criticalCrossing,
    null,
  );
});
test("invalid rates, reserves and horizons are rejected", () => {
  for (const changes of [
    { dailySupplyLitres: -1 },
    { horizonDays: 0 },
    { horizonDays: 1.5 },
    { criticalReserveLitres: 11000 },
    { startingStorageLitres: 50001 },
    { dailyDemandLitres: NaN },
  ])
    assert.throws(() => forecastStorage({ ...input, ...changes }), RangeError);
  assert.throws(() => recommendedIntervention(input, 101), RangeError);
});
test("comparison does not invent gains when intervention crossing is beyond horizon", () =>
  assert.equal(
    compareIntervention({ ...input, horizonDays: 7 }, 10).resilienceHours,
    null,
  ));

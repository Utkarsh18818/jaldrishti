import {
  compareForecasts,
  forecastStorage,
  validateInput,
} from "../forecast/model.ts";
import type { ForecastInput } from "../forecast/model.ts";
export interface ScenarioControls {
  reductionPercent: number;
  supplementaryLitres: number;
  supplyDelayDays: number;
  repairAnomaly: boolean;
  occupancyPercent: number;
}
export const scenarioPresets = {
  baseline: {
    reductionPercent: 0,
    supplementaryLitres: 0,
    supplyDelayDays: 0,
    repairAnomaly: false,
    occupancyPercent: 100,
  },
  recommended: {
    reductionPercent: 10,
    supplementaryLitres: 0,
    supplyDelayDays: 0,
    repairAnomaly: true,
    occupancyPercent: 100,
  },
  interruption: {
    reductionPercent: 0,
    supplementaryLitres: 0,
    supplyDelayDays: 1,
    repairAnomaly: false,
    occupancyPercent: 100,
  },
} as const satisfies Record<string, ScenarioControls>;
export const scenarioLimits = {
  reductionPercent: { min: 0, max: 30, step: 1 },
  supplementaryLitres: { min: 0, max: 25000, step: 500 },
  supplyDelayDays: { min: 0, max: 3, step: 1 },
  occupancyPercent: { min: 80, max: 120, step: 1 },
} as const;
export function validateScenario(controls: ScenarioControls): void {
  for (const [key, limits] of Object.entries(scenarioLimits)) {
    const value = controls[key as keyof typeof scenarioLimits];
    if (
      !Number.isFinite(value) ||
      value < limits.min ||
      value > limits.max ||
      (key === "supplyDelayDays" && !Number.isInteger(value))
    )
      throw new RangeError("Invalid " + key);
  }
  if (typeof controls.repairAnomaly !== "boolean")
    throw new RangeError("Repair must be boolean");
}
export function scenarioToForecast(
  base: ForecastInput,
  controls: ScenarioControls,
): ForecastInput {
  validateInput(base);
  validateScenario(controls);
  return {
    ...base,
    dailyDemandLitres:
      ((base.dailyDemandLitres * controls.occupancyPercent) / 100) *
      (1 - controls.reductionPercent / 100),
    dailyAnomalyLossLitres: controls.repairAnomaly
      ? 0
      : base.dailyAnomalyLossLitres,
    initialSupplementaryLitres: controls.supplementaryLitres,
    supplyDelayDays: controls.supplyDelayDays,
  };
}
export function evaluateScenario(
  base: ForecastInput,
  controls: ScenarioControls,
  chartHorizon: number = 14,
) {
  const scenarioInput = scenarioToForecast(base, controls),
    comparison = compareForecasts(base, scenarioInput);
  const baselineCritical = comparison.baseline.criticalCrossing;
  const resilienceLowerBoundHours =
    baselineCritical && !comparison.intervention.criticalCrossing
      ? (base.horizonDays - baselineCritical.day) * 24
      : null;
  const retainedSupplementaryLitres = Math.min(
    controls.supplementaryLitres,
    base.capacityLitres - base.startingStorageLitres,
  );
  return {
    ...comparison,
    scenarioInput,
    baselineChart: forecastStorage({ ...base, horizonDays: chartHorizon }),
    scenarioChart: forecastStorage({
      ...scenarioInput,
      horizonDays: chartHorizon,
    }),
    resilienceLowerBoundHours,
    resilienceDays:
      comparison.resilienceHours == null
        ? null
        : comparison.resilienceHours / 24,
    resilienceLowerBoundDays:
      resilienceLowerBoundHours == null ? null : resilienceLowerBoundHours / 24,
    retainedSupplementaryLitres,
    unretainedSupplementaryLitres:
      controls.supplementaryLitres - retainedSupplementaryLitres,
    delayDailyDeficitLitres:
      scenarioInput.dailyDemandLitres + scenarioInput.dailyAnomalyLossLitres,
  };
}
export function activeScenarioPreset(
  controls: ScenarioControls,
): keyof typeof scenarioPresets | null {
  for (const key of Object.keys(
    scenarioPresets,
  ) as (keyof typeof scenarioPresets)[]) {
    if (
      Object.entries(scenarioPresets[key]).every(
        ([field, value]) => controls[field as keyof ScenarioControls] === value,
      )
    )
      return key;
  }
  return null;
}

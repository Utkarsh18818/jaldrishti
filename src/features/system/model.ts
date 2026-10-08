import { campusSeed } from "../../lib/campus-seed.ts";
import { compareIntervention, validateInput } from "../forecast/model.ts";
import type { ForecastInput } from "../forecast/model.ts";
import { forecastPolicy } from "../forecast/policy.ts";
export const provenanceLabels = {
  seeded: "SEEDED DEMO",
  user: "USER PROVIDED",
  calculated: "CALCULATED",
  detected: "DETECTED FROM SEEDED USAGE PROFILE",
  output: "MODEL OUTPUT",
} as const;
export const inputFields = [
  "storageCapacity",
  "currentStorage",
  "population",
  "dailyDemand",
  "expectedDailySupply",
] as const;
export type InputField = (typeof inputFields)[number];
export type OperationalValues = Record<InputField, number>;
export interface InputOrigin {
  kind: "seeded" | "user";
  timestamp: string;
  category?: "DEMO_SYNTHETIC" | "USER_PROVIDED";
}
export interface OperationalState {
  values: OperationalValues;
  origins: Record<InputField, InputOrigin>;
}
export function seedOperations(): OperationalState {
  return {
    values: Object.fromEntries(
      inputFields.map((key) => [key, campusSeed[key]]),
    ) as OperationalValues,
    origins: Object.fromEntries(
      inputFields.map((key) => [
        key,
        {
          kind: "seeded",
          category: "DEMO_SYNTHETIC",
          timestamp: new Date(forecastPolicy.startTimeMs).toISOString(),
        },
      ]),
    ) as Record<InputField, InputOrigin>,
  };
}
export function operationalForecastInput(
  values: OperationalValues,
  horizonDays: number = forecastPolicy.comparisonHorizonDays,
): ForecastInput {
  return {
    capacityLitres: values.storageCapacity,
    startingStorageLitres: values.currentStorage,
    dailySupplyLitres: values.expectedDailySupply,
    dailyDemandLitres: values.dailyDemand,
    dailyAnomalyLossLitres: campusSeed.possibleLoss,
    warningReserveLitres: forecastPolicy.warningReserveLitres,
    criticalReserveLitres: forecastPolicy.criticalReserveLitres,
    horizonDays,
    startTimeMs: forecastPolicy.startTimeMs,
  };
}
export function validateOperations(values: OperationalValues): void {
  for (const key of inputFields)
    if (!Number.isFinite(values[key]) || values[key] < 0 || values[key] > 1e9)
      throw new RangeError(
        "Operational inputs must be finite, nonnegative and at most 1 billion.",
      );
  if (
    !Number.isInteger(values.population) ||
    values.population < 1 ||
    values.population > 1000000
  )
    throw new RangeError(
      "Population must be a whole number from 1 to 1,000,000.",
    );
  if (values.storageCapacity < forecastPolicy.warningReserveLitres)
    throw new RangeError(
      "Capacity must be at least 10,000 L to retain the fixed demo reserves.",
    );
  if (values.currentStorage > values.storageCapacity)
    throw new RangeError("Current storage cannot exceed capacity.");
  validateInput(operationalForecastInput(values));
}
export function updateOperations(
  previous: OperationalState,
  values: OperationalValues,
  now: number,
): OperationalState {
  validateOperations(values);
  if (!Number.isFinite(now)) throw new RangeError("Invalid input timestamp.");
  const origins = { ...previous.origins };
  for (const key of inputFields)
    if (values[key] !== previous.values[key])
      origins[key] = {
        kind: "user",
        category: "USER_PROVIDED",
        timestamp: new Date(now).toISOString(),
      };
  return { values: { ...values }, origins };
}
const zoneSeeds = [
  { name: "Block A", baseline: 2000 },
  { name: "Block B", baseline: 1500 },
  { name: "Block C", baseline: 6000 },
  { name: "Hostel", baseline: 2000 },
  { name: "Cafeteria", baseline: 1000 },
] as const;
export function zoneProfile(values: OperationalValues) {
  return zoneSeeds.map((zone) => {
    const baseline =
      (zone.baseline / campusSeed.dailyDemand) * values.dailyDemand;
    const excess = zone.name === "Block C" ? campusSeed.possibleLoss : 0;
    return {
      name: zone.name,
      baseline,
      estimatedUse: baseline + excess,
      excess,
      variancePercent: baseline > 0 ? (excess / baseline) * 100 : null,
      status: excess > 0 ? "Potential anomaly" : "Within demo baseline",
      provenance:
        values.dailyDemand === campusSeed.dailyDemand
          ? provenanceLabels.detected
          : "CALCULATED FROM LOCAL DEMAND + SEEDED PROFILE",
    };
  });
}
export function deriveOperations(state: OperationalState) {
  validateOperations(state.values);
  const input = operationalForecastInput(state.values);
  const comparison = compareIntervention(input, campusSeed.reductionPercent);
  const zones = zoneProfile(state.values);
  return {
    input,
    comparison,
    zones,
    anomaly: zones.find((zone) => zone.name === "Block C")!,
    zoneTotal: zones.reduce((sum, zone) => sum + zone.estimatedUse, 0),
    netDeficit: comparison.baseline.netDailyDeficitLitres,
  };
}

import { siteLocation } from "./location.ts";
import {
  inputFields,
  seedOperations,
  validateOperations,
} from "../features/system/model.ts";
import type {
  OperationalState,
  OperationalValues,
  InputOrigin,
} from "../features/system/model.ts";
import type {
  ForecastInput,
  ForecastResult,
  compareIntervention,
} from "../features/forecast/model.ts";
export const campusId = "pune-demo-campus";
export type Execution = "aws-lambda" | "local-mock";
export interface CampusState {
  schemaVersion: 1;
  campusId: string;
  location: typeof siteLocation;
  storageCapacity: number;
  currentStorage: number;
  population: number;
  dailyDemand: number;
  expectedSupply: number;
  provenance: Record<keyof OperationalValues, InputOrigin>;
  updatedAt: string;
  version: number;
}
export interface CampusEnvelope {
  campus: CampusState;
  execution: Execution;
}
export interface ForecastEnvelope {
  campusId: string;
  campusVersion: number;
  input: ForecastInput;
  baseline: ForecastResult;
  comparison: ReturnType<typeof compareIntervention>;
  executedAt: string;
  execution: Execution;
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new RangeError("Expected an object.");
  return value as Record<string, unknown>;
}
export function validTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms) && new Date(ms).toISOString() === value;
}
export function parseValues(value: unknown): OperationalValues {
  const raw = object(value);
  if (
    Object.keys(raw).length !== inputFields.length ||
    inputFields.some((key) => typeof raw[key] !== "number")
  )
    throw new RangeError("Provide only the five numeric operational inputs.");
  const values = Object.fromEntries(
    inputFields.map((key) => [key, raw[key]]),
  ) as OperationalValues;
  validateOperations(values);
  return values;
}
export function stateToCampus(
  state: OperationalState,
  version: number,
  now: number,
): CampusState {
  return {
    schemaVersion: 1,
    campusId,
    location: siteLocation,
    storageCapacity: state.values.storageCapacity,
    currentStorage: state.values.currentStorage,
    population: state.values.population,
    dailyDemand: state.values.dailyDemand,
    expectedSupply: state.values.expectedDailySupply,
    provenance: state.origins,
    updatedAt: new Date(now).toISOString(),
    version,
  };
}
export function campusToState(campus: CampusState): OperationalState {
  return {
    values: {
      storageCapacity: campus.storageCapacity,
      currentStorage: campus.currentStorage,
      population: campus.population,
      dailyDemand: campus.dailyDemand,
      expectedDailySupply: campus.expectedSupply,
    },
    origins: campus.provenance,
  };
}
export function parseCampus(value: unknown): CampusState {
  const raw = object(value),
    location = object(raw.location),
    origins = object(raw.provenance);
  if (
    raw.schemaVersion !== 1 ||
    raw.campusId !== campusId ||
    !Number.isSafeInteger(raw.version) ||
    (raw.version as number) < 1 ||
    !validTimestamp(raw.updatedAt)
  )
    throw new RangeError("Invalid campus record metadata.");
  for (const [key, value] of Object.entries(siteLocation))
    if (location[key] !== value)
      throw new RangeError("Unsupported campus location.");
  const values = parseValues({
    storageCapacity: raw.storageCapacity,
    currentStorage: raw.currentStorage,
    population: raw.population,
    dailyDemand: raw.dailyDemand,
    expectedDailySupply: raw.expectedSupply,
  });
  for (const key of inputFields) {
    const origin = object(origins[key]);
    if (
      (origin.kind !== "seeded" && origin.kind !== "user") ||
      !validTimestamp(origin.timestamp)
    )
      throw new RangeError("Invalid input provenance.");
  }
  return stateToCampus(
    {
      values,
      origins: Object.fromEntries(
        inputFields.map((key) => [
          key,
          {
            kind: object(origins[key]).kind,
            category:
              object(origins[key]).kind === "seeded"
                ? "DEMO_SYNTHETIC"
                : "USER_PROVIDED",
            timestamp: object(origins[key]).timestamp,
          },
        ]),
      ) as CampusState["provenance"],
    },
    raw.version as number,
    Date.parse(raw.updatedAt),
  );
}
export function seedCampus(now: number): CampusState {
  return stateToCampus(seedOperations(), 1, now);
}
export function isExecution(value: unknown): value is Execution {
  return value === "aws-lambda" || value === "local-mock";
}

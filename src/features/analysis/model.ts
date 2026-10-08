import {
  parseLocation,
  timestamp,
  assertNoDemo,
  valued,
  categories,
} from "./provenance.ts";
import type { Value, AnalysisLocation, Provenance } from "./provenance.ts";
import { demandBaseline, zoneAnomalies } from "./records.ts";
import type { WaterRecord } from "./records.ts";
import { forecastStorage, validateInput } from "../forecast/model.ts";
import type { ForecastInput } from "../forecast/model.ts";
export interface ReservePolicy {
  kind: "essential-hours" | "volume";
  essentialFraction: number;
  essentialReserveHours: number;
  volumeLitres: number;
  warningReserveHours: number;
}
export interface RealAnalysis {
  mode: "REAL_ANALYSIS";
  location: Value<AnalysisLocation>;
  readingTimestamp: string;
  capacity: Value<number>;
  storage: Value<number>;
  supply: Value<number>;
  population: Value<number> | null;
  demand: Value<number> | null;
  demandMethod: "entered" | "history";
  records: WaterRecord[];
  reserve: Value<ReservePolicy>;
  additionalLoss: Value<number>;
}
export const indexPolicy = {
  version: "jd-wsi-1.0",
  weights: {
    storage: 25,
    balance: 25,
    runway: 30,
    anomalies: 10,
    rainfall: 10,
  },
  thresholds: { highStress: 40, watch: 70 },
  runwayTargetDays: 14,
} as const;
const clamp = (v: number) => Math.max(0, Math.min(100, v));
function validateValue(
  v: unknown,
  allowed: readonly string[],
  numeric = true,
): void {
  const x = v as Value<number>;
  if (
    !x ||
    !x.provenance ||
    !allowed.includes(x.provenance.category) ||
    !categories.includes(x.provenance.category) ||
    !timestamp(x.provenance.timestamp) ||
    typeof x.provenance.source !== "string" ||
    x.provenance.source.length > 500 ||
    !x.provenance.source.trim() ||
    (numeric && (!Number.isFinite(x.value) || x.value < 0 || x.value > 1e9))
  )
    throw new RangeError("Invalid value or provenance.");
}
export function reserveVolumes(
  demand: number,
  policy: ReservePolicy,
  capacity: number,
) {
  if (
    !policy ||
    !["essential-hours", "volume"].includes(policy.kind) ||
    !Number.isFinite(policy.essentialFraction) ||
    policy.essentialFraction <= 0 ||
    policy.essentialFraction > 1 ||
    !Number.isFinite(policy.essentialReserveHours) ||
    policy.essentialReserveHours <= 0 ||
    policy.essentialReserveHours > 168 ||
    !Number.isFinite(policy.warningReserveHours) ||
    policy.warningReserveHours < policy.essentialReserveHours ||
    policy.warningReserveHours > 336 ||
    !Number.isFinite(policy.volumeLitres) ||
    policy.volumeLitres < 0
  )
    throw new RangeError(
      "Choose an explicit valid reserve policy (hours/fraction or volume).",
    );
  const critical =
    policy.kind === "volume"
      ? policy.volumeLitres
      : (demand * policy.essentialFraction * policy.essentialReserveHours) / 24;
  const warning = Math.max(
    critical,
    (demand * policy.essentialFraction * policy.warningReserveHours) / 24,
  );
  if (critical > capacity || warning > capacity)
    throw new RangeError(
      "Reserve volumes exceed capacity; revise the reserve policy.",
    );
  return { critical, warning };
}
export function realForecastInput(
  analysis: RealAnalysis,
  horizonDays = 30,
): ForecastInput {
  if (
    !analysis ||
    typeof analysis !== "object" ||
    !Array.isArray(analysis.records)
  )
    throw new RangeError("Provide complete operational analysis and records.");
  assertNoDemo(analysis);
  if (
    analysis.mode !== "REAL_ANALYSIS" ||
    !timestamp(analysis.readingTimestamp)
  )
    throw new RangeError("Reading timestamp with timezone is required.");
  validateValue(analysis.location, ["USER_PROVIDED"], false);
  parseLocation(analysis.location.value);
  for (const v of [
    analysis.capacity,
    analysis.storage,
    analysis.supply,
    analysis.additionalLoss,
  ])
    validateValue(v, ["USER_PROVIDED", "IMPORTED_RECORD"]);
  if (analysis.capacity.value <= 0)
    throw new RangeError("Storage capacity must be positive.");
  if (
    Date.parse(analysis.storage.provenance.timestamp) !==
    Date.parse(analysis.readingTimestamp)
  )
    throw new RangeError(
      "Storage provenance must match the reading timestamp.",
    );
  if (analysis.population) {
    validateValue(analysis.population, ["USER_PROVIDED", "IMPORTED_RECORD"]);
    if (
      !Number.isInteger(analysis.population.value) ||
      analysis.population.value < 1
    )
      throw new RangeError("Occupancy must be a positive integer.");
  }
  validateValue(analysis.reserve, ["USER_PROVIDED"], false);
  if (analysis.records.length > 500)
    throw new RangeError("At most 500 records are supported.");
  const keys = new Set<string>();
  let prev = -Infinity;
  for (const r of analysis.records) {
    if (
      !r ||
      !timestamp(r.timestamp) ||
      typeof r.zone !== "string" ||
      !r.zone.trim() ||
      r.zone.length > 80 ||
      Date.parse(r.timestamp) < prev ||
      Date.parse(r.timestamp) > Date.parse(analysis.readingTimestamp)
    )
      throw new RangeError(
        "Records must be ordered and no later than the reading.",
      );
    const key = r.timestamp + "|" + r.zone;
    if (keys.has(key)) throw new RangeError("Duplicate record.");
    keys.add(key);
    prev = Date.parse(r.timestamp);
    let n = 0;
    for (const v of [r.storage_liters, r.supply_liters, r.consumption_liters])
      if (v) {
        validateValue(v, ["IMPORTED_RECORD"]);
        n++;
      }
    if (!n) throw new RangeError("Empty operational record.");
  }
  const demand =
    analysis.demandMethod === "history"
      ? demandBaseline(analysis.records, Date.parse(analysis.readingTimestamp))
      : analysis.demand;
  if (!demand)
    throw new RangeError(
      "Enter actual daily consumption or import sufficient site history.",
    );
  if (
    analysis.demandMethod !== "entered" &&
    analysis.demandMethod !== "history"
  )
    throw new RangeError("Invalid demand method.");
  validateValue(
    demand,
    analysis.demandMethod === "history"
      ? ["CALCULATED"]
      : ["USER_PROVIDED", "IMPORTED_RECORD"],
  );
  const reserve = reserveVolumes(
    demand.value,
    analysis.reserve.value,
    analysis.capacity.value,
  );
  const input: ForecastInput = {
    capacityLitres: analysis.capacity.value,
    startingStorageLitres: analysis.storage.value,
    dailySupplyLitres: analysis.supply.value,
    dailyDemandLitres: demand.value,
    dailyAnomalyLossLitres: analysis.additionalLoss.value,
    warningReserveLitres: reserve.warning,
    criticalReserveLitres: reserve.critical,
    horizonDays,
    startTimeMs: Date.parse(analysis.readingTimestamp),
  };
  validateInput(input);
  return input;
}
export interface IndexContext {
  rainfallRatio?: number;
  rainfallProvenance?: Provenance;
}
export function waterSecurityIndex(
  input: ForecastInput,
  records: WaterRecord[],
  context: IndexContext = {},
) {
  validateInput(input);
  const f = forecastStorage(input),
    anomalies = zoneAnomalies(records, input.startTimeMs),
    adequate = anomalies.filter((a) => a.status !== "INSUFFICIENT HISTORY");
  const scores: {
    key: keyof typeof indexPolicy.weights;
    score: number | null;
    reason: string;
  }[] = [
    {
      key: "storage",
      score:
        input.capacityLitres === input.criticalReserveLitres
          ? 0
          : clamp(
              ((input.startingStorageLitres - input.criticalReserveLitres) /
                (input.capacityLitres - input.criticalReserveLitres)) *
                100,
            ),
      reason: "Storage above critical reserve / capacity above reserve",
    },
    {
      key: "balance",
      score:
        input.dailyDemandLitres + input.dailyAnomalyLossLitres === 0
          ? 100
          : clamp(
              (input.dailySupplyLitres /
                (input.dailyDemandLitres + input.dailyAnomalyLossLitres)) *
                100,
            ),
      reason: "Expected supply / total daily outflow",
    },
    {
      key: "runway",
      score: f.criticalCrossing
        ? clamp((f.criticalCrossing.day / indexPolicy.runwayTargetDays) * 100)
        : 100,
      reason:
        "Days to critical / 14 days, capped at 100; no crossing in 30 days scores 100",
    },
    {
      key: "anomalies",
      score: adequate.length
        ? clamp(
            100 *
              (1 -
                adequate.filter((a) => a.status === "POTENTIAL ANOMALY")
                  .length /
                  adequate.length),
          )
        : null,
      reason:
        "Share of assessed zones without an upper-deviation flag; missing without adequate history",
    },
    {
      key: "rainfall",
      score:
        context.rainfallRatio !== undefined &&
        Number.isFinite(context.rainfallRatio) &&
        context.rainfallRatio >= 0 &&
        context.rainfallProvenance?.category === "CALCULATED"
          ? clamp(context.rainfallRatio * 100)
          : null,
      reason:
        "Recent / same-season historical precipitation; capped, context only",
    },
  ];
  const availableWeight = scores.reduce(
    (s, c) => s + (c.score === null ? 0 : indexPolicy.weights[c.key]),
    0,
  );
  const components = scores.map((c) => ({
    ...c,
    weight: indexPolicy.weights[c.key],
    contribution:
      c.score === null
        ? null
        : (c.score * indexPolicy.weights[c.key]) / availableWeight,
  }));
  const score = Math.round(
    components.reduce((s, c) => s + (c.contribution ?? 0), 0),
  );
  return {
    score,
    classification:
      score < indexPolicy.thresholds.highStress
        ? "HIGH STRESS"
        : score < indexPolicy.thresholds.watch
          ? "WATCH"
          : "LOWER OPERATIONAL STRESS",
    components,
    dataCompleteness: {
      available: components.filter((c) => c.score !== null).length,
      total: components.length,
      availableWeight,
    },
    modelVersion: indexPolicy.version,
    disclaimer:
      "This is a JalDrishti decision-support index, not an official government or scientific standard.",
  };
}
export function runAnalysis(
  analysis: RealAnalysis,
  context: IndexContext = {},
) {
  const input = realForecastInput(analysis),
    baseline = forecastStorage(input),
    anomalies = zoneAnomalies(analysis.records, input.startTimeMs);
  return {
    input,
    baseline,
    anomalies,
    index: waterSecurityIndex(input, analysis.records, context),
    provenance: valued(
      input,
      "MODEL_OUTPUT",
      "JalDrishti deterministic storage engine",
      analysis.readingTimestamp,
      "Constant operational rates; environmental context does not alter storage",
    ),
    demand:
      analysis.demandMethod === "history"
        ? demandBaseline(analysis.records, input.startTimeMs)
        : analysis.demand!,
  };
}

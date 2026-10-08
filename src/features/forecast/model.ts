export interface ForecastInput {
  capacityLitres: number;
  startingStorageLitres: number;
  dailySupplyLitres: number;
  dailyDemandLitres: number;
  dailyAnomalyLossLitres: number;
  warningReserveLitres: number;
  criticalReserveLitres: number;
  horizonDays: number;
  startTimeMs: number;
  initialSupplementaryLitres?: number;
  supplyDelayDays?: number;
}
export interface StoragePoint {
  day: number;
  timeMs: number;
  storageLitres: number;
}
export interface ThresholdCrossing {
  day: number;
  timeMs: number;
}
export interface ForecastResult {
  points: StoragePoint[];
  warningCrossing: ThresholdCrossing | null;
  criticalCrossing: ThresholdCrossing | null;
  minimumStorageLitres: number;
  netDailyDeficitLitres: number;
  horizonDays: number;
  assumptions: readonly string[];
}
const DAY_MS = 86400000;
export function validateInput(input: ForecastInput): void {
  for (const [key, value] of Object.entries(input)) {
    if (
      value === undefined &&
      (key === "initialSupplementaryLitres" || key === "supplyDelayDays")
    )
      continue;
    if (!Number.isFinite(value)) throw new RangeError(key + " must be finite");
  }
  if (
    input.capacityLitres <= 0 ||
    input.startingStorageLitres < 0 ||
    input.startingStorageLitres > input.capacityLitres
  )
    throw new RangeError("Invalid capacity or starting storage");
  if (
    [
      input.dailySupplyLitres,
      input.dailyDemandLitres,
      input.dailyAnomalyLossLitres,
      input.criticalReserveLitres,
      input.initialSupplementaryLitres ?? 0,
    ].some((v) => v < 0)
  )
    throw new RangeError(
      "Rates, reserves and supplementary water must be nonnegative",
    );
  if (
    input.warningReserveLitres < input.criticalReserveLitres ||
    input.warningReserveLitres > input.capacityLitres
  )
    throw new RangeError(
      "Reserves must satisfy critical <= warning <= capacity",
    );
  if (
    !Number.isInteger(input.horizonDays) ||
    input.horizonDays < 1 ||
    input.horizonDays > 365
  )
    throw new RangeError("Horizon must be an integer from 1 to 365 days");
  const delay = input.supplyDelayDays ?? 0;
  if (!Number.isInteger(delay) || delay < 0 || delay > 365)
    throw new RangeError("Supply delay must be an integer from 0 to 365 days");
}
const clamp = (input: ForecastInput, value: number) =>
  Math.min(input.capacityLitres, Math.max(0, value));
const initialStorage = (input: ForecastInput) =>
  clamp(
    input,
    input.startingStorageLitres + (input.initialSupplementaryLitres ?? 0),
  );
function deficitForDay(input: ForecastInput, day: number): number {
  const supply =
    day <= (input.supplyDelayDays ?? 0) ? 0 : input.dailySupplyLitres;
  return input.dailyDemandLitres + input.dailyAnomalyLossLitres - supply;
}
export function storageAtDay(input: ForecastInput, day: number): number {
  validateInput(input);
  if (!Number.isFinite(day) || day < 0 || day > 365)
    throw new RangeError("Day must be between 0 and 365");
  let storage = initialStorage(input);
  const wholeDays = Math.floor(day);
  for (let step = 1; step <= wholeDays; step++)
    storage = clamp(input, storage - deficitForDay(input, step));
  return clamp(
    input,
    storage - deficitForDay(input, wholeDays + 1) * (day - wholeDays),
  );
}
export function forecastStorage(input: ForecastInput): ForecastResult {
  validateInput(input);
  const startStorage = initialStorage(input);
  const points: StoragePoint[] = [
    { day: 0, timeMs: input.startTimeMs, storageLitres: startStorage },
  ];
  let warningCrossing: ThresholdCrossing | null =
    startStorage <= input.warningReserveLitres
      ? { day: 0, timeMs: input.startTimeMs }
      : null;
  let criticalCrossing: ThresholdCrossing | null =
    startStorage <= input.criticalReserveLitres
      ? { day: 0, timeMs: input.startTimeMs }
      : null;
  for (let day = 1; day <= input.horizonDays; day++) {
    const previous = points[day - 1].storageLitres,
      deficit = deficitForDay(input, day),
      storage = clamp(input, previous - deficit);
    points.push({
      day,
      timeMs: input.startTimeMs + day * DAY_MS,
      storageLitres: storage,
    });
    const crossing = (threshold: number): ThresholdCrossing | null => {
      if (deficit <= 0 || previous <= threshold || storage > threshold)
        return null;
      // Interpolate with the day's unclamped rate, preserving first crossings through outages.
      const crossingDay = day - 1 + (previous - threshold) / deficit;
      return {
        day: crossingDay,
        timeMs: input.startTimeMs + crossingDay * DAY_MS,
      };
    };
    warningCrossing ??= crossing(input.warningReserveLitres);
    criticalCrossing ??= crossing(input.criticalReserveLitres);
  }
  return {
    points,
    warningCrossing,
    criticalCrossing,
    minimumStorageLitres: Math.min(...points.map((p) => p.storageLitres)),
    netDailyDeficitLitres:
      input.dailyDemandLitres +
      input.dailyAnomalyLossLitres -
      input.dailySupplyLitres,
    horizonDays: input.horizonDays,
    assumptions: [
      "Demand and anomaly loss are constant; daily supply resumes after any initial delay.",
      "Anomaly loss is additional to metered demand; no double counting is assumed.",
      "Threshold timing assumes uniform rates within each day.",
      "Supplementary water arrives once at the forecast start, before daily consumption; tank capacity limits retained volume.",
      "Initial delayed supply days receive zero scheduled supply; missed deliveries are not made up.",
      "Storage is clamped to tank capacity and zero; unmet demand and overflow are not allocated.",
    ],
  };
}
export function recommendedIntervention(
  input: ForecastInput,
  reductionPercent: number,
): ForecastInput {
  if (
    !Number.isFinite(reductionPercent) ||
    reductionPercent < 0 ||
    reductionPercent > 100
  )
    throw new RangeError("Reduction must be 0–100%");
  validateInput(input);
  return {
    ...input,
    dailyAnomalyLossLitres: 0,
    dailyDemandLitres: input.dailyDemandLitres * (1 - reductionPercent / 100),
  };
}
export function compareForecasts(
  input: ForecastInput,
  scenarioInput: ForecastInput,
) {
  if (
    input.startTimeMs !== scenarioInput.startTimeMs ||
    input.horizonDays !== scenarioInput.horizonDays
  )
    throw new RangeError(
      "Comparisons require matching start times and horizons",
    );
  const baseline = forecastStorage(input),
    intervention = forecastStorage(scenarioInput),
    baselineCritical = baseline.criticalCrossing;
  return {
    baseline,
    intervention,
    resilienceHours:
      baselineCritical && intervention.criticalCrossing
        ? (intervention.criticalCrossing.day - baselineCritical.day) * 24
        : null,
    waterPreservedLitres: baselineCritical
      ? storageAtDay(scenarioInput, baselineCritical.day) -
        storageAtDay(input, baselineCritical.day)
      : null,
    comparisonDay: baselineCritical?.day ?? null,
  };
}
export function compareIntervention(
  input: ForecastInput,
  reductionPercent: number,
) {
  return compareForecasts(
    input,
    recommendedIntervention(input, reductionPercent),
  );
}

import type { ForecastInput } from "../forecast/model.ts";
import { evaluateScenario } from "../simulator/adapter.ts";
import type { ScenarioControls } from "../simulator/adapter.ts";
import { realForecastInput } from "../analysis/model.ts";
import type { RealAnalysis } from "../analysis/model.ts";
import { timestamp } from "../analysis/provenance.ts";
import { demandBaseline } from "../analysis/records.ts";

export type DecisionContext =
  | { mode: "SAMPLE_DEMO"; input: ForecastInput; siteName: string }
  | { mode: "REAL_ANALYSIS"; analysis: RealAnalysis };

export function buildDecisionBrief(
  context: DecisionContext,
  controls: ScenarioControls,
  generatedAt: string = new Date().toISOString(),
) {
  if (!timestamp(generatedAt)) throw new RangeError("Invalid generation timestamp");
  // Real inputs go through the existing provenance and operational validator.
  const input = context.mode === "REAL_ANALYSIS"
    ? realForecastInput(context.analysis) : context.input;
  const result = evaluateScenario(input, controls, input.horizonDays);
  const changeHours = result.resilienceHours;
  const outcome = changeHours != null
    ? changeHours > 1e-7 ? "later" : changeHours < -1e-7 ? "earlier" : "unchanged"
    : result.resilienceLowerBoundHours != null ? "lower-bound" : "not-comparable";
  const crossing = (value: { day: number; timeMs: number } | null) => value
    ? { day: value.day, timestamp: new Date(value.timeMs).toISOString() } : null;
  const provenance = context.mode === "REAL_ANALYSIS"
    ? Object.fromEntries(["location", "capacity", "storage", "supply", "demand", "additionalLoss", "reserve"]
      .map(key => [key, context.analysis[key as keyof RealAnalysis]])
      .map(([key, value]) => [key, value && typeof value === "object" && "provenance" in value ? value.provenance : null]))
    : { category: "DEMO_SYNTHETIC", source: "Illustrative Sample Demo, including local edits", timestamp: new Date(input.startTimeMs).toISOString() };
  const demandProvenance = context.mode === "REAL_ANALYSIS"
    ? (context.analysis.demandMethod === "history" ? demandBaseline(context.analysis.records, input.startTimeMs) : context.analysis.demand)?.provenance ?? null
    : null;
  return structuredClone({
    schemaVersion: 1, generatedAt, mode: context.mode,
    siteName: context.mode === "REAL_ANALYSIS" ? context.analysis.location.value.name : context.siteName,
    modelVersion: "deterministic-storage-v1", reportVersion: "decision-brief-v1",
    basis: context.mode === "SAMPLE_DEMO"
      ? "SYNTHETIC DEMO — not measured water savings"
      : "User/imported operational inputs — not independently verified measurements",
    input, controls, provenance: context.mode === "REAL_ANALYSIS" ? { ...provenance, demand: demandProvenance } : provenance,
    demandBasis: context.mode === "REAL_ANALYSIS"
      ? { method: context.analysis.demandMethod, acceptedRecordCount: context.analysis.records.length, sourceRecords: context.analysis.records.filter(r => r.zone === "site" && r.consumption_liters).map(r => ({ timestamp: r.timestamp, provenance: r.consumption_liters!.provenance })) }
      : { method: "illustrative-operational-input", acceptedRecordCount: 0 },
    comparison: {
      horizonDays: input.horizonDays, outcome,
      baselineCritical: crossing(result.baseline.criticalCrossing),
      scenarioCritical: crossing(result.intervention.criticalCrossing),
      changeHours, lowerBoundHours: result.resilienceLowerBoundHours,
      storageDifferenceLitres: result.waterPreservedLitres,
      comparisonDay: result.comparisonDay,
      baselineDailyDeficitLitres: result.baseline.netDailyDeficitLitres,
      scenarioDailyDeficitLitres: result.intervention.netDailyDeficitLitres,
      retainedTopUpLitres: result.retainedSupplementaryLitres,
      unretainedTopUpLitres: result.unretainedSupplementaryLitres,
    },
    assumptions: result.intervention.assumptions,
    verifyBeforeActing: [
      "Confirm tank readings, reserve policy and delivered supply with the site operator.",
      "Check that any entered additional loss is outside measured demand; repair is a hypothesis, not a leak diagnosis.",
      "Confirm essential-use needs and the feasibility of demand reduction or supplementary supply.",
      "Recalculate after new readings or supply changes. Regional weather does not measure tank storage.",
    ],
    limitations: [
      "Deterministic constant-rate scenario, not statistical confidence or validated prediction accuracy.",
      "Storage difference is measured in the model at baseline critical time, not cumulative or observed water savings.",
      "No crossing means no crossing within the specified horizon, not indefinite safety.",
      "Top-up is one-time and capacity-limited; delayed supply has no catch-up deliveries.",
      "No weather-to-storage relationship, intervention costs or operational feasibility optimization is modeled.",
    ],
  });
}

import { operationalForecastInput, seedOperations } from "../system/model";
import { demo } from "@/lib/demo-data";
import { forecastPolicy } from "./policy";
import { compareIntervention } from "./model";
import type { ForecastInput } from "./model";
export function demoForecastInput(
  horizonDays: number = forecastPolicy.defaultHorizonDays,
): ForecastInput {
  return operationalForecastInput(seedOperations().values, horizonDays);
}
export const demoComparison = compareIntervention(
  demoForecastInput(forecastPolicy.comparisonHorizonDays),
  demo.reductionPercent,
);
export function formatForecastTime(timeMs: number | null | undefined): string {
  if (timeMs == null) return "Not reached within comparison horizon";
  return (
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(timeMs)) + " IST"
  );
}

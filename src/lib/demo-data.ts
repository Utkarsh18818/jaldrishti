import { campusSeed } from "./campus-seed";
import { deriveOperations, seedOperations } from "../features/system/model";
export type RiskLevel = "stable" | "watch" | "high" | "critical";
export interface CampusDemo {
  location: string;
  population: number;
  storageCapacity: number;
  currentStorage: number;
  dailyDemand: number;
  expectedDailySupply: number;
  netDeficit: number;
  score: number;
  status: string;
  risk: RiskLevel;
  criticalDays: number;
  criticalTime: string;
  anomalyPercent: number;
  possibleLoss: number;
  intervention: string;
  reductionPercent: number;
  waterPreserved: number;
  resilienceHours: number;
  updatedScore: number;
}
const seeded = deriveOperations(seedOperations());
const calculated = seeded.comparison;
export const demo: Readonly<CampusDemo> = Object.freeze({
  ...campusSeed,
  anomalyPercent: seeded.anomaly.variancePercent!,
  netDeficit: calculated.baseline.netDailyDeficitLitres,
  criticalDays: calculated.baseline.criticalCrossing!.day,
  criticalTime:
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(calculated.baseline.criticalCrossing!.timeMs)) + " IST",
  resilienceHours: Number(calculated.resilienceHours!.toFixed(1)),
  waterPreserved: Math.round(calculated.waterPreservedLitres!),
});
export const formatLitres = (value: number) =>
  new Intl.NumberFormat("en-IN").format(value) + " L";
export const environmentalDemo = Object.freeze({
  rainfallBelowBaseline: 18,
  soilMoisture: "Low",
  groundwater: "Declining",
  anomalyInspection: "Inspect Block C supply line",
});
// Presentation-only equal-width bands, not a scientific score classification.
export const securityScale = [
  { label: "Critical", risk: "critical", range: "0–24" },
  { label: "High Stress", risk: "high", range: "25–49" },
  { label: "Watch", risk: "watch", range: "50–74" },
  { label: "Stable", risk: "stable", range: "75–100" },
] as const;

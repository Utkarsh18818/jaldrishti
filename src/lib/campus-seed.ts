import { siteLocation } from "./location.ts";
export const campusSeed = Object.freeze({
  location: siteLocation.campusName,
  population: 420,
  storageCapacity: 50000,
  currentStorage: 31000,
  dailyDemand: 12500,
  expectedDailySupply: 8000,
  score: 43,
  status: "High Stress",
  risk: "high" as const,
  possibleLoss: 1620,
  intervention: "Repair suspected Block C leak",
  reductionPercent: 10,
  updatedScore: 71,
});

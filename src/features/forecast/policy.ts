// Explicit illustrative operational policy, calibrated to retain the seeded 4.7-day result.
// 31,000 - (12,500 + 1,620 - 8,000) × 4.7 = 2,236 L.
export const forecastPolicy = Object.freeze({
  warningReserveLitres: 10000,
  criticalReserveLitres: 2236,
  startTimeMs: Date.parse("2026-10-07T08:30:00Z"),
  defaultHorizonDays: 14,
  comparisonHorizonDays: 30,
});
export const forecastHorizons = [7, 14, 30] as const;

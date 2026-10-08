# Scenario adapter

All inputs are seeded demo operational assumptions. No external measurements.
The approved forecast/model.ts remains the only storage calculation engine. Optional initial supplementary volume and initial scheduled-supply delay extend that engine without changing Phase 2 defaults.

- Demand = base metered demand × occupancyPercent/100 × (1-reductionPercent/100).
- Occupancy does not scale scheduled supply or leak loss.
- Repair ON removes daily anomaly loss immediately.
- Supplementary volume arrives once at day zero before consumption, and is capped by available tank capacity. Excess volume is reported as unretained, not credited as storage preserved.
- Delay of N days means scheduled supply is zero during the first N daily intervals. Normal supply resumes on interval N+1, with no makeup deliveries.
- Demand and leak loss continue during the supply delay.
- The engine retains the first downward threshold crossing even if subsequent supply refills storage.
- Constant rates within each daily interval determine fractional crossing times. storageAtDay shares the same daily schedule logic.
- Results use a 30-day comparison window; the chart can show 7, 14 or 30 days. No-crossing results are bounded to that window, never claimed infinite.
- Water preserved is signed additional storage at original baseline critical time (day 4.7), after capacity/zero clamping. It is not total avoided demand or cumulative deliveries.
- Rainfall remains disabled after public environmental integration: a verified physical harvesting model is required before rainfall can change storage.

Presets:
Recommended: repair ON, reduction 10%, top-up 0 L, delay 0 days, occupancy 100%. Reproduces Phase 2: 8.850461538 days to critical, +99.611076923 hours, +13,489 L storage at baseline critical time.
No intervention/reset: repair OFF, reduction 0%, top-up 0 L, delay 0, occupancy 100%. Baseline 4.7 days, 6,120 L/day deficit, zero impact.
Supply interruption: baseline controls with one day delay. Critical 3.392810458 days; approximately 10 October 2026 23:25 IST; resilience -31.372549 hours; storage difference -2,236 L at baseline critical time. Deficit during delay 14,120 L/day, then 6,120 L/day.
Reference time remains 7 October 2026 14:00 IST. Critical reserve remains the calibrated demo policy level of 2,236 L; warning remains 10,000 L. No score calculation, AI, real rainfall influence or independent second model.


Phase 5: the baseline may now contain explicitly user-provided operational inputs from System. Scenario controls transform that shared baseline through the unchanged adapter and engine. Simulate repair opens the recommended scenario with repair enabled. No external weather alters these calculations.

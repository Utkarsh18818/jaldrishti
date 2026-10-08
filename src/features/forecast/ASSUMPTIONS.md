# Deterministic demo forecast

Reference: 2026-10-07 14:00 IST (fixed seeded instant, never the real-time clock).
Baseline daily deficit: 12,500 + 1,620 - 8,000 = 6,120 L/day. The 12,500 L demand is assumed to exclude suspected leakage. This is an explicit assumption, not a live measurement.
Warning reserve: 10,000 L (illustrative 20% of 50,000 L capacity).
Critical operational reserve: 2,236 L. This is calibrated to retain the original 4.7-day seeded forecast: 31,000 - 6,120 × 4.7 = 2,236. It is not an independently validated safety threshold.
Baseline critical: 12 October 2026 06:48 IST.
Immediate repair removes 1,620 L/day. A 10% reduction changes demand to 11,250 L/day. New deficit: 3,250 L/day.
Intervention critical: 8.850461538 days from reference, 16 October 2026 approximately 10:24:40 IST.
Resilience gained: 99.611076923 hours.
Water preserved: 13,489 L additional storage at baseline critical time (day 4.7), not a whole-horizon saving. Baseline stores 2,236 L; intervention stores 15,725 L.
Daily steps clamp to zero and capacity. Within-day crossing uses constant unclamped rates to avoid distortion from the final clamped daily point.
Crossings outside the requested horizon are null. Comparison dates use a separately labeled fixed 30-day window, so the 7-day chart can still show the later intervention date transparently.
No stochastic uncertainty, rain influence, seasonality, supply variability, reserve policy validation, repair delay, unmet-demand allocation, or overflow accounting.
The previous Friday time, +47 hours and 12,600 L impact are replaced by calculated outputs. The post-intervention score of 71 remains explicitly illustrative and is not produced by this engine.

Phase 5: the System workspace now supplies the shared local/demo operational baseline. The seed regression above remains the default; edited capacity, storage, demand and supply use the same engine. Fixed reserves and forecast epoch remain unchanged. See ../system/ASSUMPTIONS.md for provenance and validation.

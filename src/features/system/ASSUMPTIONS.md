# Local operational intelligence — Phase 5

## One operational baseline

campus-seed.ts is the canonical fixed seed. system/model.ts converts operational values to the existing ForecastInput and derives results through compareIntervention. It does not implement another storage calculation. system/context.tsx holds one in-memory React state in the dashboard layout; System, Overview, Forecast and Simulator read it. In-dashboard navigation preserves applied inputs; a reload, leaving the dashboard or a new browser tab initializes the seed. No localStorage, database, authentication, network submission or tank telemetry.

Editable inputs: storage capacity, current storage, population, expected daily demand and expected daily supply. Draft form fields do not change results until Apply local inputs succeeds. Validation is atomic: finite nonnegative operational values at most 1 billion; positive integral population up to 1 million; capacity at least the fixed 10,000 L warning reserve; current storage within capacity. The existing engine validates reserves and rates as well. Rejecting input leaves the last applied baseline intact. Population is descriptive only and does not multiply entered demand; users must enter the corresponding expected demand explicitly.

Forecast reference remains 7 October 2026 14:00 IST to preserve approved regressions. An input's editedAt timestamp is an audit time, not a newly assumed forecast epoch or measurement date. Critical reserve remains 2,236 L; warning remains 10,000 L and no longer represents 20% when capacity changes. Both are illustrative policies, not validated safety requirements. Anomaly loss remains an uneditable seeded assumption of 1,620 L/day in this phase. It is deliberately outside the entered normal demand to avoid counting it twice within the model. Real demand may already include it, so it must be verified before operational use.

## Provenance

- SEEDED DEMO: original inputs, fixed reserves, loss assumption, scores and profiles; reference timestamp is the fixed demo epoch.
- USER PROVIDED: fields whose values have been changed by an explicit successful form submission; each changed field gets its own timestamp. Unchanged resubmissions preserve origin/time. Entering the original value after changing it remains user-provided until Reset demo.
- CALCULATED: signed net deficit from the existing engine, zone allocations and intervention storage differences.
- DETECTED FROM SEEDED USAGE PROFILE: a computed variance in a constructed usage profile, never a sensor detection or proof of leakage.
- MODEL OUTPUT: first reserve crossing and dates from the existing engine.

The System form shows applied provenance beside draft inputs; draft edits are not new applied data until submission. Reset demo restores values and seed provenance. The illustrative 43/100 and 71/100 security scores remain fixed and explicitly labeled; they do not react to input edits, weather or calculated resilience.

## Water balance and zones

The existing engine's deficit = demand + additional anomaly loss − supply. The flow shows the signed storage change, its negative: supply − demand − additional anomaly loss. Positive deficit is depletion; negative deficit is surplus. Default: 8,000 − 12,500 − 1,620 = −6,120 L/day. Starting storage 31,000 L of 50,000 L capacity; baseline critical after 4.7 days, 12 October 2026 06:48 IST. Recommended repair and 10% reduction retain +99.611076923 h resilience and +13,489 L at the original baseline critical time.

Constructed normal zone baselines: Block A 2,000, Block B 1,500, Block C 6,000, Hostel 2,000, Cafeteria 1,000 L/day, summing to 12,500 L/day. All baseline shares scale proportionally with the entered normal daily demand. Block C receives the separate fixed seeded 1,620 L/day excess. Thus modeled zone use sums to entered demand plus anomaly loss, default 14,120 L/day. The figure 12,500 represents normal demand excluding the potential loss; the zone profile is not a second meter dataset and never overwrites the operational engine.

Default Block C demo usage 7,620 versus normal 6,000 L/day gives 1,620/6,000 ×100 = +27%. With changed demand, its scaled baseline and variance change; potential loss stays seeded. At zero demand baseline, percentage variance is undefined and displayed without infinity. Modeled/estimated allocations are labeled as constructed, not real observations. No new anomaly-detection model, statistical validation or confirmed leak.

Investigate opens an inspection checklist in the Block C detail panel; it does not create an incident or task. Simulate repair navigates to /dashboard/simulator?repair=on, initializing the recommended scenario with repair enabled against the current applied baseline. Scenario controls remain separate assumptions and do not mutate that baseline.

## Location and environmental boundary

Option A chosen: rename site to Pune Demo Campus, tied explicitly to the previously approved Pune example weather region. location.ts is shared by the campus seed and environmental adapter. Coordinates 18.5204 N, 73.8567 E identify the example region, not a verified building or sensor. The Data workspace still retains the separate returned model grid, source, timestamps and fallback rules. External weather does not modify local storage or operational inputs.

## Edge cases

The existing engine supports already critical storage, surplus and no reserve crossing. System/Overview use the 30-day comparison for critical dates; Forecast charts have independent 7/14/30-day horizons; Simulator comparisons remain 30 days. If baseline has no critical crossing, relative impact at baseline crossing is undefined and displayed as not evaluated. No invented zero storage difference or infinite resilience. Engine and simulator adapter remain unchanged.

Phase 6: default LOCAL DEMO retains the behavior above. A configured AWS API can load and save the same baseline with server-stamped provenance and optimistic versions. Confirmed saves persist through reload; unconfirmed writes are explicitly local. Forecast dates/reserves stay fixed to the approved demo policy. See ../../../infra/README.md.

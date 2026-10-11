# Refreshed demo recording — 11 October 2026

Target: 2:45, eight scenes. Offline synthetic voice; anonymous live application recording. Sample values are synthetic. Architecture is explicitly an explanatory card with read-only verified deployment facts, not an AWS Console recording. No YouTube upload.

## 0–18 seconds · Scene 1

A campus can have water today and still be heading toward a shortage. I built JalDrishti to make that risk understandable: see the water balance, estimate the reserve window, and compare actions before a crisis.

Browser actions: enterDemo.

## 18–35 seconds · Scene 2

This is the Pune Sample Demo. Every operational value here is synthetic, not a sensor reading. The overview brings storage, demand, supply, and the modeled reserve window together so the next decision is clear.

Browser actions: overviewCheckpoint.

## 35–62 seconds · Scene 3

The forecast uses a deterministic water balance: starting storage, plus supply, minus demand and explicitly assumed additional loss. It tracks when storage crosses an operational reserve, not when the tank is empty. Switching the horizon changes the chart; the assumptions stay visible. These are scenario estimates, not machine learning predictions.

Browser actions: forecastChart; horizon (7); horizon (30); horizon (14); forecastAssumptions.

## 62–99 seconds · Scene 4

Here I can test a decision using the same engine. No intervention restores the baseline. A supply interruption moves the reserve crossing earlier. Now I apply the recommended example: remove the assumed Block C loss and reduce demand by ten percent. The chart and reserve timing respond immediately. This compares assumptions; it does not prove a leak was repaired or water was actually saved.

Browser actions: scenarioControls; preset (No intervention); preset (Supply interruption); preset (Recommended intervention); showReduction; scenarioResults; decisionBrief.

## 99–120 seconds · Scene 5

This public Data screen is an offline fixture. The Open-Meteo integration retains source, time, and freshness, but regional weather is not a tank measurement. Rainfall cannot change modeled storage without a verified harvesting relationship.

Browser actions: sourceTimestamps; weatherLimits.

## 120–138 seconds · Scene 6

Real Analysis starts empty, without synthetic defaults. Site readings and validated CSV records carry provenance and reserve policies. Cloud save and reload are operator protected and were verified separately. I am keeping credentials off screen.

Browser actions: emptySetup.

## 138–155 seconds · Scene 7

Next.js runs in a frontend AWS Lambda with Lambda Web Adapter. IAM protects its calls to the backend Lambda; DynamoDB stores validated analysis. The anonymous sample calculates locally and never writes real records.

Browser actions: architecturePath; architectureLocal.

## 155–165 seconds · Scene 8

JalDrishti makes assumptions visible and decisions testable. The next step is validating it against measured site records. Thank you.

Browser actions: finalHold.

Real Analysis currently has no saved record. This recording does not demonstrate a new cloud save or restored field records. Preserve this qualification in any submission. Final artifacts remain on A: under artifacts/video-prep/usability-refresh/final; final verification is reported in REFINEMENT-REPORT.md.

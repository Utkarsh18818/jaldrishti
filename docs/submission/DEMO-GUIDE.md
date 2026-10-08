# Judge demo guide

[Open JalDrishti](https://oesv4kceg4gzmoozx7x7adnwwm0tirfq.lambda-url.ap-southeast-2.on.aws/) · [Home](../../README.md)

## Public walkthrough

1. From the landing page choose **Explore Pune Demo Campus**. No AWS account or password is needed.
2. **Overview:** inspect storage runway, the explicitly seeded score, the assumed Block C anomaly and model-derived comparison. These are synthetic fixtures, not measured campus outcomes.
3. **System:** inspect input provenance and balance; change a value and apply local inputs. Navigation shares that local baseline; refresh resets it.
4. **Forecast:** switch 7/14/30-day chart horizons, compare reserve crossings and open the assumptions/daily values.
5. **Simulator:** try Supply interruption, Recommended intervention and a custom demand reduction. Supplementary water and supply delay use the same engine. Rainfall/recharge is disabled pending a verified physical capture model.
6. **Data:** inspect the labeled offline fixture, source and valid windows. These values are not Open-Meteo observations. Hosted live environmental refresh is operator-protected and may remain unavailable to judges.

![Actual scenario simulator](screenshots/simulator.png)

## Real Analysis

**Analyze my site** opens a separate empty workspace. It does not fill in demo values. Local analysis requires explicit location, storage/read time, supply/demand, additional-loss and reserve inputs; accepted CSV records can support the demand baseline. Read the source/timestamp labels and assumptions.

Cloud Save/Load requires the private operator flow. Do not ask judges to supply AWS credentials or share the operator code. Automated launch verification used a uniquely labeled reversible fixture, tested reload/conflicts/provenance and removed it conditionally; no actual operational record was overwritten. This guide supplies no credentials and does not create a test record.

Do not present model outputs as calibrated predictions, confirmed leakage or measured water savings. The demo's example coordinates identify Pune's region, not a verified building.

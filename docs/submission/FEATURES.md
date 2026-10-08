# Implemented features and boundaries

[Home](../../README.md) · [Architecture](ARCHITECTURE.md)

| Area | Implemented | Boundary |
| --- | --- | --- |
| Sample Overview/System | Synthetic baseline, editable local inputs, provenance and water balance | No tank sensors; fixed illustrative score; no cloud writes from public demo |
| Forecast | 7/14/30-day SVG trajectories, reserve crossings and baseline comparison | Deterministic constant-rate assumptions; no uncertainty or validated accuracy |
| Simulator | Demand reduction, supplementary volume, supply delay, demand multiplier, assumed-loss repair | Shared engine; rainfall control disabled; no cost optimization or actual repair confirmation |
| Real Analysis | Empty-start inputs, CSV validation, explicit reserves, median demand and MAD zone flags | User assertion is not independent measurement verification |
| Decision support | Versioned component index, contributions and missing-data renormalization | Engineering heuristic; not a government standard or validated drought score |
| Environmental data | Typed Open-Meteo ICON, ECMWF and ERA5 ingestion with source/time/freshness | Regional estimates/reanalysis, not building storage or groundwater observation |
| Groundwater | Source-qualified user import with date/location/depth checks | No automatic CGWB API or authenticated satellite download |
| Cloud persistence | Operator session, schema-v2 DynamoDB save/load, expected-version conflicts | Single operator; accepted records persisted, raw CSV/rejected rows remain local |
| Public delivery | Lambda Web Adapter, existing HTTPS URL, alias-scoped URL grants | Public requests incur usage; no WAF/global app throttling |

NASA POWER and SMAP were evaluated, not integrated. Alerts, Actions and Impact remain placeholder workspaces. No IoT, AI assistant, ML model, geospatial forecasting platform or multi-tenant authentication is implemented.

Scientific detail: [forecast](../../src/features/forecast/ASSUMPTIONS.md), [simulator](../../src/features/simulator/ASSUMPTIONS.md), [operational model](../../src/features/system/ASSUMPTIONS.md), [real analysis](../../src/features/analysis/README.md), [environment sources](../../src/features/environment/SOURCES.md).

# Winning environmental projects: evidence and JalDrishti implementation

Research date: 11 October 2026. Scope: four core winners from four annual competition editions, plus two relevant NASA winners and two environmental interfaces. These are documented international competitions, not an objective ranking of the world's best hackathons. Winning a previous event does not predict this event's result.

## Verified winners and distinctive implementation

| Project | Confirmed award | Distinctive implementation supported by the source | JalDrishti adaptation |
| --- | --- | --- | --- |
| Waterwise / GaamaRamma | NASA Space Apps 2024, Best Use of Data | Agricultural water-availability decisions using Earth-observation context. | Make source-qualified environmental context support a specific operational question. |
| Saaf Water | Call for Code 2021, Global grand prize | Groundwater sensing and analytics translated into an understandable quality summary and suggested purification methods. | Put an understandable modeled outcome beside its assumptions and next verification steps. Do not copy sensor/quality claims. |
| Agrolly | Call for Code 2020, Global grand prize | Combines weather forecasts, historical NASA data and crop requirements, tailored to location, crop and growth stage. | Keep site-specific inputs separate from regional context; preserve original provenance in an exported brief. No new NASA integration. |
| Prometeo | Call for Code 2019, Global grand prize | Wearable monitoring for firefighter exposure, developed with firefighter and nurse input. IoT data feeds a dashboard; Node-RED connected devices and services. | Design for a named operator and a concrete decision. Record field validation as future work; do not claim sensors or user research already performed. |

Winner evidence: [NASA's 2024 awards](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-international-space-apps-challenge-announces-2024-global-winners/), [IBM's Saaf Water announcement](https://newsroom.ibm.com/2021-11-16-IBM-and-David-Clark-Cause-Crown-Saaf-Water-Winner-of-4th-Annual-Call-for-Code-Global-Challenge), [IBM's Agrolly announcement, translated from Chinese](https://china.newsroom.ibm.com/press-releases?item=122469), [Call for Code's Prometeo award](https://www.callforcode.org/2019-call-for-code), [IBM's Prometeo implementation case study](https://www.ibm.com/case-studies/prometeo-platform).

Two additional NASA 2024 winners inform the interaction: NVS-knot's **2plant | ! 2plant** won Galactic Impact with planting-risk assessment from surface soil moisture and evapotranspiration. **Eco-Metropolis** won Most Inspirational for a city-building game with environmental resource decisions. Their transferable ideas are translating variables into a decision and letting users explore consequences. The NASA announcement above verifies both. No proprietary algorithm, code quality or scientific accuracy was independently established here; NASA project-detail pages timed out or returned errors.

## Environmental interface references

[Global Forest Watch now redirects to Global Nature Watch](https://globalnaturewatch.org/). The homepage combines an action-focused mission, green accents and clear routes into data tools. The India dashboard capture still had loading overlays, so it is not accepted as complete dashboard evidence. No data-layer or map interaction claims are based on that partial capture.

[Resource Watch](https://resourcewatch.org/) separates datasets, dashboards and explanatory stories. Its current browser banner says the site is no longer updated and will be archived. It is useful as historical interface inspiration, not as a recommended new data dependency. [Its documented exploration workflow](https://resourcewatch.org/about/howto) supports downloadable, contextualized visualizations.

Fresh reference screenshots and visible text are under `artifacts/design-refresh/references`. Reference-site assets are not copied into the application. JalDrishti's own authentic synthetic-demo screenshot is the product-preview asset. The selected visual target is direction 3: cinematic dark, generous space, arched preview and contrasting editorial typography. Public-provider wording, units and evidence labels retain priority over ornament.

## Lessons implemented

1. **One audience, one decision:** position the product around a site's storage, reserves and interventions; provide direct routes to an empty Real Analysis and labeled synthetic demo.
2. **Evidence before claims:** source and time metadata remain visible; the demo is never described as measured site data. The preview is explicitly illustrative.
3. **Consequences users can explore:** retain the shared scenario adapter and add a decision brief based on its exact output, including negative results and lower bounds.
4. **A useful artifact beyond the screen:** download a local JSON brief containing inputs, intervention assumptions, reserve crossings, provenance and explicit limitations. It has no cloud upload or new persistence service.
5. **A verification path:** show practical checks for storage, delivered supply, separate loss assumptions and intervention feasibility. The checklist is advisory, not an autonomous action or verified completion.
6. **Environmental identity:** apply the selected dark editorial design to the landing and app shell, keeping risk colors distinct and supporting mobile/reduced-motion use.

## What was deliberately not imported

No new sensor, ML model, water-quality diagnosis, automatic groundwater observation, planting advisory, map engine or NASA ingestion. A four-year-competition research sample is not proof that these interface choices caused the wins. Pilot data, actual savings, prediction accuracy and independent operator usability validation remain future evidence requirements.

## Demonstration story

A campus operator reviews a synthetic interrupted-supply scenario, compares it with a feasible intervention, checks the reserve window and downloads the assumptions. A different user opens Real Analysis with no seeded values, supplies site inputs and receives the same transparent model behavior. Regional rainfall stays context, not a tank inflow.

## Submission constraints

No guarantee of winning is made. Research cannot cure eligibility restrictions. Verify event development-history requirements, repository visibility requirements and submission deadline separately. Existing GitHub privacy and AWS deployment are preserved. Updated screenshots/video are needed before presenting this local redesign as the deployed public release.

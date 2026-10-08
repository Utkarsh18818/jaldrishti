# JalDrishti project summary

**Tagline:** Water security, in sight.

**Problem:** Make a site's water balance and reserve risk understandable while keeping regional environmental evidence separate from local tank measurements.

**Approach:** A transparent deterministic forecast and scenario engine, traceable operational inputs, source-qualified environmental context and protected cloud persistence. The anonymous synthetic demo allows judges to explore decisions without changing AWS records; Real Analysis starts empty and rejects demo provenance.

**AWS contribution:** A Next.js frontend Lambda with Lambda Web Adapter invokes the existing backend Lambda using its temporary execution-role credentials and SigV4. DynamoDB stores validated analysis and expected-version revisions. Public frontend URL permissions are alias- and URL-scoped; backend data access remains IAM-protected plus the operator gate.

**Evidence:** Public launch validation recorded 163 passing tests, 44 responsive checks, shared-engine forecast agreement, operator reload/conflict handling, and zero detected secret matches in release assets. Test fixtures were labeled and removed. These results establish software behavior, not environmental accuracy or demonstrated real-world water savings.

**Scientific limits:** Constant rates, explicit loss assumptions, coarse modeled weather, delayed reanalysis and an unvalidated custom index. No satellite tank-storage measurement, IoT telemetry, ML confidence, automatic groundwater observation or completed rainwater-harvesting relationship.

**Submission:** Prepared for WeMakeDevs + AWS Environmental Hacks 2026. The submitter must verify eligibility, enrollment, event rules and acceptable development history against the [official event](https://www.wemakedevs.org/aws/env) and [rules](https://www.wemakedevs.org/aws/env/rules). No award, registration, development-period or compliance claim is made.

[Live demo](https://oesv4kceg4gzmoozx7x7adnwwm0tirfq.lambda-url.ap-southeast-2.on.aws/) · [Architecture](ARCHITECTURE.md) · [Features](FEATURES.md) · [Demo guide](DEMO-GUIDE.md)

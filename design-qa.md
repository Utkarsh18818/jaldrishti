# Design QA — cinematic dark

Result: PASSED for the selected direction's visual implementation.

## Reference and evidence

User selection: option 3, cinematic dark. Combined reference/implementation comparison: `artifacts/design-refresh/verification/design-comparison.png`. Source: `artifacts/design-refresh/concepts/direction-3.png`; final implementation: `verification/landing-qa.png` in the same artifact directory.

The side-by-side comparison was visually inspected. The implementation retains the dark teal field, pale headline with italic secondary line, spacious split composition, cream call to action and arched product preview. It uses the application's existing brand and typography and extends the approved hero into substantive environmental and workflow sections. Updated product imagery reflects the local redesigned Overview rather than third-party assets.

## Responsive and interaction review

Representative desktop landing, mobile landing, desktop Overview, mobile Simulator and expanded decision brief captures were visually reviewed. The headline, source qualifiers, scenario results and action controls remain readable; no clipping was noticed in these reviewed captures. Automated checks cover seven routes at four widths (1440, 1024, 768 and 390 px). Their complete final result is recorded separately in `artifacts/design-refresh/verification/browser-verification.json`.

The decision brief distinguishes modeled reserve extension from measured savings, exposes assumptions and preserves synthetic labels. The layout and colors do not change the underlying forecast formulas. Reduced-motion behavior is checked separately by the browser script.

## Limits

This is local visual QA, not an accessibility certification or a deployed-service acceptance test. Environmental reference captures informed design only. The partially loaded external forest dashboard was excluded as complete reference evidence. Full field validation and representative operator usability studies remain future work.

Final automated result: 53 checks passed. Two automated Edge file-transfer cancellations were recorded; export payloads were verified directly in the browser. Full mobile decision brief was separately inspected and showed readable assumptions and an unclipped export button.


## Motion follow-up, 11 October 2026
37 new browser checks passed. Desktop/mobile hero, scroll reveal and four representative product-video frames were inspected. The cinematic direction remains intact, now with actual synthetic product playback. Operational calculations, input layouts and form state remain unchanged. Details: docs/research/MOTION-AND-VIDEO-VERIFICATION.md.

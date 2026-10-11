# JalDrishti usability and submission refinement

## Application changes

Mobile Sample Demo navigation is sticky at the top and horizontally scrollable; the five implemented workspaces precede planned Alerts, Actions and Impact. Planned links are explicitly labeled. Real Analysis places the local three-step setup before optional protected cloud storage, with plain-language units/time guidance and a blank downloadable CSV header. No operational values are prefilled. Forecast, Overview and Simulator identify the actual synthetic reference time rather than suggesting a countdown from today. Weather refresh describes operator access and distinguishes authentication failures from provider outages. Motion, design, calculation engines, provenance validation, source qualifications and protected API checks are preserved.

## Validation and release

172 unit tests passed. ESLint, TypeScript and Windows/Linux production builds passed. Existing Linux Node 24.21.0 x86_64 dependencies were reused; no dependency was installed. 45 browser checks passed locally and on the live site, including 20 page/viewport checks across 1440, 1024, 768 and 390 widths. 53 local workflow checks passed, including Real Analysis fixture validation, simulator agreement and synthetic separation. Fixture work remained local and was not saved to AWS.

Final Linux ZIP: 14,836,693 bytes; expanded application: 42,012,130 bytes, plus the existing adapter layer. SHA-256: f27ce4b17aa16472aeafa10cac91a64f795429ddc3138928e4eadec1255056d5. ZIP integrity, Linux permissions (run.sh 0755), runtime checks and secret scan passed; 3,477 entries scanned with zero configured-private-value or credential-pattern matches.

Updated the existing frontend Lambda only: immutable version 7, live alias promoted from version 6 after 17 candidate checks. Six HTTPS promotion checks and the live browser suite passed. Public frontend access mode remains unchanged; operator sessions and IAM-protected backend invocation remain required for cloud operations. Backend function code/configuration, existing table and stored records were preserved. No new IAM role, AWS service, paid plan or public repository was created. The initial upload request timed out; AWS code hash reconciliation confirmed it succeeded before publishing the version.

Authorized Real Analysis reads return 404 (no saved record). Browser reload preserves the authenticated session and empty state. Restoration of actual saved site inputs cannot be demonstrated without a legitimate record; no synthetic record was created. This is a remaining evidence limitation, not a reported successful save/load.

## Rollback and operating limits

Restore the frontend live alias to version 6 through the existing Lambda alias update, preserving Function URL authorization, runtime configuration and the backend. An account/revision-guarded rollback helper is retained locally in .cache/deployment-refresh/usability-rollback.mjs. Do not delete the backend/table. Existing regional concurrency quota and public usage charges still apply; browser-local Sample Demo avoids backend writes but public page requests still incur Lambda usage. No new continuous-charge service was added.

## Submission evidence

Five authentic anonymous screenshots were refreshed from the deployed website under docs/submission/screenshots. Displayed operational data is synthetic. A refreshed eight-scene recording includes the new interface and decision brief, existing offline narration/subtitles, and a clearly identified architecture illustration with verified read-only release facts. Final video verification is recorded separately; no YouTube upload or Builder publication is performed.

SUBMISSION-READINESS.md documents official-rule blockers and an unsent organizer question. GitHub remains private. The official rules require a public repository and new work begun after event opening; eligibility must not be asserted from the redesign. OpenAI Codex assistance is disclosed. The blank pilot kit provides consent, collection, comparison and operator-feedback instructions; no field pilot, feedback quote or measured savings is invented.

## Storage

Root: A:\Projects\JalDrishti. New dependencies: none. Reused project node_modules and existing Linux dependencies in the Ubuntu VHD on A:. Controllable caches/temp: .cache, .cache/tmp, .npm-cache, existing video/browser runtime folders and Linux npm cache in that A: VHD. Builds and release/video artifacts stay under the A: project. No project artifacts were intentionally written to C:. Existing Edge, Node and Playwright installations on C: were reused; small system/browser metadata outside the project is not comprehensively audited.

## Final video verification

PASSED: refreshed MP4 is 165.000 seconds, 1920×1080, 30 FPS H.264 with 48 kHz AAC; 4,950 frames decoded without errors, no black intervals, eight scene audio signals present, 43 subtitles with verified scene windows. Browser playback passed and nine representative final frames were reviewed. MP4 size 11,259,840 bytes; SHA-256 4af004bb0733360b6fb777e9f68de9ffddd263fd5d12c0cf27b76eb2d317223e. SRT and video-manifest.json are alongside it under artifacts/video-prep/usability-refresh/final. Existing original video is preserved. Subtitle synchronization follows existing speech timings; no independent ASR or human listening assessment is claimed. Project logical size measured at approximately 2.72 GiB (before the final export completed); no new dependencies.

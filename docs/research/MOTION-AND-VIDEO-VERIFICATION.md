# Motion and product-video refinement

Completed locally on 11 October 2026. Root: `A:\Projects\JalDrishti`.

## Changes

- `src/components/product-film.tsx`: authentic muted Sample Demo walkthrough, accessible play/pause control, poster fallback, off-screen/tab-hidden pausing, reduced-motion and data-saving autoplay suppression.
- `public/design/product-tour.mp4`: 11.08-second 960×640 H.264 walkthrough, 24 fps, 172,241 bytes, no audio. Recorded from the actual local synthetic Overview and Simulator. No private user records, credentials or remote media.
- `src/components/product-motion.tsx`: route-aware 280 ms page entry, 650 ms intersection-triggered reveals and passive scroll reading progress. Waits for streamed page shells; cleans up observers/listeners/animations. It never wraps, keys or remounts the operational components.
- `src/app/loading.tsx`: genuine Next.js loading fallback, neutral workspace status and small water animation. No artificial waiting, fabricated progress percentage or simulated result placeholders.
- `src/app/design-refresh.css`: finite water-contour opening, hover/focus/active feedback, media controls and responsive/reduced-motion styles. Core forecast charts and field layouts are preserved.
- `src/app/page.tsx`: replaces the static hero preview with the small local walkthrough and adds decorative water contours. Existing product explanation, source qualifications and navigation remain.
- `src/app/layout.tsx`: mounts the separate presentation-only motion controller.

## Product integrity

No forecast formula, simulator calculation, provenance model, API contract, cloud persistence logic or authorization setting changed. The video is labeled synthetic throughout its containing UI and within the captured workspace. It illustrates the application, not observed water savings. No new environmental integration or scientific accuracy claim was introduced.

Motion never intercepts navigation, scrolls the page for users or imposes a loading delay. Page content remains visible if JavaScript, observers or media fail. No cinematic overlay blocks forms or results. Loading UI is displayed only by Next.js when a route suspends. Existing analysis state providers are untouched.

Continuous video has a visible pause control. Automatic playback is suppressed for reduced-motion or data-saving users. Explicit user playback is available. Video pauses when it leaves the viewport or the tab is hidden. Reveals and water/loader animations are disabled under reduced motion. The decorative opening finishes in under five seconds; there is no infinite ambient loop.

## Verification

- 172 unit tests passed, zero failures or skips.
- ESLint, TypeScript and production build passed.
- 37 browser checks passed; zero runtime errors and zero API mutations.
- Video playback, pause/resume, off-screen pausing, scroll reveals, scroll progress, CTA hover and route-entry effects verified in existing Edge.
- Baseline remains 4.7 days; recommended intervention remains 8.9 days.
- Landing, Overview, Forecast, Simulator and Real Analysis checked at 1440, 1024, 768 and 390 px; all 20 combinations had no horizontal overflow.
- Reduced motion prevents autoplay, disables decorative animation and keeps revealed text visible.
- Real Analysis starts empty. A locally typed location survived scrolling; no form remount/reset occurred.
- Desktop and mobile landing captures and scroll-story capture were visually inspected. Video contact sheet was inspected for genuine product content and absence of private information.
- Final build secret-value scan found zero matches; no `.env` file in scanned artifacts.

Evidence: `artifacts/motion-refresh/verification/browser.json`, responsive PNGs, `video-contact.png`, `capture.json`, `secret-scan.json`, and build/lint/typecheck/test logs. The earlier decision-brief download automation limitation remains documented separately; this work does not claim to resolve Edge's file-transfer cancellations.

## Storage and deployment

Project, media, screenshots, logs, build outputs and controllable temporary files remain beneath `A:\Projects\JalDrishti`.

No new dependency or global tool installed. Existing Edge, Playwright and the previously approved A: portable FFmpeg/FFprobe were reused. Playwright's recorder initially expected a missing FFmpeg executable on C:. Instead of downloading it, an A: hard link to the approved executable was created at `.cache/motion-refresh/browser-runtime/ffmpeg-1011/ffmpeg-win64.exe`, with `PLAYWRIGHT_BROWSERS_PATH` redirected to that A: directory. The hard link does not duplicate the executable's underlying disk allocation.

Caches/temp: `.cache/motion-refresh`, `.cache/tmp`, `.npm-cache`, `.next`; captures and generated evidence: `artifacts/motion-refresh`; published-local media: `public/design`. No intentional project files, downloads or dependencies written to C:. Incidental OS/browser metadata is not independently audited.

No AWS infrastructure, public deployment, Git commit/push or GitHub visibility change performed. The enhancement is available only in the local preview: http://127.0.0.1:3000. A separate Linux release/deployment step is needed to update the public site.

## Limits and next check

Autoplay can still be blocked by a user's browser settings; the poster and manual play control remain available. This is viewport testing in Edge, not physical-device or assistive-technology certification. Confirm mobile browser performance and review the normal/reduced-motion experiences with an operator before a public release. The film shows existing synthetic data, not a real campus deployment.

Approximate project size: 2.63 GiB apparent file total. This includes existing builds/dependencies/caches and counts the FFmpeg hard link again; its physical allocation is shared with the existing executable.


## Reload flash fix — 11 October 2026

The white blink was encoded in the opening frames of the recorded video. Blank-white recording frames were removed, preserving actual dark application frames. The cleaned clip is 11.083 seconds and 172,241 bytes. A matching first-frame PNG now stays behind the video; the video is revealed only after loaded data is available. This also preserves a stable dark poster under slow loading or media failure.

All 266 encoded frames were scanned: zero blank-white frames, maximum average luma 33.5068. Nine browser checks passed, including slow-load poster handoff, five separate reloads sampling playback frames, pause controls and reduced-motion still-poster behavior. Component ESLint, TypeScript and production build passed. No forecast or operational code changed. The final build secret scan found zero configured-secret matches.

Files: `src/components/product-film.tsx`, `src/app/design-refresh.css`, `public/design/product-tour.mp4`, new `public/design/product-tour-poster.png`. Evidence: `artifacts/motion-refresh/reload-fix`. Original recording retained only in ignored A: artifacts.

Storage: root `A:\Projects\JalDrishti`; no dependencies installed; existing tools reused; caches/temp `.cache/motion-refresh`, `.cache/tmp`, `.npm-cache`, `.next`, evidence `artifacts/motion-refresh/reload-fix`, all on A:. No intentional C: writes; incidental OS metadata not audited. Approximate apparent project size remains 2.63 GiB. Local fix only; no AWS deployment or GitHub changes.

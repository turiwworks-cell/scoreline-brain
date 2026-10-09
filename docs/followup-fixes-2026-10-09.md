# Scoreline follow-up fixes — 2026-10-09

Base: `c5c239af923ac180c7fdc968585f8fe826da8cfe`, branch `codex/scoreline-session-4-final`.
Implemented solo in one session. No dependencies or global motion timing changed.

| Report | Change and evidence | Remaining limit |
| --- | --- | --- |
| Account suddenly jumps | Reproduced: focusing Close scrolled the clipped ancestors during entrance. Opening/trap focus now prevents scrolling. Reduced-motion visibility changes immediately, allowing focus on the first frame. Browser tests cover repeated opening, ancestor scroll and focus return. | Sign-in remains the existing prototype, whose buttons close the sheet. |
| Live blank/wrong before Rive | Exact exported ON and supplied OFF art are synchronous HTML sprite states, selected from the URL before React. React uses the same states with the current count until Rive settles, and after renderer failure. Reduced motion needs no lazy OFF chunk. Blocked-JS and blocked-WASM browser checks pass. | The two supplied `Preset-1` SVGs were identical OFF exports; ON uses the existing approved ON drawing. |
| General Tables steps in Firefox | Extended the existing Firefox-only fractional rotation to general Tables league sections and rows. Existing match pitch/table selectors are retained. Default Chromium styles are unchanged; a Firefox UA exercises the gated selectors. | Native Firefox smoothness was not newly observed here. |
| Player photos load slowly and download again | Shared manifest preload gets high priority; recent selected pictures are retained in a bounded eight-picture cache, failed warming can retry. Netlify and the ready local server cache player files for one hour. Only the selected profile is warmed. | First download still depends on network/device. Browsers may evict decoded images; no claim of permanent caching. |
| Goals Tonight arrives late | Removed the fixed entrance delay and extra eight-row offset. Goal and leader rows begin together, retaining the within-section stagger. Browser checks compare first visible frames. | None observed in the checked desktop pane. |
| Table/team names require two taps | Decorative rolling labels and team-label wrappers no longer become moving hit targets. Native Chromium touch input held through letter animation activates Table and each team with one touch in both motion settings. | Original symptom not independently reproduced on a physical phone. |
| Swipe Facts/Stats/Lineup/Table | Match gestures select the adjacent existing tab, preserving URL/content behavior. Browser checks traverse all four in both directions and stop at each boundary. | Native browser edge gestures remain browser-owned. |
| Swipe accidentally goes Back | Application swipes never press Back. Back remains an explicit button; day-list swipes still change one day. Covered/inert screens, vertical scrolls, cancellation and multi-touch retain guards. | Physical-phone gestures were not newly checked. |

All 814 unit tests (95 files) pass. 31 distinct scoped browser cases pass, including the existing
Session 2/3 Rive and motion regressions and Session 4 review controls. Typecheck passes;
lint has no errors and two existing warnings. Production build and the unchanged 180,000-byte
initial-JS budget pass at 179.84 KB gzip.

Validation uses installed headless Edge with phone/desktop viewports. `_headers` follows
[Netlify's custom-header format](https://docs.netlify.com/manage/routing/headers/).
Native Firefox, Safari and physical-phone checks are not represented by Chromium UA tests.
See `LATEST-SCORELINE.md` for the exact current release and download.

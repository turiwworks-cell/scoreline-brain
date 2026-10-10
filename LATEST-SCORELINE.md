# Latest Scoreline — follow-up fixes, 2026-10-09

Use this version for future work. Earlier releases are history.

- Branch: [`codex/scoreline-session-4-final`](https://github.com/turiwworks-cell/scoreline-brain/tree/codex/scoreline-session-4-final).
- Tested app source: [`354054a78fef1781d4354e4a2d31ba3b918196aa`](https://github.com/turiwworks-cell/scoreline-brain/commit/354054a78fef1781d4354e4a2d31ba3b918196aa).
- Ready Netlify upload: **[Scoreline-NETLIFY-LATEST-2026-10-09.zip](releases/Scoreline-NETLIFY-LATEST-2026-10-09.zip)**.
- ZIP SHA-256: `ca70c441677d829bd2a2c91d85321fc9c9c46f632c88724deaa813f13261e097`; 8,572,789 bytes, 698 verified build files.
- ZIP root contains `index.html`, `review.html`, `_redirects`, `_headers` and assets.

Upload this ZIP using [Netlify Drop](https://app.netlify.com/drop), then open `/review.html` for the existing phone review controls.

This version fixes the Account jump, synchronous Live ON/OFF fallback, match-tab swipes and unwanted swipe Back, and Goals Tonight's extra delay. It extends the Firefox-only table workaround, stabilizes letter hit targets and improves photo caching/priority. [Evidence and limitations](docs/followup-fixes-2026-10-09.md).

All 814 unit tests and 31 distinct scoped Chromium cases pass; typecheck, build and size pass (179.84 KB gzip of 180 KB). Lint has zero errors and two existing warnings. Native Firefox and physical-phone behavior still require direct observation; a Firefox UA check is not that observation.

## Portfolio case study (2026-10-10)

Branch: `claude/serene-ride-v3q14v` = this follow-up version (`af9e5c4`) plus folder support
(`SCORELINE_BASE`) and the case study. 817 unit tests pass; initial JS 179.98 KB of 180 KB.

- **[Turinoz-Portfolio-Scoreline-site-2026-10-10.zip](releases/Turinoz-Portfolio-Scoreline-site-2026-10-10.zip)**:
  the whole Turinoz portfolio with the Scoreline case study (`scoreline/`), this app inside it
  (`scoreline/app/`) and the Scoreline grid tile. Drag `turinoz-portfolio` onto Netlify Drop.
- **[Scoreline-CaseStudy-and-App-2026-10-10.zip](releases/Scoreline-CaseStudy-and-App-2026-10-10.zip)**:
  the case study and the app on their own, with the fonts and Rive runtime they share with the
  portfolio. Publish the folder as a site's root.
- Source of the page: [`case-study/`](case-study/README.md).

# Latest Scoreline delivery — Sessions 1 through 4

Branch: `codex/scoreline-session-4-final`.

The current ready-to-upload Netlify file is:

**[Scoreline-NETLIFY-SESSION-4-2026-10-09.zip](releases/Scoreline-NETLIFY-SESSION-4-2026-10-09.zip)**

- Built application source: `b5f4aca231e5995df9c543ee388b05763a429b02`.
- ZIP SHA-256: `351c4e588b5cd04f03b70ceda127f8427e3d836b13a4eb377f9963f8e5fa187b`.
- ZIP size: 8,572,065 bytes; 697 verified build files plus Netlify's `_redirects` file.
- The ZIP has `index.html`, `review.html`, assets and `_redirects` at its root, ready for Netlify Drop.
- `public/_redirects` retains the same routing rule for future builds.

Upload this ZIP at https://app.netlify.com/drop. The app runs its existing demo by default. Open `/review.html` on the deployed site for phone preview, goal/red-card triggers, Pause/Resume and Restart. No build or external API is needed for this demo upload.

The final application passed 812 unit tests and 39 scoped Chromium browser cases. The prior Firefox motion correction is preserved. Physical-device testing and native Firefox zoom remain unverified; SL-06/08/17 were not reproduced and SL-24 remains unverified. Earlier delivery archives are history.

## Portfolio case study (2026-10-09)

Branch: `claude/serene-ride-v3q14v` (Session 4 plus the case study).

The Turinoz portfolio with the Scoreline case study, the real demo inside it and the grid tile in
place of the Live score concept tile:

**[Turinoz-Portfolio-Scoreline-site-2026-10-09.zip](releases/Turinoz-Portfolio-Scoreline-site-2026-10-09.zip)**

- Upload the `turinoz-portfolio` folder inside it at https://app.netlify.com/drop.
- The case study is `scoreline/`; its source is in [`case-study/`](case-study/README.md).
- The demo inside it is this app built with `SCORELINE_BASE=/scoreline/app/`. The root build and the
  Session 4 ZIP above are unchanged by that setting; 815 unit tests pass and the initial JS is
  179.91 KB of 180 KB.

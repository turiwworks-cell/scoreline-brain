# Scoreline case study (for the Turinoz portfolio)

The source of the portfolio's `scoreline/` folder: the case study page, its styles, its script and the
stills it uses. The ready-to-upload portfolio, with this page, the app and the grid tile in place, is
[`releases/Turinoz-Portfolio-Scoreline-site-2026-10-10.zip`](../releases/Turinoz-Portfolio-Scoreline-site-2026-10-10.zip)
(drag the whole `turinoz-portfolio` folder onto https://app.netlify.com/drop).

```
case-study/
  index.html        the page (copied to turinoz-portfolio/scoreline/index.html)
  case-study.css    its styles
  case-study.js     its behaviour
  assets/           stills from the real app and share-cover.jpg
```

## The app inside it

The page and the portfolio's grid tile both run the real app from `scoreline/app/`. That folder is a
build of this repository served from a folder:

```
SCORELINE_BASE=/scoreline/app/ npm run build
# then copy dist/ to turinoz-portfolio/scoreline/app/ (leave out dist/_redirects)
```

Unset, `SCORELINE_BASE` is `/` and the build is the same as before. The page drives the app through
its own review bridge (`src/review/protocol.ts`): it offers `window.scorelineReviewHost`, the app in
the frame attaches, and the page calls `scene('goal' | 'red')`, `pause()`, `resume()` and `restart()`.
Moving between screens uses the app's router (a `popstate` with no new history entry). This needs the
page and the app on the same origin, which they are inside the portfolio.

## What it says, and where the numbers come from

- Curves and timings: `src/styles/tokens.css`, `src/motion/tokens.ts`, `src/features/moments/choreo.ts`
  (all ported from `legacy/scoreline_11.luau`).
- Rive: `public/rive/*.riv`, `src/rive/liveLight.ts` (the measured capsule track), `rive/moments.luau`.
- Process and counts: git history (125 commits on origin, 32 branches), `docs/BUILD-PLAN.md`,
  `reports/`, `LATEST-SCORELINE.md`.
- Status: `reports/part21-*.md` (budgets, what is open), `docs/DATA-CONTRACT.md` (the real-API mode).

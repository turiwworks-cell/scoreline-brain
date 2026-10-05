# Part 21: the 2026-10-04 review, then the hardening audit

Branch `codex/part-20-moments`. One Opus session did two things. First it fixed the owner's
review of the whole rebuild (15 annotated screenshots and 3 videos), rewriting what had drifted
from the Lua. Then it ran the Part 21 audit and filed the findings as issues, sized one per
Sonnet session.

## 1. Review fixes

| Commit | What changed |
| --- | --- |
| 2595d05 | Live cards: Lua-timed entrance and settle on WAAPI, re-playable and correct after rapid toggling; no hover lift; the team codes shrink before they hide; buttons inherit the app font (they were rendering in Arial, hence "bold"). Live icon: the capsule is 40 px, like the menu button; `islive` is one-way; DOM hover light; re-sized on DPR change; a softer light on round buttons |
| 5dd8c74 | The account sheet behind the menu (drawSheet, `luau:6680`); no pane scrollbars |
| 77101e8 | No shared-element flights. The player opens the same way from every origin (centre scale 0.9 → 1, ease-out) and closes by scaling down; the bust's cut stays out of view |
| 3bff36b | Elastic edges under a finger (follow 0.4, spring back 14/s), as in the Lua |
| edeb6e0 | Follow: faces framed from each bust's measured head (Messi and Mbappé now match); the rim over the photo; the shoulders run on; the picker folds; kick-off said once; discs centred; the band's rating aligned |
| bac6189 | List: the last row's rule lands with its row. Yesterday's late league label was a navigation rendering as a transition, fixed by rendering navigations at once (`flushSync`) |
| cf3a0f7 | Lineup: five equal stripes; solid plates that catch the light; the rise plays (Motion's presence skipped `initial` for later mounts) |
| 93ff303 | Momentum at its real width on desktop; Leaders without the chunk wait (preloaded); the player's rating number centred |
| 5196c83 | Scenes: one top line at y 72 (close button, flag or card, text, score); the red card lands level and small. GOAAAL: the DOM and Rive words never swap in mid-flight, and the hold before the rise is kept |

ARCHITECTURE §3, §5 and §6 and BUILD-PLAN Parts 9, 14 and 19 now describe the result: no shared
elements, the push and the centre scale, the one-way Live icon, the word handoff, elastic edges.

## 2. Audit

The method, the scripts and the full baseline are in `verification/perf/README.md`. The
container's Lighthouse benchmark index was ~1480, so its 3.6× is about a typical laptop's 6×.
WebGL there is software, so Rive is measured apart.

| Budget (ARCHITECTURE §7) | Measured | |
| --- | --- | --- |
| Initial JS ≤ 180 KB gzip | 219 KB | miss |
| LCP ≤ 2.0 s | 2.9 s (Lighthouse mobile, `/?demo`) | miss |
| INP ≤ 200 ms | open a match 390–460, Lineup 410–440, player 400–520, Live on ~300 (3.6×, no Rive) | miss |
| No task > 50 ms during a poll | every tick 86–157 ms (3.6×, no Rive) | miss |

- **Keyboard:** passes. Visible rings everywhere; tabs move with the arrow keys and Home/End;
  focus goes to the match heading on open and back to the row on Back; the sheet keeps focus and
  Escape returns it.
- **Screen reader:** checked through Chromium's accessibility tree and axe-core. Goals are
  announced in a polite status region, and covered screens are `inert`. Names need work.
  **VoiceOver itself was not run** (no Apple device): that is issue 9.
- **Lighthouse accessibility:** 0.96. The only failure is `--c-dim` text at 2.1:1, which needs
  the owner's decision.

## 3. Issues

| # | Issue | For |
| --- | --- | --- |
| [1](https://github.com/turiwworks-cell/scoreline-brain/issues/1) | Poll tick 86–157 ms (parse less, apply less, render less) | Sonnet |
| [2](https://github.com/turiwworks-cell/scoreline-brain/issues/2) | Initial JS 219 KB (split match and player, zod, size check in CI) | Sonnet |
| [3](https://github.com/turiwworks-cell/scoreline-brain/issues/3) | INP on opening a match, Lineup, a player | Sonnet |
| [4](https://github.com/turiwworks-cell/scoreline-brain/issues/4) | LCP 2.9 s (static first paint, Rive later) | Sonnet |
| [5](https://github.com/turiwworks-cell/scoreline-brain/issues/5) | The first data render is one 0.5 s task | Sonnet |
| [6](https://github.com/turiwworks-cell/scoreline-brain/issues/6) | One warm Rive word instance across scenes | Sonnet |
| [7](https://github.com/turiwworks-cell/scoreline-brain/issues/7) | Screen-reader names and semantics | Sonnet |
| [8](https://github.com/turiwworks-cell/scoreline-brain/issues/8) | `--c-dim` text contrast | owner decides, then Sonnet |
| [9](https://github.com/turiwworks-cell/scoreline-brain/issues/9) | On-device pass: VoiceOver, Rive on a real GPU | a person with the devices |
| [10](https://github.com/turiwworks-cell/scoreline-brain/issues/10) | Audit Lua baselines (`bc`) and inline badges | Sonnet |
| [11](https://github.com/turiwworks-cell/scoreline-brain/issues/11) | Entrances lost for content that mounts late | Sonnet |

A suggested order: 1, 2, 5 and 4 together lift the start-up and the polls; then 3, then 6.
The rest can go in any order.

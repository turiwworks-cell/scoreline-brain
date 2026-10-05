# Scoreline · data contract v2

What the adapter server sends and how the client applies it. This replaces `DATA-BINDING_4.md`
§2–3 (the Rive View Model era). The JSON shapes are the same as v1 plus the additions in
ARCHITECTURE §4.1, marked **v2** below.

Code: `src/domain/schemas.ts` parses it, `src/domain/apply.ts` applies it.

```
GET /feed      → a feed snapshot (§2), with an ETag
SSE /events    → one event message per SSE message (§3), SSE id = the event's seq
```

---

## 1. What v2 adds, and why

| Addition | Where |
| --- | --- |
| `seq` on every match and every event: a per-match counter that only goes up | §2, §3, §4 |
| `kind: "goalCancelled"` for a goal taken back by VAR. The score may go down | §3 |
| Every event carries the match's `score` after it | §3 |
| `version: 2` | §2 |

v1 overwrote the score on every feed (`luau:7944`). A cached snapshot that arrived after a live
goal event rolled the score back, the next fresh snapshot read as "score went up with no new goal
event", and the app made up a second goal (`luau:7975–7996`): the celebration played twice. `seq`
lets the client tell an old snapshot from a new one, and the score on each event lets the client
take the score from whatever is newest.

---

## 2. `feed`: the whole picture

Served at `GET /feed`. Send it on start and whenever something changes; the client polls every
15 s with `If-None-Match`.

```json
{
  "version": 2,
  "days": ["Sat 19", "Yesterday", "Today", "Tomorrow", "Wed 23"],
  "teams": [
    { "id": "ars", "name": "Arsenal", "short": "ARS", "colors": ["#EF0107", "#FFFFFF"] },
    { "id": "mci", "name": "Manchester City", "short": "MCI", "colors": ["#6CABDD", "#1C2C5B"],
      "flag": [["h", "#6CABDD", "#FFFFFF", "#6CABDD"]] }
  ],
  "leagues": [
    { "id": "epl", "country": "England", "name": "Premier League", "matchday": 7,
      "qualify": 4, "qualifyLabel": "Champions League",
      "table": [ { "team": "liv", "p": 6, "w": 5, "d": 1, "l": 0, "gf": 14, "ga": 4, "pts": 16 } ] }
  ],
  "squads": {
    "ars": { "coach": "Mikel Arteta", "players": [
      { "n": 7, "first": "Bukayo", "last": "Saka", "short": "Saka", "pos": "FW",
        "role": "Right winger", "club": "Arsenal", "born": "2001-09-05", "height": 178 }
    ] }
  },
  "matches": [
    { "id": 501, "seq": 14, "day": 0, "league": "epl", "home": "ars", "away": "che",
      "score": [1, 1], "status": "live", "minute": 64, "second": 20, "kickoff": "17:30",
      "featured": true, "favourite": true,
      "venue": { "name": "Emirates Stadium", "city": "London", "referee": "Michael Oliver", "attendance": "60,251" },
      "lineups": {
        "home": { "formation": "4-3-3", "xi": [1, 12, 2, 6, 33, 41, 8, 36, 7, 14, 11], "bench": [19, 10] },
        "away": { "formation": "4-2-3-1", "xi": [1, 24, 6, 29, 3, 25, 8, 10, 11, 9, 7], "bench": [20] }
      },
      "events": [
        { "id": "a2", "seq": 9, "kind": "goal", "side": "home", "minute": 27, "player": 7, "other": 8,
          "style": "cutback", "xg": 0.41, "score": [1, 0],
          "text": "Ødegaard slides it across and Saka sweeps it in." }
      ],
      "stats": { "possession": 57, "xg": [1.42, 0.88], "shots": [11, 7], "onTarget": [4, 3],
                 "bigChances": [2, 1], "corners": [6, 2], "passes": [402, 301], "fouls": [8, 11], "offsides": [1, 2] },
      "momentum": [0, 0.1, 0.3, -0.2],
      "players": { "home": { "7": { "rating": 8.2, "minutes": 64, "touches": 51, "passes": 30, "passesOk": 26, "shots": 3 } } }
    }
  ],
  "next": { "arg": { "opponent": "fra", "date": "Thu 24 Sep", "time": "20:45", "in": 172800 } }
}
```

| Field | Notes |
| --- | --- |
| `version` | **v2:** `2`. A feed without it is read as v1 (no `seq`, see §6). |
| `teams[].id` | Any short id. National ids from the demo (`fra`, `arg`, `eng`, `bra`, …) keep their drawn flags. Teams merge across feeds: one sent once stays known. |
| `teams[].colors` | First colour the side is known by, then the second: `"#0055A4"`, `"0055A4"` or a number. They tint the live cards, the momentum wave and the stats. |
| `teams[].flag` | Optional crest in a 30 × 30 box: `["h", c1, c2, …]` stripes, `["v", …]` columns, `["r", x, y, w, h, c]`, `["c", cx, cy, r, c]`, `["cs", cx, cy, r, width, c]`, `["s", cx, cy, r, c]` star, `["d", c]` diamond. Without it: a disc in the first colour ringed in the second. |
| `leagues` | When sent (non-empty), replaces the leagues. A match in a league that isn't listed gets a placeholder named after its id. |
| `leagues[].table` | Shown as sent. Without it the table is counted from the matches. `qualify` places get the spectrum. |
| `squads` | Names for line-ups, events, the followed player and the player page. A team's squad, when sent, replaces that team's players. A player missing here shows as `#7`. |
| `matches` | The matches to show, in order. A match left out of a feed is gone. A match whose `home` or `away` isn't a known team is skipped. |
| `matches[].seq` | **v2.** See §4. The highest `seq` of any change folded into this snapshot of the match. |
| `matches[].day` | -1 yesterday, 0 today, 1 tomorrow. |
| `matches[].status` | `scheduled`, `live` or `finished`. |
| `matches[].minute`, `second` | The clock as of this snapshot. The client runs it on its own between syncs. A source with whole minutes only sends `second: 0`. |
| `matches[].featured` | The match the dev panel's Home / Away triggers act on, and the one the desktop opens first. |
| `matches[].events` | Every event so far, in `seq` order, in the shape of §3 without `match`. Within its `seq`, the snapshot's list is complete: an event left out is gone. |
| `matches[].stats` | Pairs `[home, away]` for `xg`, `shots`, `onTarget`, `bigChances`, `corners`, `passes`, `fouls`, `offsides`, plus `possession`. Without stats the app counts shots, corners and fouls from the events. |
| `matches[].momentum` | One value per minute, -1 (away) to 1 (home). Without it the line is drawn from the events. |
| `matches[].players` | Ratings and numbers per shirt. Players without numbers show only what the events tell: minutes, goals, assists, shots. Tonight's leaders lists only players with a rating. |
| `next[team].in` | Seconds until that team's next kick-off, for the countdown on the followed player's card. |

Give every event an `id` that never changes. That is how the client knows what it has already
played. (An event without one gets an id made from its kind, side, minute and player, which only
holds while the list doesn't change shape.)

---

## 3. `event`: one moment, now

One per SSE message on `/events`, with the event's `seq` as the SSE `id` so a reconnect resumes
with `Last-Event-ID`. The client runs its own reconnects (backoff, then a full resync), and a
browser `EventSource` can't set that header on a new connection, so the client sends the resume
point as the `lastEventId` query parameter (`/events?lastEventId=15`). The server reads either.

```json
{ "id": "9f3", "seq": 15, "match": 501, "kind": "goal", "side": "home", "minute": 66,
  "player": 14, "other": 7, "style": "header", "score": [2, 1],
  "text": "Saka whips it in and Gyökeres rises highest at the near post." }
```

```json
{ "id": "9f4", "seq": 16, "match": 501, "kind": "goalCancelled", "side": "home", "minute": 68,
  "ref": "9f3", "score": [1, 1], "text": "VAR: offside in the build-up. No goal." }
```

| `kind` | Fields | What plays |
| --- | --- | --- |
| `goal` | side, minute, player, other (assist), style, score, text | The card floods with colour, the other cards turn grey, the new number takes the spectrum, then the goal scene (match open) or the notification. |
| `goalCancelled` | **v2.** side, minute, ref (the goal's `id`), score, text | The goal comes off the board and is struck through in the commentary. Without `ref`, the side's latest standing goal is the one cancelled. |
| `red` | side, minute, player, text | Red card scene or notification; the followed player's card floods red if it is him. |
| `yellow`, `sub`, `shot`, `miss`, `blocked`, `bigChance`, `corner`, `foul`, `offside` | side, minute, player, other, text | The event slides into the match's commentary. For `sub`, player = on, other = off. |
| `fulltime` | – | The final whistle: the live card folds away. |
| `kickoff` | – | A scheduled match goes live. |
| `minute` | minute, second | Clock sync (the client runs the clock itself between updates). |
| `action` | side, player, text, onBall, act | What the followed player is doing right now (his card's live line). |

Every event that changes the match (all but `minute` and `action`) carries:
- **`seq` (v2):** the match's next `seq`.
- **`score` (v2):** the match's score after it, `[home, away]`, even when it didn't change.

`name` / `otherName` override the squad names. `style` (goals) is one of `through`, `cutback`,
`header`, `solo`. Events without `text` get a plain line made only from what was sent ("Saka
scores for Arsenal, set up by Ødegaard."). Nothing is invented.

---

## 4. Ordering: `seq`

`seq` is per match. The adapter keeps one counter per match and bumps it for every event it
emits; a snapshot of that match carries the counter's current value. Clock, stats, momentum and
player numbers can change without a bump.

How the client applies them:

1. **A snapshot older than what the client has** (`match.seq` below the client's) keeps none of its
   match-level fields: not the score, status, clock, stats or line-ups. Only events the client
   has never seen are learned from it, quietly. This is what stops the v1 rollback.
2. **A snapshot at or past the client's `seq`** replaces the match. Its event list is the truth up
   to its `seq`; live events the client holds with a higher `seq` stay.
3. **An event the client has seen** (same `id` in that match) is ignored.
4. **An event at or below the client's `seq`** is history: it joins the list, but changes neither
   the score nor the status, and plays nothing.
5. **An event past the client's `seq`** is applied: the match takes its `score` and `seq`, and
   the clock jumps forward to its `minute` if that is ahead.
6. **An event for a match the client has no snapshot of** (the stream often connects before
   `/feed` returns) is held. When the match's snapshot arrives, held events go through rules 3–5.

A gap in `seq` (an event jumps from 15 to 18) means the client missed something. Rules 1–5 still
hold; recovering the missing events (full resync after a reconnect gap) is the sync service's job.

---

## 5. Moments

`applyFeed` and `applyEvent` return `{ state, moments }`. A moment is a goal, goalCancelled, red,
kickoff or fulltime, worth a scene, a toast or an announcement. Components never derive them.

- **Goals come from the score going up**, in a snapshot or an event alike: one goal moment per
  goal, matched to its goal event when the same update brought it. A goal seen first as a score
  change and then as its late event plays once: when the event arrives the score has already
  moved. One poll that shows 0–0 → 2–1 plays three goals.
- **goalCancelled comes from the score going down.** A goal and its cancel inside one poll play
  nothing, since nothing on the board changed. After a cancel, the next goal plays again even
  though the score reads as it did before.
- **red** from a new red-card event. **kickoff** and **fulltime** from the status going
  `scheduled → live` and `live → finished`.
- **Quiet:** the first feed, and a match's first appearance in a feed, set the stage without
  moments, as in v1.
- **Once:** each match remembers the moments it has played, so none plays twice.

---

## 6. Leniency and v1 sources

Like the Lua's `num(v, d)` / `text(v, d)`, the client never rejects a feed. A wrong or missing
field takes its default (`score` `[0, 0]`, `status` `scheduled`, colours grey and off-white,
league `fri`, …), and a list item that can't be used at all is dropped alone: a team or league
without an `id`, a match without `id`, `home` or `away`, a player without a number, an event of
an unknown kind. A `/feed` that isn't JSON parses as an empty feed.

A v1 source (no `seq`) still works: every `seq` reads as 0, every snapshot is "current" and
replaces the match as v1 did. A v1 goal event without `score` adds one to its side. Such a
source keeps the v1 rollback risk; that is what v2 removes.

**Known limitation.** `v1` sources that do not provide `seq` remain supported for backward
compatibility, but stale-snapshot protection cannot be guaranteed for them, so score rollback is
still possible.

---

## 7. Adapting a football API

Unchanged from `DATA-BINDING_4.md` §5, plus `seq`: the adapter server (Part 22) owns the per-match
counter, numbers every event it emits, and stamps snapshots with the counter's current value.

| Provider field | Scoreline |
| --- | --- |
| fixture id | `matches[].id` (a number) |
| status short `1H`, `2H`, `HT`, `ET` | `live`; `NS` → `scheduled`; `FT`, `AET`, `PEN` → `finished` |
| elapsed / extra time | `minute` (90 + extra) |
| goals home / away | `score` |
| event type Goal / Card / subst | `goal` / `yellow` or `red` / `sub` |
| goal disallowed by VAR | `goalCancelled` with `ref` |
| player number | `player` (shirt number), with `name` if your squads are incomplete |
| statistics | `stats` pairs |
| player rating | `players.home["7"].rating` |

---

## 8. The stand-in backend (`npm run api`)

`scripts/mock-api.mjs` serves this contract from the demo's evening (`src/data/demo/sim.ts`, the
same simulation `?demo` plays in the page), so the app's real sync path can be watched end to end:

```
npm run api                      # http://127.0.0.1:8787/api  (--speed 10 for ?demo=fast's pace)
npm run dev   →  /?api           # or npm run build && npm run preview; both proxy /api to it
```

- `GET /api/feed`: the whole feed, with `ETag`; `If-None-Match` on an unchanged one is a `304`.
  The ETag moves with every event and snapshot; the clocks run on without it, as §2 allows.
- `GET /api/events`: SSE, one §3 event per message. The SSE `id` counts the stream's messages
  (one resume point for every match); each message still carries its match's `seq`.
  `Last-Event-ID` or `?lastEventId=` replays the messages after it (the last 500 are kept).
- `POST /api/trigger?name=goalHome`: the dev panel's triggers, for tests and live demos.

In the page, `?api` uses `ApiSource` (poll, ETag, stream, resync) against `/api`, or against the
build's `VITE_API_BASE`. With no source in the URL the page plays the demo; `?demo=off` is the page
with no source. `e2e/api.spec.ts` drives the app through it.

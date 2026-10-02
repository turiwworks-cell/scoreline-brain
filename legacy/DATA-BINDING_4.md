# Scoreline · data binding

The app is one Rive Node Script (`scoreline.luau`). It draws everything and reads one
View Model. Your code talks to that View Model only: no Rive editing is needed to show
new teams, matches, goals or players.

Without any data the app plays its built-in demo (France – Argentina and four other
matches). The first `feed` it receives switches the demo off for good.

---

## 1. Rive setup

### Artboards

| Artboard | Size | Script input |
| --- | --- | --- |
| Phone (your current `Artboard 2`) | 390 × 844 | `desktop` off |
| Desktop (new, name it `Desktop`) | 1280 × 892 | `desktop` on |

Both artboards use the same script, placed at x = 0, y = 0. Set the `liveIcon` input on
both to your Live icon artboard. Give each artboard a state machine (an empty one is
fine) so the runtime sends it taps.

Keep exactly **one** copy of the script on each artboard. A hidden copy still receives
taps in the runtimes and swallows them (the current file has one at x 195, y 422 on
`Artboard 2`: delete it).

### View Model

Create a View Model (for example `Scoreline`), set it as the View Model of both
artboards, and add these properties. Every one is optional; the script finds them by
name.

| Property | Type | Direction | What it does |
| --- | --- | --- | --- |
| `feed` | String | host → app | The whole picture as JSON (section 2). Send it again whenever anything changes. |
| `event` | String | host → app | One moment as JSON (section 3), played the moment it arrives. |
| `day` | Number | both | The day tab, 1–5 (3 = Today / Ongoing). |
| `liveOnly` | Boolean | both | The Live filter. |
| `openMatch` | Number | both | The open match id, 0 = the list. Load that match's details when it changes. |
| `followTeam` | String | both | The followed player's team id. |
| `followNumber` | Number | both | The followed player's shirt number. |
| `goalHome`, `goalAway`, `goalFavorite`, `redHome`, `redAway`, `redFavorite`, `fullTime` | Trigger | host → app | Play a moment by hand (demo and testing). |

"Both" means: set it to restore a state or deep-link, and listen to it to know what the
person did. The app writes these back every time they change on screen.

### Script inputs worth knowing

| Input | Default | |
| --- | --- | --- |
| `desktop` | off | Three panes on a 1280 × 892 artboard. |
| `goalFocus` | 4 | Seconds the other live cards stay grey after a goal. |
| `goalMark` | 8 | Seconds the new score stays in the spectrum. |
| `toastHold` / `goalHold` | 4.5 / 7.5 | Notification and goal scene durations. |
| `speed` | 1 | Global motion speed. |

---

## 2. `feed` — the whole picture

Send it on start and whenever something changes. Polling every 10–30 s is fine: new
goals, red cards and final whistles found in a new feed play their moment (the score
going up plays a goal even if the event itself has not arrived yet).

```json
{
  "version": 1,
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
    { "id": 501, "day": 0, "league": "epl", "home": "ars", "away": "che",
      "score": [1, 1], "status": "live", "minute": 64, "second": 20, "kickoff": "17:30",
      "featured": true, "favourite": true,
      "venue": { "name": "Emirates Stadium", "city": "London", "referee": "Michael Oliver", "attendance": "60,251" },
      "lineups": {
        "home": { "formation": "4-3-3", "xi": [1, 12, 2, 6, 33, 41, 8, 36, 7, 14, 11], "bench": [19, 10] },
        "away": { "formation": "4-2-3-1", "xi": [1, 24, 6, 29, 3, 25, 8, 10, 11, 9, 7], "bench": [20] }
      },
      "events": [
        { "id": "a2", "kind": "goal", "side": "home", "minute": 27, "player": 7, "other": 8,
          "style": "cutback", "xg": 0.41, "text": "Ødegaard slides it across and Saka sweeps it in." }
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
| `teams[].id` | Any short id. National ids from the demo (`fra`, `arg`, `eng`, `bra`, …) keep their drawn flags. |
| `teams[].colors` | First colour the side is known by, then the second. They tint the live cards, the momentum wave and the stats. |
| `teams[].flag` | Optional crest in a 30 × 30 box: `["h", c1, c2, …]` stripes, `["v", …]` columns, `["r", x, y, w, h, c]`, `["c", cx, cy, r, c]`, `["cs", cx, cy, r, width, c]`, `["s", cx, cy, r, c]` star, `["d", c]` diamond. Without it: a disc in the first colour ringed in the second. |
| `leagues[].table` | Shown as sent. Without it the table is counted from the matches. `qualify` places get the spectrum. |
| `squads` | Names for line-ups, events, the followed player and the player page. A player missing here shows as `#7`. |
| `matches[].day` | -1 yesterday, 0 today, 1 tomorrow. |
| `matches[].status` | `scheduled`, `live` or `finished`. |
| `matches[].featured` | The match the Home / Away triggers act on, and the one the desktop opens first. |
| `matches[].events[].kind` | `goal`, `yellow`, `red`, `sub` (player = on, other = off), `shot`, `miss`, `blocked`, `bigChance`, `corner`, `foul`, `offside`. `name` / `otherName` override the squad names. |
| `matches[].stats` | Pairs `[home, away]`. Without stats the app counts shots, corners and fouls from the events. |
| `matches[].momentum` | One value per minute, -1 (away) to 1 (home). Without it the line is drawn from the events. |
| `matches[].players` | Ratings and numbers per shirt. Players without numbers show only what the events tell: minutes, goals, assists, shots. Tonight's leaders lists only players with a rating. |
| `next[team].in` | Seconds until that team's next kick-off, for the countdown on the followed player's card. |

Give every event an `id` that never changes. That is how the app knows what it has
already played.

---

## 3. `event` — one moment, now

```json
{ "id": "9f3", "match": 501, "kind": "goal", "side": "home", "minute": 66,
  "player": 14, "other": 7, "style": "header", "score": [2, 1],
  "text": "Saka whips it in and Gyökeres rises highest at the near post." }
```

| `kind` | Fields | What plays |
| --- | --- | --- |
| `goal` | side, minute, player, other (assist), style, score, text | The card floods with colour, the other cards turn grey, the new number takes the spectrum, then the goal scene (match open) or the notification. |
| `red` | side, minute, player, text | Red card scene or notification; the followed player's card floods red if it is him. |
| `yellow`, `sub`, `shot`, `miss`, `blocked`, `bigChance`, `corner`, `foul`, `offside` | side, minute, player, other, text | The event slides into the match's commentary. |
| `fulltime` | – | The final whistle: the live card folds away. |
| `kickoff` | – | A scheduled match goes live. |
| `minute` | minute, second | Clock sync (the app runs the clock itself between updates). |
| `action` | side, player, text, onBall, act | What the followed player is doing right now (his card's live line). |

`style` (goals) is one of `through`, `cutback`, `header`, `solo`. Events without `text`
get a plain line made only from what was sent ("Saka scores for Arsenal, set up by
Ødegaard."). Nothing is invented.

---

## 4. Host code

### Web

```html
<script src="https://unpkg.com/@rive-app/webgl2@2.44.0/rive.js"></script>
<script src="scoreline-bridge.js"></script>
<script>
  const r = new rive.Rive({
    src: 'scoreline.riv', canvas, autoplay: true, autoBind: true, stateMachines: 'State Machine 1',
    onLoad: async () => {
      const app = new ScorelineBridge(r);
      app.sendFeed(await myApi.matchday());                 // your adapter → the feed above
      myApi.onEvent(e => app.sendEvent(e));                 // goals, cards, subs …
      app.on('openMatch', id => id && myApi.details(id).then(d => app.sendFeed(d)));
      app.on('followTeam', team => save('followed', team));
    },
  });
</script>
```

`createScorelineDemo(app).start()` (in the same file) plays a whole matchday through the
bridge. It is what the Live data button on `scoreline.html` runs.

### iOS (Swift)

```swift
riveViewModel.riveModel?.enableAutoBind { instance in
    instance.stringProperty(fromPath: "feed")?.value = feedJSON
    instance.stringProperty(fromPath: "event")?.value = eventJSON
    _ = instance.numberProperty(fromPath: "openMatch")?.addListener { id in loadDetails(Int(id)) }
}
```

### Android (Kotlin)

```kotlin
riveView.setRiveResource(R.raw.scoreline, autoBind = true)
val vmi = riveView.controller.stateMachines.first().viewModelInstance!!
vmi.getStringProperty("feed").value = feedJson
lifecycleScope.launch { vmi.getNumberProperty("openMatch").valueFlow.collect { loadDetails(it.toInt()) } }
```

Method names follow Rive's data-binding docs for each runtime
(https://rive.app/docs/runtimes/data-binding); check them against the runtime version
you ship.

---

## 5. Adapting a football API

Write one small adapter on your side (or on a server) that turns the provider's
fixtures, events, line-ups and statistics into the `feed` and `event` shapes above.
Typical mapping:

| Provider field | Scoreline |
| --- | --- |
| fixture id | `matches[].id` (a number) |
| status short `1H`, `2H`, `HT`, `ET` | `live`; `NS` → `scheduled`; `FT`, `AET`, `PEN` → `finished` |
| elapsed / extra time | `minute` (90 + extra) |
| goals home / away | `score` |
| event type Goal / Card / subst | `goal` / `yellow` or `red` / `sub` |
| player number | `player` (shirt number), with `name` if your squads are incomplete |
| statistics | `stats` pairs |
| player rating | `players.home["7"].rating` |

Polling the provider every 15 s and sending the feed is enough to start; push the
`event` property from a websocket when you have one, so goals play the second they
happen.

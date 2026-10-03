# Standalone moments source verification

Run from the repository root with Node 22+ and Rive CLI 1.0.3:

```sh
node verification/moments-script/run.mjs --prepare-only
rive verification/moments-script/build/tests --test --format=json
rive verification/moments-script/build/native --verify --format=json
rive verification/moments-script/build/native --data=play=true --advance=0.9s --screenshot=verification/moments-script/build/goal.png
rive verification/moments-script/build/native --data=kind=red --data=play=true --advance=0.9s --screenshot=verification/moments-script/build/red.png
rive verification/moments-script/build/native --pointer=click@195,170 --advance=2s --pointer=click@195,170 --advance=0.9s --data-dump=verification/moments-script/build/replayed.json
```

The preparation command compares the two extracted drawing functions against the legacy
reference and checks all nine exact glyph definitions. It then creates two disposable
projects from the CURRENT `rive/moments.luau` source, without duplicating production code.

The Luau Tests project executes six cases with Rive's native Path/Paint/Gradient types.
Its View Model, Context notification and Renderer dispatch are test doubles.
It covers phases, no initial delay, negative/large steps, mid-play restart, 20 alternating
coloured plays, path identity, retained frame-cache bounds and listener replacement.
Cache counts are an ownership test, not a JS/WASM/GPU heap measurement.

The native scene project uses the real Rive CLI View Model, state machine, script node,
drawing and trigger dispatch. Clicking the transparent full-artboard test hit area fires
`play`. That hit area and listener belong only to this verification fixture; neither is
in `rive/moments.luau` or required by the editor handoff. In the app, the DOM owns hits.

Use `--data-dump-every=1` with a data-dump file to observe phase transitions frame by frame.
For 20 native replays on Windows:

```powershell
$momentArgs = @(
  'verification/moments-script/build/native',
  '--data-dump-every=1',
  '--data-dump=verification/moments-script/build/20-goals.jsonl'
)
1..20 | ForEach-Object {
  $momentArgs += '--pointer=click@195,170'
  $momentArgs += '--advance=2s'
}
rive @momentArgs
```

Add `--data=kind=red` and change the output path to check red replays.
Generated `build/` files are ignored. The unsigned native fixture is NOT a deliverable
for the web runtime: use the editor to export signed scripts as described in
[`rive/EDITOR-GUIDE.fa.md`](../../rive/EDITOR-GUIDE.fa.md).

After BOTH real exports exist, run `npx playwright test -c playwright.rive.config.ts`.
Until then, the application's signed-artwork geometry and real-runtime heap acceptance
remain pending. CI's DOM scene regressions do not establish Rive artwork acceptance.


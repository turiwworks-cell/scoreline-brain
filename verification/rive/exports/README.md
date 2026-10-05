# Editor exports received for Part 20

Production assets are separate files in `public/rive/`:
- `moments.riv`: accepted signed Node-script export, 18,100 bytes.
- `live-icon.riv`: full-button export of 2026-10-05, 24,925 bytes: the `aniamtion` artboard only
  (no `font` helper), timelines `live to idle` and `idle to live`.

`live-icon.candidate.riv` is a diagnostic copy of the previous accepted Live export (26,800
bytes). It contains helper `font` plus full-button `aniamtion`; the host selects
`aniamtion` explicitly and binds Boolean `islive` and String `count`.
Production acceptance tests load `/rive/live-icon.riv`, not this copy.

`live-icon.original.riv` is the user's original full Live button export, 243,688 bytes.
It is historical diagnostic evidence only: over the 60,000-byte budget, with a static
calendar text run `12` and no String `count`.
Its embedded DM Sans font occupies 240,164 bytes. It is not shipped from `public/`.

The older 23,618-byte helper-only replacement is preserved in historical commit
`36db70cf1c0bb45e1d41272c60c4cf4152800e7d`; the current candidate path has been replaced.

Current executed results: [final acceptance report](../../../reports/part20-live-acceptance.md).

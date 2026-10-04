/*
 * Cuts the squad atlases into per-player images (BUILD-PLAN Part 8).
 *
 *   node scripts/slice-atlas.ts --src <dir with squad_fra.png and squad_arg.png> [--out public/img/players] [--report report.json]
 *
 * The atlases are the 4032 × 3556 squad sheets the Rive build drew from (luau:1461–1508). They
 * are not in the repo. Every image is a straight cut of the atlas at the Lua's geometry: busts,
 * heads and the frosted busts are each their own block of the sheet, already framed and
 * already blurred there. Nothing is re-framed, re-blurred or scaled up: @2x is the atlas's own
 * pixels (ATLAS.k = 2 atlas pixels per design unit), @1x is that halved.
 *
 * Writes `<out>/<team>/<n>-<bust|head|frost>@<1|2>x.<avif|webp>` (ARCHITECTURE §8) and
 * `<out>/manifest.json`, keyed by the app's player ids (`<team>:<n>`, playerKey). A coach is
 * n = 0 and is listed under `coaches`, by team, since the domain has no player id for one.
 *
 * Each player's head is measured on his bust and written to the manifest as `face` (design units):
 * where the top of his head is, how wide his head is and where it is centred. The squads were
 * not framed alike (Argentina's heads are about a fifth larger and higher than France's), so a
 * face cut at one fixed crop made Messi bigger than Mbappé; ui/PlayerPhoto frames every face from
 * these numbers instead. `--faces <dir>` measures the busts already published in <dir> and writes
 * only the `face` entries, for when the atlases are not at hand.
 *
 * Checks, and exits non-zero when one fails: every cell lies inside the sheet; every listed
 * person's cell has a picture and every cell past the squad is empty; nothing touches a cell's
 * edge where a neighbour would cut it; every bust@2x is within BUST_BUDGET bytes at or above
 * its quality floor. It prints each bust's framing and each output's size and PSNR.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import sharp, { type Sharp } from 'sharp';

// ---------------------------------------------------------------------------------------------
// The atlas, as luau:1461–1476 lays it out.

const SHEET = { w: 4032, h: 3556 };
const ATLAS = { bw: 288, bh: 360, bcols: 7, k: 2, headY: 2880, headS: 224, headP: 232, headC: 17, blurY: 3376, blurW: 144, blurH: 180 };
/** Design-unit crops of a bust (luau:1470–1475), checked against each bust's framing below. */
const CROP = { face: [60, 8, 168, 168], chest: [0, 8, 288, 268], full: [0, 0, 288, 360], head: [54, 4, 180, 180] } as const;

type Kind = 'bust' | 'head' | 'frost';
type Rect = { left: number; top: number; width: number; height: number };

/** Where cell `cell` (1-based, the squad row, luau:2280) sits in the sheet for each kind, in atlas pixels. */
function cellRect(kind: Kind, cell: number): Rect {
  const i = cell - 1;
  const k = ATLAS.k;
  switch (kind) {
    case 'bust': // luau:1495–1499
      return { left: (i % ATLAS.bcols) * ATLAS.bw * k, top: Math.floor(i / ATLAS.bcols) * ATLAS.bh * k, width: ATLAS.bw * k, height: ATLAS.bh * k };
    case 'head': // headS square cells on a headP pitch, headC to a row, from headY
      return { left: (i % ATLAS.headC) * ATLAS.headP, top: ATLAS.headY + Math.floor(i / ATLAS.headC) * ATLAS.headP, width: ATLAS.headS, height: ATLAS.headS };
    case 'frost': // luau:1506
      return { left: i * ATLAS.blurW, top: ATLAS.blurY, width: ATLAS.blurW, height: ATLAS.blurH };
  }
}

/** How many cells of each kind the sheet has room for. */
const CAPACITY: Record<Kind, number> = {
  bust: ATLAS.bcols * Math.floor(ATLAS.headY / (ATLAS.bh * ATLAS.k)),
  head: ATLAS.headC * Math.floor((ATLAS.blurY - ATLAS.headY) / ATLAS.headP),
  frost: Math.floor(SHEET.w / ATLAS.blurW),
};

// ---------------------------------------------------------------------------------------------
// Who is in which cell: the Lua's squad rows for France and Argentina, in order ("the row order
// is the order of the photos in squad_fra / squad_arg", luau:1849–1913). n = 0 is the coach.
// src/ui/photos.test.ts checks these names against the demo squads (src/data/demo/data.ts).

const ORDER: Record<string, readonly (readonly [n: number, name: string])[]> = {
  fra: [
    [1, 'Brice Samba'], [2, 'Malo Gusto'], [3, 'Lucas Digne'], [4, 'Dayot Upamecano'], [5, 'Jules Koundé'],
    [6, 'Manu Koné'], [7, 'Ousmane Dembélé'], [8, 'Aurélien Tchouaméni'], [9, 'Marcus Thuram'], [10, 'Kylian Mbappé'],
    [11, 'Michael Olise'], [12, 'Bradley Barcola'], [13, "N'Golo Kanté"], [14, 'Adrien Rabiot'], [15, 'Ibrahima Konaté'],
    [16, 'Mike Maignan'], [17, 'William Saliba'], [18, 'Warren Zaïre-Emery'], [19, 'Theo Hernández'], [20, 'Désiré Doué'],
    [21, 'Lucas Hernández'], [22, 'Jean-Philippe Mateta'], [23, 'Robin Risser'], [24, 'Rayan Cherki'], [25, 'Maghnes Akliouche'],
    [26, 'Maxence Lacroix'], [0, 'Didier Deschamps'],
  ],
  arg: [
    [1, 'Juan Musso'], [2, 'Marcos Senesi'], [3, 'Nicolás Tagliafico'], [4, 'Gonzalo Montiel'], [5, 'Leandro Paredes'],
    [6, 'Lisandro Martínez'], [7, 'Rodrigo De Paul'], [8, 'Valentín Barco'], [9, 'Julián Álvarez'], [10, 'Lionel Messi'],
    [11, 'Giovani Lo Celso'], [12, 'Gerónimo Rulli'], [13, 'Cristian Romero'], [14, 'Exequiel Palacios'], [15, 'Nicolás González'],
    [16, 'Thiago Almada'], [17, 'Giuliano Simeone'], [18, 'Nico Paz'], [19, 'Nicolás Otamendi'], [20, 'Alexis Mac Allister'],
    [21, 'José Manuel López'], [22, 'Lautaro Martínez'], [23, 'Emiliano Martínez'], [24, 'Enzo Fernández'], [25, 'Facundo Medina'],
    [26, 'Nahuel Molina'], [0, 'Lionel Scaloni'],
  ],
};

// ---------------------------------------------------------------------------------------------
// Encoding. Busts try the highest quality first and step down until the file fits the budget;
// below the floor they fail rather than lose more. Heads and frosts are small at any quality.

const BUST_BUDGET = 40_000; // bytes, for every bust@2x (BUILD-PLAN Part 8)
const LADDER = { avif: [64, 60, 56, 52, 48], webp: [84, 80, 76, 72, 70] } as const;
type Format = keyof typeof LADDER;
const FORMATS: readonly Format[] = ['avif', 'webp'];
const KINDS: readonly Kind[] = ['bust', 'head', 'frost'];
const SCALES = [1, 2] as const;

function encode(img: Sharp, format: Format, quality: number): Promise<Buffer> {
  return format === 'avif'
    ? img.clone().avif({ quality, effort: 6, chromaSubsampling: '4:4:4' }).toBuffer()
    : // alpha at 70 keeps the matte at ~45 dB PSNR; near-lossless alpha (90+) doubles a patterned bust
      img.clone().webp({ quality, alphaQuality: 70, effort: 6, smartSubsample: true }).toBuffer();
}

/** PSNR (dB) of `out` against `ref`, both composited over the app's black, and of their alpha. */
async function psnr(ref: Buffer, out: Buffer): Promise<{ rgb: number; alpha: number }> {
  const flat = (b: Buffer) => sharp(b).flatten({ background: '#000000' }).raw().toBuffer();
  const alpha = (b: Buffer) => sharp(b).ensureAlpha().extractChannel(3).raw().toBuffer();
  const db = (a: Buffer, b: Buffer) => {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += (a[i]! - b[i]!) ** 2;
    return sum === 0 ? Infinity : 10 * Math.log10((255 * 255) / (sum / a.length));
  };
  const [fr, fo, ar, ao] = await Promise.all([flat(ref), flat(out), alpha(ref), alpha(out)]);
  return { rgb: db(fr, fo), alpha: db(ar, ao) };
}

// ---------------------------------------------------------------------------------------------
// Measuring a cell.

type Alpha = { data: Buffer; width: number; height: number };

async function alphaOf(sheet: Sharp, r: Rect): Promise<Alpha> {
  const { data, info } = await sheet.clone().extract(r).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

const SOLID = 16; // alpha above this counts as picture

/** The picture's bounding box, its widest alpha on each edge, and the centre of its top 168 units. */
function framing(a: Alpha) {
  let x0 = a.width, y0 = a.height, x1 = -1, y1 = -1, sum = 0;
  const edge = { top: 0, bottom: 0, left: 0, right: 0 };
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const v = a.data[y * a.width + x]!;
      if (y === 0) edge.top = Math.max(edge.top, v);
      if (y === a.height - 1) edge.bottom = Math.max(edge.bottom, v);
      if (x === 0) edge.left = Math.max(edge.left, v);
      if (x === a.width - 1) edge.right = Math.max(edge.right, v);
      sum += v;
      if (v > SOLID) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    }
  }
  return { empty: x1 < 0, box: { x0, y0, x1, y1 }, edge, mean: sum / a.data.length };
}

/**
 * Where a bust's head is, in design units: the top of the hair, the head's width (the widest run
 * of picture within the head's first 70 units: below that come the shoulders) and its centre.
 * `k` is pixels per design unit.
 */
export function faceFrame(a: Alpha, k: number): { top: number; w: number; cx: number } | null {
  const run = (y: number) => {
    let l = -1, r = -1;
    for (let x = 0; x < a.width; x++) if (a.data[y * a.width + x]! > 128) { if (l < 0) l = x; r = x; }
    return l < 0 ? null : { l, r };
  };
  let top = -1;
  for (let y = 0; y < a.height && top < 0; y++) if (run(y)) top = y;
  if (top < 0) return null;
  let best = { l: 0, r: -1 };
  for (let y = top; y < Math.min(a.height, top + 70 * k); y++) {
    const r = run(y);
    if (r && r.r - r.l > best.r - best.l) best = r;
  }
  const u = (px: number) => Math.round((px / k) * 10) / 10;
  return { top: u(top), w: u(best.r - best.l + 1), cx: u((best.l + best.r + 1) / 2) };
}

/** Horizontal centre (alpha-weighted) of rows y0..y1, in pixels. */
function centreX(a: Alpha, y0: number, y1: number): number {
  let m = 0, s = 0;
  for (let y = Math.max(0, y0); y < Math.min(a.height, y1); y++) {
    for (let x = 0; x < a.width; x++) {
      const v = a.data[y * a.width + x]!;
      m += v * x; s += v;
    }
  }
  return s > 0 ? m / s : NaN;
}

// ---------------------------------------------------------------------------------------------

type FileOut = { file: string; width: number; height: number; bytes: number; quality: number; psnr: number; alphaPsnr: number };
type Entry = { team: string; n: number; name: string; cell: number; path: string; face?: { top: number; w: number; cx: number } };

/** `--faces <dir>`: measures the busts published in <dir> and writes their `face` into its manifest. */
async function measureFaces(dir: string) {
  const path = join(resolve(dir), 'manifest.json');
  const manifest = JSON.parse(await readFile(path, 'utf8')) as { players: Record<string, Entry>; coaches: Record<string, Entry> };
  for (const group of [manifest.players, manifest.coaches]) {
    for (const e of Object.values(group)) {
      const { data, info } = await sharp(join(resolve(dir), `${e.path}-bust@2x.webp`)).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
      const face = faceFrame({ data, width: info.width, height: info.height }, ATLAS.k);
      if (face) e.face = face;
    }
  }
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
  const all = [...Object.values(manifest.players), ...Object.values(manifest.coaches)].flatMap((e) => (e.face ? [e.face] : []));
  console.log(`face measured for ${all.length} busts: head width ${Math.min(...all.map((f) => f.w))}–${Math.max(...all.map((f) => f.w))} units, top ${Math.min(...all.map((f) => f.top))}–${Math.max(...all.map((f) => f.top))}`);
}

async function main() {
  const { values } = parseArgs({ options: { src: { type: 'string' }, out: { type: 'string', default: 'public/img/players' }, report: { type: 'string' }, faces: { type: 'string' } } });
  if (values.faces) return measureFaces(values.faces);
  if (!values.src) throw new Error('usage: node scripts/slice-atlas.ts --src <dir with squad_fra.png, squad_arg.png> [--out dir] [--report file.json]');
  const src = values.src;
  const outDir = resolve(values.out);
  const problems: string[] = [];
  const files: FileOut[] = [];
  const framings: Record<string, unknown>[] = [];
  const manifest = {
    version: 1,
    note: 'Generated by scripts/slice-atlas.ts. File: <team>/<n>-<kind>@<scale>x.<format>. Sizes in px; @2x is the atlas\'s own pixels.',
    formats: FORMATS,
    kinds: Object.fromEntries(KINDS.map((k) => {
      const r = cellRect(k, 1);
      return [k, { '1x': [r.width / 2, r.height / 2], '2x': [r.width, r.height] }];
    })),
    sources: {} as Record<string, { file: string; sha256: string }>,
    players: {} as Record<string, Entry>,
    coaches: {} as Record<string, Entry>,
  };
  const faces = new Map<string, NonNullable<Entry['face']>>();

  // the two sheets are cut side by side
  await Promise.all(Object.entries(ORDER).map(async ([team, order]) => {
    const file = join(src, `squad_${team}.png`);
    const bytes = await readFile(file);
    manifest.sources[team] = { file: `squad_${team}.png`, sha256: createHash('sha256').update(bytes).digest('hex') };
    const sheet = sharp(bytes);
    const meta = await sheet.metadata();
    if (meta.width !== SHEET.w || meta.height !== SHEET.h) problems.push(`${team}: sheet is ${meta.width}×${meta.height}, expected ${SHEET.w}×${SHEET.h}`);
    if (!meta.hasAlpha) problems.push(`${team}: sheet has no alpha channel`);

    // Every cell the sheet has room for: the squad's must hold a picture, the rest must be empty.
    for (const kind of KINDS) {
      for (let cell = 1; cell <= CAPACITY[kind]; cell++) {
        const r = cellRect(kind, cell);
        if (r.left < 0 || r.top < 0 || r.left + r.width > SHEET.w || r.top + r.height > SHEET.h) {
          problems.push(`${team} ${kind} cell ${cell}: ${JSON.stringify(r)} leaves the sheet`);
          continue;
        }
        const f = framing(await alphaOf(sheet, r));
        if (cell <= order.length && f.empty) problems.push(`${team} ${kind} cell ${cell} (${order[cell - 1]![1]}) is empty`);
        if (cell > order.length && !f.empty) problems.push(`${team} ${kind} cell ${cell} holds a picture but no one is listed for it`);
      }
    }

    await mkdir(join(outDir, team), { recursive: true });
    for (const [idx, [n, name]] of order.entries()) {
      const cell = idx + 1;
      const id = `${team}:${n}`;

      for (const kind of KINDS) {
        const r = cellRect(kind, cell);
        const a = await alphaOf(sheet, r);
        const f = framing(a);
        // A picture reaching a side or the top was cut there by the atlas: say so. The bust's
        // bottom is a soft fade into the next row, so only an opaque bottom edge counts.
        const cut: (keyof typeof f.edge)[] = (['top', 'left', 'right'] as const).filter((e) => f.edge[e] > SOLID);
        if (kind === 'bust' && f.edge.bottom > 128) cut.push('bottom');
        if (cut.length > 0) problems.push(`${id} ${kind}: picture reaches the cell's ${cut.join(', ')} edge (alpha ${cut.map((e) => f.edge[e]).join(', ')})`);
        if (kind === 'bust') {
          const face = faceFrame(a, ATLAS.k);
          if (face) faces.set(id, face);
          const u = (px: number) => Math.round((px / ATLAS.k) * 10) / 10;
          const [, fy, , fh] = CROP.face;
          framings.push({
            id, name,
            top: u(f.box.y0), left: u(f.box.x0), right: u(f.box.x1 + 1), bottom: u(f.box.y1 + 1),
            // where the face crop's rows put the head: the Lua centres every face on x = 144
            faceCentre: u(centreX(a, fy * ATLAS.k, (fy + fh) * ATLAS.k)),
            edge: f.edge,
          });
        }

        const cut2 = await sheet.clone().extract(r).png().toBuffer();
        for (const scale of SCALES) {
          const w = scale === 2 ? r.width : r.width / 2;
          const h = scale === 2 ? r.height : r.height / 2;
          const img = scale === 2 ? sharp(cut2) : sharp(cut2).resize(w, h, { kernel: 'lanczos3' });
          const ref = await img.clone().png().toBuffer();
          for (const format of FORMATS) {
            const budgeted = kind === 'bust' && scale === 2;
            const ladder = budgeted ? LADDER[format] : LADDER[format].slice(0, 1);
            let out: Buffer | undefined;
            let quality = 0;
            for (const q of ladder) {
              out = await encode(img, format, q);
              quality = q;
              if (!budgeted || out.length <= BUST_BUDGET) break;
            }
            if (budgeted && out!.length > BUST_BUDGET) problems.push(`${id} bust@2x.${format}: ${out!.length} B at the quality floor ${quality}, over ${BUST_BUDGET} B`);
            const rel = `${team}/${n}-${kind}@${scale}x.${format}`;
            await writeFile(join(outDir, rel), out!);
            const p = await psnr(ref, out!);
            files.push({ file: rel, width: w, height: h, bytes: out!.length, quality, psnr: Math.round(p.rgb * 10) / 10, alphaPsnr: Math.round(p.alpha * 10) / 10 });
          }
        }
      }
    }
  }));
  // written in the sheets' own order, whichever finished first
  manifest.sources = Object.fromEntries(Object.keys(ORDER).map((t) => [t, manifest.sources[t]!]));
  for (const [team, order] of Object.entries(ORDER)) {
    for (const [idx, [n, name]] of order.entries()) {
      const face = faces.get(`${team}:${n}`);
      const entry: Entry = { team, n, name, cell: idx + 1, path: `${team}/${n}`, ...(face ? { face } : {}) };
      if (n === 0) manifest.coaches[team] = entry;
      else manifest.players[`${team}:${n}`] = entry;
    }
  }
  files.sort((a, b) => a.file.localeCompare(b.file, 'en', { numeric: true }));
  framings.sort((a, b) => String(a.id).localeCompare(String(b.id), 'en', { numeric: true }));

  await writeFile(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  const busts = files.filter((f) => f.file.includes('-bust@2x'));
  const kb = (b: number) => `${(b / 1000).toFixed(1)} kB`;
  for (const format of FORMATS) {
    const fs = busts.filter((f) => f.file.endsWith(format));
    const max = fs.reduce((m, f) => (f.bytes > m.bytes ? f : m));
    const minQ = Math.min(...fs.map((f) => f.quality));
    const minP = fs.reduce((m, f) => (f.psnr < m.psnr ? f : m));
    console.log(`bust@2x ${format}: ${fs.length} files, largest ${kb(max.bytes)} (${max.file}), lowest quality ${minQ}, lowest PSNR ${minP.psnr} dB (${minP.file})`);
  }
  const total = files.reduce((s, f) => s + f.bytes, 0);
  console.log(`${Object.keys(manifest.players).length} players, ${Object.keys(manifest.coaches).length} coaches, ${files.length} files, ${kb(total)} in all`);
  if (values.report) await writeFile(values.report, `${JSON.stringify({ problems, framings, files }, null, 2)}\n`);
  if (problems.length > 0) {
    console.error(`\n${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log('all checks passed');
  }
}

await main();

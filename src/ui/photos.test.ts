import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { SQUADS } from '../data/demo/data';
import { playerKey } from '../domain';
import { PHOTO_ROOT, PHOTO_SIZES, photoSources, type PhotoKind } from './photos';

// The pipeline's output, as committed (scripts/slice-atlas.ts writes it).
const DIR = join(process.cwd(), 'public', PHOTO_ROOT);
type Entry = { team: string; n: number; name: string; cell: number; path: string };
const manifest = JSON.parse(readFileSync(join(DIR, 'manifest.json'), 'utf8')) as {
  formats: string[];
  kinds: Record<PhotoKind, { '1x': [number, number]; '2x': [number, number] }>;
  players: Record<string, Entry>;
  coaches: Record<string, Entry>;
};

const KINDS: PhotoKind[] = ['bust', 'head', 'frost'];
const PHOTO_TEAMS = ['fra', 'arg']; // the squads with an atlas (luau:1849)

test('every France and Argentina player has a photo under their own id, in their squad-row cell', () => {
  for (const team of PHOTO_TEAMS) {
    const rows = SQUADS[team]!;
    rows.forEach(([n, first, last], i) => {
      const entry = n === 0 ? manifest.coaches[team] : manifest.players[playerKey(team, n)];
      expect(entry, `${team} ${n} ${last}`).toBeDefined();
      // the row order is the order of the photos in the atlas (luau:1851, cell = i, luau:2280)
      expect(entry!.cell).toBe(i + 1);
      expect(entry!.name).toBe(`${first} ${last}`);
      expect(entry!.path).toBe(`${team}/${n}`);
    });
  }
  const players = Object.keys(manifest.players);
  expect(players).toHaveLength(52);
  // nobody else has one: the other sides fall back to the kit disc
  expect(players.every((id) => PHOTO_TEAMS.includes(id.split(':')[0]!))).toBe(true);
});

test('every file the manifest promises exists, and each bust@2x is at most 40 kB', () => {
  const entries = [...Object.values(manifest.players), ...Object.values(manifest.coaches)];
  for (const e of entries) {
    for (const kind of KINDS) {
      for (const scale of [1, 2]) {
        for (const format of manifest.formats) {
          const file = join(DIR, `${e.path}-${kind}@${scale}x.${format}`);
          expect(existsSync(file), file).toBe(true);
          if (kind === 'bust' && scale === 2) expect(statSync(file).size, file).toBeLessThanOrEqual(40_000);
        }
      }
    }
  }
});

test('photoSources describes the files at their real widths, AVIF first', () => {
  for (const kind of KINDS) {
    expect(manifest.kinds[kind]['1x']).toEqual(PHOTO_SIZES[kind][1]);
    expect(manifest.kinds[kind]['2x']).toEqual(PHOTO_SIZES[kind][2]);
  }
  const s = photoSources('arg/10');
  expect(s.src).toBe('/img/players/arg/10-bust@1x.webp');
  expect(s.srcSet).toBe('/img/players/arg/10-bust@1x.webp 288w, /img/players/arg/10-bust@2x.webp 576w');
  expect(s.sources).toEqual([{ type: 'image/avif', srcSet: '/img/players/arg/10-bust@1x.avif 288w, /img/players/arg/10-bust@2x.avif 576w' }]);
  expect(photoSources('fra/0', 'frost').srcSet).toBe('/img/players/fra/0-frost@1x.webp 72w, /img/players/fra/0-frost@2x.webp 144w');
});

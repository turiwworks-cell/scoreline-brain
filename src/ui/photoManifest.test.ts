import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { coachPhoto, loadPhotoManifest, parsePhotoManifest, playerPhoto, setPhotoManifest } from './photoManifest';

const JSON_ = {
  version: 1,
  players: { 'fra:10': { team: 'fra', n: 10, name: 'Kylian Mbappé', cell: 10, path: 'fra/10' }, 'arg:10': { path: 'arg/10' }, 'bad:1': { name: 'x' } },
  coaches: { fra: { team: 'fra', n: 0, path: 'fra/0' } },
};

beforeEach(() => setPhotoManifest(null));
afterEach(() => vi.unstubAllGlobals());

test('reads the paths of the manifest slice-atlas writes and leaves out what is not one', () => {
  expect(parsePhotoManifest(JSON_)).toEqual({ players: { 'fra:10': 'fra/10', 'arg:10': 'arg/10' }, coaches: { fra: 'fra/0' } });
  expect(parsePhotoManifest(null)).toEqual({ players: {}, coaches: {} });
  expect(parsePhotoManifest({ players: 3 })).toEqual({ players: {}, coaches: {} });
});

test('gives AVIF and WebP sources at both widths for a player in the manifest, none for another', () => {
  const m = parsePhotoManifest(JSON_);
  const s = playerPhoto(m, 'fra', 10)!;
  expect(s.src).toBe('/img/players/fra/10-bust@1x.webp');
  expect(s.srcSet).toBe('/img/players/fra/10-bust@1x.webp 288w, /img/players/fra/10-bust@2x.webp 576w');
  expect(s.sources[0]).toEqual({ type: 'image/avif', srcSet: '/img/players/fra/10-bust@1x.avif 288w, /img/players/fra/10-bust@2x.avif 576w' });
  // the same object each time, so a memoised photo is not handed new sources
  expect(playerPhoto(m, 'fra', 10)).toBe(s);
  expect(playerPhoto(m, 'ita', 10)).toBeUndefined();
  expect(playerPhoto(null, 'fra', 10)).toBeUndefined();
});

test('finds a coach by team, without a shirt number', () => {
  const m = parsePhotoManifest(JSON_);
  expect(coachPhoto(m, 'fra')!.src).toBe('/img/players/fra/0-bust@1x.webp');
  expect(coachPhoto(m, 'arg')).toBeUndefined();
});

test('asks for the manifest once, however many ask', async () => {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => JSON_ }));
  vi.stubGlobal('fetch', fetchMock);
  await Promise.all([loadPhotoManifest(), loadPhotoManifest(), loadPhotoManifest()]);
  await loadPhotoManifest();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith('/img/players/manifest.json');
});

test('a failed request leaves every player on the kit disc, and the next screen may ask again', async () => {
  const fetchMock = vi.fn(async () => {
    throw new Error('offline');
  });
  vi.stubGlobal('fetch', fetchMock);
  await loadPhotoManifest();
  expect(playerPhoto(null, 'fra', 10)).toBeUndefined();
  await loadPhotoManifest();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

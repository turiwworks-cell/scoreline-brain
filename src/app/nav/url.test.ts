import { describe, expect, it } from 'vitest';
import { canonicalPath, hrefOf, listSearch, parseList, parseNav } from './url';

describe('parseNav', () => {
  it('reads the list, a match and a player', () => {
    // the app opens on Live; live=0 is today
    expect(parseNav('/', '')).toEqual({ list: { day: 0, live: true } });
    expect(parseNav('/', '?demo')).toEqual({ list: { day: 0, live: true } });
    expect(parseNav('/', '?live=0')).toEqual({ list: { day: 0, live: false } });
    expect(parseNav('/', '?day=-2')).toEqual({ list: { day: -2, live: false } });
    expect(parseNav('/match/7/lineup', '?day=1')).toEqual({ list: { day: 1, live: false }, match: { id: 7, tab: 'lineup' } });
    expect(parseNav('/player/arg/10', '')).toEqual({ list: { day: 0, live: true }, player: { team: 'arg', n: 10 } });
  });

  it('takes the match a player was opened from out of history state', () => {
    expect(parseNav('/player/fra/10', '', { under: { id: 1, tab: 'lineup' } }).under).toEqual({ id: 1, tab: 'lineup' });
    expect(parseNav('/player/fra/10', '', { under: { id: 1, tab: 'nope' } }).under).toEqual({ id: 1, tab: 'facts' });
    expect(parseNav('/player/fra/10', '', { under: { id: -1 } }).under).toBeUndefined();
    expect(parseNav('/player/fra/10', '', 'junk').under).toBeUndefined();
    // a match route ignores it
    expect(parseNav('/match/1/facts', '', { under: { id: 2 } }).under).toBeUndefined();
  });

  it('is tolerant: anything it does not understand reads as the list', () => {
    for (const p of ['/match/abc/facts', '/match/0/facts', '/match/-1', '/player/fra', '/player/fra/0', '/player/fra/100', '/player/%3Cx%3E/9', '/nope']) {
      expect(parseNav(p, '').match ?? parseNav(p, '').player, p).toBeUndefined();
    }
    expect(parseNav('/match/3', '').match).toEqual({ id: 3, tab: 'facts' });
    expect(parseNav('/match/3/bogus', '').match).toEqual({ id: 3, tab: 'facts' });
  });
});

describe('parseList', () => {
  it('Live shows today, so it drops the day', () => {
    expect(parseList('?live=1&day=2')).toEqual({ day: 0, live: true });
    expect(parseList('?live=0&day=2')).toEqual({ day: 2, live: false });
  });

  it('ignores days out of range or not whole', () => {
    for (const q of ['?day=3', '?day=-3', '?day=1.5', '?day=x', '?day=']) expect(parseList(q).day, q).toBe(0);
  });
});

describe('canonicalPath', () => {
  it('names the one spelling of each path, or null when it already is', () => {
    expect(canonicalPath('/match/7')).toBe('/match/7/facts');
    expect(canonicalPath('/match/7/')).toBe('/match/7/facts');
    expect(canonicalPath('/match/7/bogus')).toBe('/match/7/facts');
    expect(canonicalPath('/match/7/stats')).toBeNull();
    expect(canonicalPath('/player/arg/10')).toBeNull();
    expect(canonicalPath('/player/arg/10/x')).toBe('/player/arg/10');
    expect(canonicalPath('/whatever')).toBe('/');
    expect(canonicalPath('/')).toBeNull();
  });
});

describe('hrefOf and listSearch', () => {
  it('keep params the app does not own (demo, seed) as they were', () => {
    expect(hrefOf({ list: { day: 0, live: true }, match: { id: 2, tab: 'facts' } }, '?demo')).toBe('/match/2/facts?demo');
    expect(hrefOf({ list: { day: 1, live: false }, player: { team: 'fra', n: 10 } }, '?demo=fast&seed=3&day=-1')).toBe('/player/fra/10?demo=fast&seed=3&day=1');
    expect(hrefOf({ list: { day: 0, live: false } }, '?day=2&demo')).toBe('/?demo&live=0');
  });

  it('write day only when it is not today, live=0 for today, and nothing for Live, the default', () => {
    expect(listSearch({ day: 0, live: false }, '')).toBe('?live=0');
    expect(listSearch({ day: -2, live: false }, '')).toBe('?day=-2');
    expect(listSearch({ day: 0, live: true }, '?day=1')).toBe('');
    expect(listSearch({ day: 0, live: true }, '?live=1&demo')).toBe('?demo');
  });

  it('round-trips through parseNav', () => {
    const nav = { list: { day: -1, live: false }, match: { id: 42, tab: 'table' as const } };
    const href = hrefOf(nav, '?demo');
    const [path, search] = href.split('?');
    expect(parseNav(path ?? '', `?${search}`)).toEqual(nav);
  });
});

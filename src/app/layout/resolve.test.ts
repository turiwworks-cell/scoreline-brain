import { describe, expect, it } from 'vitest';
import type { Nav } from '../nav/url';
import { layoutFor } from './layoutMode';
import { planFlights, resolve, stackDepth, type Resolved } from './resolve';

const list = { day: 0, live: false };
const at = (n: Partial<Nav>): Nav => ({ list, ...n });
const lookup = { featured: 1, teamMatch: 4 };

describe('layoutFor', () => {
  it('phone below 768, two panes to 1199, three from 1200', () => {
    expect([390, 767, 768, 900, 1199, 1200, 1280].map(layoutFor)).toEqual(['phone', 'phone', 'two', 'two', 'two', 'three', 'three']);
  });
});

describe('resolve', () => {
  it('phone: only what the URL opens, plus the match a player came from', () => {
    expect(resolve(at({}), 'phone', lookup)).toMatchObject({ match: null, player: null });
    expect(resolve(at({ match: { id: 2, tab: 'stats' } }), 'phone', lookup).match).toEqual({ id: 2, tab: 'stats' });
    expect(resolve(at({ player: { team: 'fra', n: 10 } }), 'phone', lookup)).toMatchObject({ match: null, player: { team: 'fra', n: 10 } });
    expect(resolve(at({ player: { team: 'fra', n: 10 }, under: { id: 1, tab: 'lineup' } }), 'phone', lookup).match).toEqual({ id: 1, tab: 'lineup' });
  });

  it('panes: the match pane is never empty while there are matches', () => {
    for (const layout of ['two', 'three'] as const) {
      expect(resolve(at({}), layout, lookup).match).toEqual({ id: 1, tab: 'facts' });
      expect(resolve(at({ match: { id: 2, tab: 'stats' } }), layout, lookup).match).toEqual({ id: 2, tab: 'stats' });
      expect(resolve(at({ player: { team: 'fra', n: 10 }, under: { id: 3, tab: 'lineup' } }), layout, lookup).match).toEqual({ id: 3, tab: 'lineup' });
      // a player opened cold sits beside their team's match
      expect(resolve(at({ player: { team: 'fra', n: 10 } }), layout, lookup).match).toEqual({ id: 4, tab: 'facts' });
      expect(resolve(at({}), layout, {}).match).toBeNull();
    }
  });

  it('stackDepth counts the screens over the list', () => {
    const r = (layout: Resolved['layout'], match: boolean, player: boolean): Resolved => ({
      layout,
      list,
      match: match ? { id: 1, tab: 'facts' } : null,
      player: player ? { team: 'fra', n: 10 } : null,
    });
    expect(stackDepth(r('phone', true, true))).toBe(2);
    expect(stackDepth(r('phone', false, true))).toBe(1);
    expect(stackDepth(r('two', true, false))).toBe(0);
    expect(stackDepth(r('two', true, true))).toBe(1);
    expect(stackDepth(r('three', true, true))).toBe(0);
  });
});

describe('planFlights', () => {
  const r = (n: Partial<Nav>, layout: Resolved['layout'] = 'phone') => resolve(at(n), layout, lookup);

  it('opening a match flies card → hero, closing it hero → card', () => {
    expect(planFlights(r({}), r({ match: { id: 2, tab: 'facts' } }))).toEqual([{ group: 'match:2', from: 'card', to: 'hero', timing: 'screen', direction: 'open' }]);
    expect(planFlights(r({ match: { id: 2, tab: 'facts' } }), r({}))).toEqual([{ group: 'match:2', from: 'hero', to: 'card', timing: 'screen', direction: 'close' }]);
  });

  it('switching panes closes one and opens the other; a tab change flies nothing', () => {
    const a = r({ match: { id: 1, tab: 'facts' } }, 'three');
    const b = r({ match: { id: 2, tab: 'facts' } }, 'three');
    expect(planFlights(a, b).map((p) => `${p.direction}:${p.group}`)).toEqual(['close:match:1', 'open:match:2']);
    expect(planFlights(a, r({ match: { id: 1, tab: 'stats' } }, 'three'))).toEqual([]);
  });

  it('a player opens face → bust and closes bust → face in 0.7 of the time', () => {
    const m = { id: 1, tab: 'lineup' as const };
    const open = planFlights(r({ match: m }), r({ player: { team: 'fra', n: 10 }, under: m }));
    expect(open).toEqual([{ group: 'player:fra:10', from: 'face', to: 'bust', timing: 'player', direction: 'open' }]);
    const close = planFlights(r({ player: { team: 'fra', n: 10 }, under: m }), r({ match: m }));
    expect(close).toEqual([{ group: 'player:fra:10', from: 'bust', to: 'face', timing: 'player', durationScale: 0.7, direction: 'close' }]);
  });

  it('nothing flies on the first render or when the layout changes', () => {
    expect(planFlights(undefined, r({ match: { id: 1, tab: 'facts' } }))).toEqual([]);
    expect(planFlights(r({}, 'phone'), r({ match: { id: 1, tab: 'facts' } }, 'two'))).toEqual([]);
  });
});

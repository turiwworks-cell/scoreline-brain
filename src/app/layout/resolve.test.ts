import { describe, expect, it } from 'vitest';
import type { Nav } from '../nav/url';
import { layoutFor } from './layoutMode';
import { resolve, stackDepth, type Resolved } from './resolve';

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


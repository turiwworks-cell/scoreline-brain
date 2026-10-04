import { describe, expect, it } from 'vitest';
import { resolve } from '../layout/resolve';
import { parseNav } from './url';

describe('stepping to a team-mate', () => {
  it('reads the direction from history state, and only on a player', () => {
    expect(parseNav('/player/fra/10', '', { step: 1, under: { id: 1, tab: 'lineup' } })).toMatchObject({ player: { team: 'fra', n: 10 }, step: 1, under: { id: 1 } });
    expect(parseNav('/player/fra/10', '', { step: 7 }).step).toBeUndefined();
    expect(parseNav('/match/1/facts', '', { step: 1 }).step).toBeUndefined();
  });
  it('carries the direction through to what is on screen, so the page slides', () => {
    const b = resolve(parseNav('/player/fra/11', '', { step: -1 }), 'phone', {});
    expect(b.step).toBe(-1);
    expect(resolve(parseNav('/player/fra/10', ''), 'phone', {}).step).toBeUndefined();
  });
});

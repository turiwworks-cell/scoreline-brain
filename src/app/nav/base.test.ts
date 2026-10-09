import { describe, expect, it } from 'vitest';
import { appPathname } from './base';

describe('appPathname', () => {
  it('leaves a pathname alone at the site root', () => {
    expect(appPathname('/match/1/facts', undefined)).toBe('/match/1/facts');
    expect(appPathname('/', undefined)).toBe('/');
  });

  it('takes the folder off a pathname under it', () => {
    expect(appPathname('/scoreline/app/match/1/facts', '/scoreline/app')).toBe('/match/1/facts');
    expect(appPathname('/scoreline/app/', '/scoreline/app')).toBe('/');
    expect(appPathname('/scoreline/app', '/scoreline/app')).toBe('/');
  });

  it('keeps a pathname that only starts with the same letters', () => {
    expect(appPathname('/scoreline/apple/match/1', '/scoreline/app')).toBe('/scoreline/apple/match/1');
  });
});

import { expect, it } from 'vitest';
import { argb } from './color';

it('sets the opaque ARGB bytes without producing signed integers', () => {
  expect(argb('#123ABC')).toBe(0xff123abc);
  expect(argb('#000000')).toBe(0xff000000);
  expect(argb('#ffffff')).toBe(0xffffffff);
  expect(() => argb('red')).toThrow('hex');
  expect(() => argb('#fff')).toThrow('hex');
});

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { KitDisc, PhotoTile, PlayerPhoto } from './PlayerPhoto';

afterEach(cleanup);

const arg = { id: 'arg', colors: ['#74ACDF', '#F6B40E'] as const };

test('without a photo, the shirt number on a kit disc stands in, centred 0.42 w above the bottom', () => {
  const { container } = render(<PlayerPhoto team={arg} n={10} width={50} />);
  const box = container.firstElementChild as HTMLElement;
  expect(box.dataset.photo).toBe('kit');
  const disc = box.querySelector('svg')!;
  // radius 0.34 w: diameter 34, top-left at (0.16 w, 0.24 w)
  expect(disc.getAttribute('width')).toBe('34');
  expect(disc.style.left).toBe('8px');
  expect(disc.style.top).toBe('12px');
  expect(disc.textContent).toBe('10');
});

test('the kit disc: a dark disc tinted 20 % toward c1, a pastel ring, the number', () => {
  const { container } = render(<KitDisc team={arg} n={7} size={38} />);
  const [fill, ring] = [...container.querySelectorAll('circle')];
  expect(fill!.getAttribute('fill')).toBe('#28333D');
  expect(ring!.getAttribute('r')).toBe('18.1');
  // ring width clamp(rad × 0.075, 1.4, 3)
  expect(ring!.getAttribute('stroke-width')).toBe('1.425');
});

test('no player known: the crest stands in', () => {
  const { container } = render(<PlayerPhoto team={arg} n={0} width={52} src="/x.avif" />);
  expect((container.firstElementChild as HTMLElement).dataset.photo).toBe('crest');
  expect(container.querySelector('[data-crest="arg"]')).toBeTruthy();
});

test('a photo is the face crop of the bust, standing on the bottom; a failed load falls back', () => {
  const { container, rerender } = render(<PlayerPhoto team={arg} n={10} width={84} src="/a.avif" alt="Messi" />);
  const img = container.querySelector('img')!;
  // k = w / 168: the bust is 288 × 360 units, shifted by the face crop's (60, 8)
  expect([img.getAttribute('width'), img.getAttribute('height')]).toEqual(['144', '180']);
  expect([img.style.left, img.style.top]).toEqual(['-30px', '-4px']);
  const crop = img.parentElement!;
  expect(crop.style.top).toBe(`${84 - 154 * 0.5}px`);
  expect(crop.style.height).toBe('99px');
  fireEvent.error(img);
  expect(container.querySelector('img')).toBeNull();
  expect((container.firstElementChild as HTMLElement).dataset.photo).toBe('kit');
  // a new src tries again
  rerender(<PlayerPhoto team={arg} n={10} width={84} src="/b.avif" alt="Messi" />);
  expect(container.querySelector('img')).toBeTruthy();
});

test('with sources, the bust is a <picture>: AVIF ahead of WebP, each sized to the drawn width', () => {
  const sources = [{ type: 'image/avif', srcSet: '/a@1x.avif 288w, /a@2x.avif 576w' }];
  const { container } = render(<PlayerPhoto team={arg} n={10} width={84} src="/a@1x.webp" srcSet="/a@1x.webp 288w, /a@2x.webp 576w" sources={sources} />);
  const picture = container.querySelector('picture')!;
  const source = picture.querySelector('source')!;
  expect(source.getAttribute('type')).toBe('image/avif');
  expect(source.getAttribute('sizes')).toBe('144px');
  const img = picture.querySelector('img')!;
  expect(img.getAttribute('sizes')).toBe('144px');
  expect(img.getAttribute('src')).toBe('/a@1x.webp');
  fireEvent.error(img);
  expect(container.querySelector('picture')).toBeNull();
});

test('the tile is a glass pane of radius 0.3 s, lit from below in the team colour', () => {
  const { container } = render(<PhotoTile team={arg} n={10} size={52} />);
  const tile = container.firstElementChild as HTMLElement;
  expect(tile.classList.contains('m-glass')).toBe(true);
  expect(tile.style.borderRadius).toBe('15.6px');
  expect(tile.querySelector('[aria-hidden="true"]')!.getAttribute('style')).toContain('radial-gradient');
});

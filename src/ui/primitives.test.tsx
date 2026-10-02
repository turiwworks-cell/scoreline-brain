import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { TEAMS } from '../data/demo/data';
import { luma, mix, pastel } from './color';
import { Crest } from './Crest';
import { defaultFlag, flagOf, FLAGS } from './flags';
import { Icon } from './Icon';
import { ICON_NAMES, TAG_KINDS, UNIT_PATHS, iconId, tagId } from './icons';
import { IconSprite } from './IconSprite';
import { ratingTone } from './rating';
import { RatingBadge } from './RatingBadge';
import { tagLayout, tagList } from './tagLayout';
import { EventTags, Tag } from './Tags';

afterEach(cleanup);

const points = (d: string) => d.match(/[ML]/g)?.length ?? 0;

describe('icon sprite', () => {
  test('has a symbol for every icon and every tag, and <Icon>/<Tag> point at them', () => {
    const { container } = render(
      <>
        <IconSprite />
        <Icon name="back" />
        <Tag kind="goal" />
      </>,
    );
    for (const n of ICON_NAMES) expect(container.querySelector(`symbol#${iconId(n)}`), n).toBeTruthy();
    for (const k of TAG_KINDS) expect(container.querySelector(`symbol#${tagId(k)}`), k).toBeTruthy();
    const hrefs = [...container.querySelectorAll('use')].map((u) => u.getAttribute('href'));
    expect(hrefs).toEqual([`#${iconId('back')}`, `#${tagId('goal')}`]);
  });

  test('icons draw at the Lua size, scaled by k, with its stroke unless overridden', () => {
    const { container } = render(<Icon name="back" scale={2} stroke={2.2} />);
    const svg = container.querySelector('svg')!;
    expect([svg.getAttribute('width'), svg.getAttribute('height')]).toEqual(['18', '32']);
    expect(svg.style.getPropertyValue('--icon-sw')).toBe('2.2');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  test('generated glyphs: 10-point star, pentagon, 6-point pentagram, 5 seams', () => {
    expect(points(UNIT_PATHS.star)).toBe(10);
    expect(points(UNIT_PATHS.pent)).toBe(5);
    expect(points(UNIT_PATHS.p5)).toBe(6);
    expect(UNIT_PATHS.seams.match(/M/g)).toHaveLength(5);
    // the star's tip is straight up, radius 1
    expect(UNIT_PATHS.star.startsWith('M 0 -1')).toBe(true);
  });
});

describe('colour maths', () => {
  test('mix rounds each channel like the Lua', () => {
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mix('#151515', '#74ACDF', 0.2)).toBe('#28333D');
  });
  test('pastel lightens until black text passes comfortably', () => {
    for (const t of TEAMS) expect(luma(pastel(`#${t.c1.toString(16).padStart(6, '0')}`))).toBeGreaterThanOrEqual(0.36);
    // already light enough after the first step: one 22 % mix
    expect(pastel('#FFDF00')).toBe(mix('#FFDF00', '#F7F2EA', 0.22));
  });
});

describe('Crest', () => {
  const team = (id: string, flag?: (string | number)[][]) => ({ id, colors: ['#111111', '#EEEEEE'] as const, ...(flag ? { flag } : {}) });

  test('every demo team has a built-in flag', () => {
    for (const t of TEAMS) expect(FLAGS[t.id], t.id).toBeTruthy();
  });

  test('a sent flag wins, then the built-in one, then a c1 disc ringed in c2', () => {
    const sent = [['h', '#6CABDD', '#FFFFFF']];
    expect(flagOf(team('fra', sent))).toBe(sent);
    expect(flagOf(team('fra'))).toBe(FLAGS.fra);
    expect(flagOf(team('xyz'))).toEqual(defaultFlag('#111111', '#EEEEEE'));
    expect(flagOf(team('fra', []))).toBe(FLAGS.fra);
  });

  test('draws stripes overlapping by 0.4, clipped to a circle', () => {
    const { container } = render(<Crest team={team('ger')} size={20} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 30 30');
    expect(svg.getAttribute('width')).toBe('20');
    const rects = [...svg.querySelectorAll('rect')];
    expect(rects.map((r) => [r.getAttribute('y'), r.getAttribute('height'), r.getAttribute('fill')])).toEqual([
      ['0', '10.4', '#2A2A2A'],
      ['10', '10.4', '#DD0000'],
      ['20', '10.4', '#FFCE00'],
    ]);
    const clip = svg.querySelector('clipPath')!;
    expect(svg.querySelector('g')!.getAttribute('clip-path')).toBe(`url(#${clip.id})`);
  });

  test('reads every op of the grammar, takes numeric colours, and skips unknown ops', () => {
    const { container } = render(
      <Crest
        team={team('x', [
          ['r', 0, 0, 30, 30, 0x112233],
          ['c', 15, 15, 4, '#FFFFFF'],
          ['cs', 15, 15, 8, 2, '#00FF00'],
          ['s', 15, 15, 3, '#FF0000'],
          ['d', '#0000FF'],
          ['zz', 1, 2],
        ])}
      />,
    );
    const g = container.querySelector('g')!;
    expect(g.children).toHaveLength(5);
    expect(g.querySelector('rect')!.getAttribute('fill')).toBe('#112233');
    expect(g.querySelectorAll('circle')[1]!.getAttribute('stroke-width')).toBe('2');
  });

  test('crests on one page get distinct clip ids', () => {
    const { container } = render(
      <>
        <Crest team={team('fra')} />
        <Crest team={team('arg')} />
      </>,
    );
    const ids = [...container.querySelectorAll('clipPath')].map((c) => c.id);
    expect(new Set(ids).size).toBe(2);
  });
});

describe('tags', () => {
  test('order and caps: up to 3 balls, up to 3 boots, a yellow, a red', () => {
    expect(tagList({ goals: 5, assists: 1, yellow: 2, red: true })).toEqual(['goal', 'goal', 'goal', 'assist', 'yellow', 'red']);
    expect(tagList({})).toEqual([]);
  });

  test('repeats stack R × 1.15 apart, different kinds sit 2R + 3 apart', () => {
    const { xs, width } = tagLayout(['goal', 'goal', 'assist'], 7);
    expect(xs[0]).toBe(7);
    expect(xs[1]).toBeCloseTo(7 + 8.05);
    expect(xs[2]).toBeCloseTo(7 + 8.05 + 17);
    expect(width).toBeCloseTo(8.05 + 17 + 14);
  });

  test('a shade only where a tag lies on the next one', () => {
    const { container } = render(<EventTags goals={2} yellow />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-label')).toBe('2 goals, yellow card');
    // two balls overlap (one shade); the ball and the card don't
    expect(svg.querySelectorAll('g[clip-path]')).toHaveLength(1);
    // drawn last to first, so the first ball is on top
    expect([...svg.querySelectorAll('use')].map((u) => u.getAttribute('href'))).toEqual([`#${tagId('yellow')}`, `#${tagId('goal')}`, `#${tagId('goal')}`]);
  });

  test('nothing to show renders nothing', () => {
    const { container } = render(<EventTags goals={0} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('RatingBadge', () => {
  test('colours by band, the spectrum at 8 and above', () => {
    expect(ratingTone(8)).toEqual({ bg: null, fg: 'rgb(0 0 0 / 0.86)' });
    expect(ratingTone(7.9).bg).toBe('#34E39A');
    expect(ratingTone(6.5).bg).toBe('#F5C542');
    expect(ratingTone(6).bg).toBe('#F28C3A');
    expect(ratingTone(5.9)).toEqual({ bg: '#FF4D4D', fg: '#FFFFFF' });
  });

  test('one decimal, height round(1.6 × size), a star for the best', () => {
    const { container } = render(<RatingBadge value={8.25} best size={12.5} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.textContent).toBe('8.3');
    expect(el.style.getPropertyValue('--h')).toBe('20px');
    expect(el.style.getPropertyValue('--bg')).toBe('var(--spectrum-3)');
    expect(el.querySelector('svg')).toBeTruthy();
    expect(el.getAttribute('aria-label')).toBe('Rating 8.3, best in the match');
  });
});

import { act, cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCROLL_SETTLE_MS, useScrollHover } from './useScrollHover';

function Page() {
  const ref = useRef<HTMLElement>(null);
  useScrollHover(ref);
  return <section ref={ref} data-testid="page" />;
}

const page = () => document.querySelector<HTMLElement>('[data-testid="page"]')!;
const fire = (type: 'wheel' | 'scroll') => act(() => void page().dispatchEvent(new Event(type)));
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const scrolling = () => page().hasAttribute('data-scrolling');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useScrollHover', () => {
  it('holds the hover while the wheel moves the page, and lets it go once the page is still', () => {
    render(<Page />);
    expect(scrolling()).toBe(false);
    fire('wheel');
    expect(scrolling()).toBe(true);
    advance(SCROLL_SETTLE_MS - 1);
    expect(scrolling()).toBe(true);
    advance(1);
    expect(scrolling()).toBe(false);
  });

  it('keeps holding while a wheeled page is still scrolling (a trackpad flick runs on)', () => {
    render(<Page />);
    fire('wheel');
    advance(SCROLL_SETTLE_MS - 10);
    fire('scroll');
    advance(SCROLL_SETTLE_MS - 10);
    expect(scrolling()).toBe(true);
    advance(10);
    expect(scrolling()).toBe(false);
  });

  it('leaves a scroll without a wheel alone (touch, scroll memory, focus)', () => {
    render(<Page />);
    fire('scroll');
    expect(scrolling()).toBe(false);
    // and a scroll after the hold has ended does not raise it again
    fire('wheel');
    advance(SCROLL_SETTLE_MS);
    fire('scroll');
    expect(scrolling()).toBe(false);
  });

  it('lets go when the page goes away mid-scroll', () => {
    const { unmount } = render(<Page />);
    const el = page();
    fire('wheel');
    unmount();
    expect(el.hasAttribute('data-scrolling')).toBe(false);
  });
});

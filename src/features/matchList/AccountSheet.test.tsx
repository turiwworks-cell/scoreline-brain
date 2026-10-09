import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { parseFeed } from '../../domain';
import { demoFeedJson } from '../../domain/testing/demo';
import { scorelineStore } from '../../store';
import { AccountSheet } from './AccountSheet';

beforeAll(() => {
  scorelineStore.getState().actions.applyFeed(parseFeed(demoFeedJson()), Date.now());
});
afterEach(cleanup);

describe('account sheet (drawSheet, luau:6680)', () => {
  it('is out of reach while closed', () => {
    render(<AccountSheet open={false} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { hidden: true });
    expect(dialog.getAttribute('aria-hidden')).toBe('true');
    expect(dialog.hasAttribute('inert')).toBe(true);
  });

  it('takes focus when it opens, gives it back when it closes, and closes on Escape', () => {
    const onClose = vi.fn();
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const view = render(<AccountSheet open={false} onClose={onClose} />);
    view.rerender(<AccountSheet open onClose={onClose} />);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    view.rerender(<AccountSheet open={false} onClose={onClose} />);
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('every button closes it: a prototype screen sends nothing', () => {
    const onClose = vi.fn();
    render(<AccountSheet open onClose={onClose} />);
    for (const name of ['Close', 'Continue with email', 'Continue with phone number', 'Not now']) fireEvent.click(screen.getByRole('button', { name }));
    expect(onClose).toHaveBeenCalledTimes(4);
  });

  it('wraps Tab at both ends and blocks outside controls', () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    const view = render(<AccountSheet open onClose={vi.fn()} />);
    const first = screen.getByRole('button', { name: 'Close' });
    // the last control is the way into the review page, a link: the wrap includes it
    const last = screen.getByRole('link', { name: 'Phone preview for review' });
    expect(last.getAttribute('href')).toBe('/review.html');
    first.focus();
    expect(fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })).toBe(false);
    expect(document.activeElement).toBe(last);
    expect(fireEvent.keyDown(last, { key: 'Tab' })).toBe(false);
    expect(document.activeElement).toBe(first);
    expect(outside.hasAttribute('inert')).toBe(true);
    view.unmount();
    expect(outside.hasAttribute('inert')).toBe(false);
    outside.remove();
  });

  it('blocks other panes, preserves existing guards, and restores the opener on reopen', () => {
    const onClose = vi.fn();
    const opener = document.createElement('button');
    const outside = document.createElement('button');
    const covered = document.createElement('section');
    covered.setAttribute('inert', '');
    document.body.append(opener, outside, covered);
    const view = render(<AccountSheet open={false} onClose={onClose} />);
    for (let i = 0; i < 2; i++) {
      opener.focus();
      view.rerender(<AccountSheet open onClose={onClose} />);
      expect(opener.hasAttribute('inert')).toBe(true);
      screen.getByRole('button', { name: 'Not now' }).focus();
      // jsdom does not enforce native inert. Simulate the previously escaped focus and prove
      // dismissal still restores Menu; the browser test verifies inert prevents escape.
      outside.focus();
      expect(document.activeElement).toBe(outside);
      view.rerender(<AccountSheet open={false} onClose={onClose} />);
      expect(opener.hasAttribute('inert')).toBe(false);
      expect(document.activeElement).toBe(opener);
      expect(covered.hasAttribute('inert')).toBe(true);
    }
    view.unmount();
    opener.remove();
    outside.remove();
    covered.remove();
  });

  it('paints seven bars in tonight’s match colours', () => {
    const view = render(<AccountSheet open onClose={vi.fn()} />);
    const bars = view.container.querySelectorAll('[aria-hidden="true"] > span');
    expect(bars.length).toBe(7);
    for (const b of bars) expect((b as HTMLElement).style.background).toContain('linear-gradient');
  });
});

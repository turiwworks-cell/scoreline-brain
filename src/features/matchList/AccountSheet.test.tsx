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

  it('paints seven bars in tonight’s match colours', () => {
    const view = render(<AccountSheet open onClose={vi.fn()} />);
    const bars = view.container.querySelectorAll('[aria-hidden="true"] > span');
    expect(bars.length).toBe(7);
    for (const b of bars) expect((b as HTMLElement).style.background).toContain('linear-gradient');
  });
});

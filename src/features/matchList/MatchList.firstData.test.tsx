import { act, cleanup, render } from '@testing-library/react';
import { Profiler } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseFeed } from '../../domain';
import { demoFeedJson } from '../../domain/testing/demo';
import { scorelineStore } from '../../store';
import { IconSprite } from '../../ui';
import { MatchList } from './MatchList';
import { createFollowPref } from './follow/pref';

/*
 * Part 21 (#5): the first feed reaches the header and the day tabs in the store's own render, in
 * the task that brought it; the body (the follow card and the groups) comes in a render of its own
 * after that, so the browser can paint and take input between the two.
 */

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
beforeEach(() => scorelineStore.setState(scorelineStore.getInitialState(), true));
afterEach(cleanup);

const memoryPref = () => {
  const store = new Map<string, string>();
  return createFollowPref({ team: 'arg', n: 10 }, { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) });
};

describe('the first feed', () => {
  it('is drawn in two commits: the tabs with the feed, the rows and the follow card after', () => {
    // what the DOM held at each commit of the list
    const commits: Array<{ tabs: string; rows: number; follow: boolean }> = [];
    const onRender = () =>
      commits.push({
        tabs: Array.from(document.querySelectorAll('[role="tab"]'), (t) => t.getAttribute('aria-label')).join('|'),
        rows: document.querySelectorAll('[data-focus-key^="match-"]').length,
        follow: document.querySelector('[data-focus-key^="follow-"]') !== null,
      });
    render(
      <Profiler id="list" onRender={onRender}>
        <IconSprite />
        <MatchList list={{ day: 0, live: false }} pref={memoryPref()} onDay={vi.fn()} onLive={vi.fn()} onOpenMatch={vi.fn()} onOpenPlayer={vi.fn()} />
      </Profiler>,
    );
    const before = commits.length;
    expect(commits.at(-1)).toMatchObject({ rows: 0, follow: false });
    const fallbackTabs = commits.at(-1)!.tabs;

    act(() => scorelineStore.getState().actions.applyFeed(parseFeed(demoFeedJson()), Date.now()));

    const after = commits.slice(before);
    // the store's render: the feed's days on the tabs, nothing of the body yet
    expect(after[0]!.tabs).not.toBe(fallbackTabs);
    expect(after[0]).toMatchObject({ rows: 0, follow: false });
    // then the body, in a commit of its own
    const body = after.findIndex((c) => c.rows > 0);
    expect(body).toBeGreaterThan(0);
    expect(after[body]!.follow).toBe(true);
    expect(after.at(-1)!.rows).toBe(document.querySelectorAll('[data-focus-key^="match-"]').length);
  });
});

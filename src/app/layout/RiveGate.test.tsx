import { act, cleanup, render } from '@testing-library/react';
import { memo } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseFeed } from '../../domain';
import { demoFeedJson } from '../../domain/testing/demo';
import { useRiveStart } from '../../rive/startGate';
import { scorelineStore } from '../../store';
import { RiveGate } from './RiveGate';

const preload = vi.hoisted(() => vi.fn(() => () => {}));
vi.mock('../../rive/preload', () => ({ preloadRive: preload }));

const renders = { child: vi.fn(), reader: vi.fn() };
const Child = memo(function Child() {
  renders.child();
  return null;
});
function Reader() {
  renders.reader();
  return <output data-testid="gate">{String(useRiveStart())}</output>;
}
const gate = () => document.querySelector('[data-testid="gate"]')!.textContent;
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] });
  renders.child.mockClear();
  renders.reader.mockClear();
  preload.mockClear();
  scorelineStore.setState(scorelineStore.getInitialState(), true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('RiveGate', () => {
  it('opens after the first data has painted, for the readers of the gate and nobody else', () => {
    // an element made once, as the shell's children are when only the gate's own state changes
    const children = (
      <>
        <Child />
        <Reader />
      </>
    );
    const view = render(<RiveGate waitForData>{children}</RiveGate>);
    expect(gate()).toBe('false');
    expect(preload).not.toHaveBeenCalled();
    const before = { child: renders.child.mock.calls.length, reader: renders.reader.mock.calls.length };

    act(() => scorelineStore.getState().actions.applyFeed(parseFeed(demoFeedJson()), Date.now()));
    advance(100);

    expect(gate()).toBe('true');
    // the reader saw it; the unrelated child was not rendered again by the gate opening
    expect(renders.reader.mock.calls.length).toBeGreaterThan(before.reader);
    expect(renders.child.mock.calls.length).toBe(before.child);
    // and Rive is warmed only now, with the demo's live match
    expect(preload).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('opens without data after the wait, and leaves nothing scheduled behind', () => {
    const view = render(
      <RiveGate waitForData>
        <Reader />
      </RiveGate>,
    );
    advance(3000);
    expect(gate()).toBe('false');
    advance(1200);
    expect(gate()).toBe('true');
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('with no data on its way, opens once the first frame has painted, without the wait', () => {
    const view = render(
      <RiveGate waitForData={false}>
        <Reader />
      </RiveGate>,
    );
    expect(gate()).toBe('false');
    expect(preload).not.toHaveBeenCalled();
    advance(100);
    expect(gate()).toBe('true');
    // no live match: the Live icon's artwork only
    expect(preload).toHaveBeenCalledWith(false);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a page with ?demo=off has no data on its way (with no source named, the demo plays)', () => {
    window.history.replaceState(null, '', '/?demo=off');
    const view = render(
      <RiveGate>
        <Reader />
      </RiveGate>,
    );
    advance(100);
    expect(gate()).toBe('true');
    view.unmount();
    window.history.replaceState(null, '', '/');
  });
});

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RIVE_MAX_WAIT_MS, RiveStartContext, useRiveStart, useRiveStartAfter } from './startGate';

function Probe({ data, wait }: { data: boolean; wait?: number }) {
  const open = useRiveStartAfter(data, wait);
  return <output data-testid="gate">{String(open)}</output>;
}
const gate = () => document.querySelector('[data-testid="gate"]')!.textContent;
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('when Rive may start', () => {
  it('not while there is no data, however long the first moments take', () => {
    render(<Probe data={false} />);
    advance(RIVE_MAX_WAIT_MS - 100);
    expect(gate()).toBe('false');
  });

  it('after the first data has been drawn, the paint that shows it and an idle slot: not in the same task', () => {
    render(<Probe data={true} />);
    expect(gate()).toBe('false');
    advance(16);
    expect(gate()).toBe('false');
    advance(40);
    expect(gate()).toBe('true');
  });

  it('data that arrives while waiting starts it from then, not at the wait’s end', () => {
    const view = render(<Probe data={false} />);
    advance(1500);
    view.rerender(<Probe data={true} />);
    advance(60);
    expect(gate()).toBe('true');
    // and the wait that was running is gone
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a feed that never comes does not keep it away for good', () => {
    render(<Probe data={false} wait={1000} />);
    advance(999);
    expect(gate()).toBe('false');
    advance(10);
    // the wait is up; the page still has to be painted and idle
    expect(gate()).toBe('false');
    advance(60);
    expect(gate()).toBe('true');
  });

  it('stays open once open, whatever the data does', () => {
    const view = render(<Probe data={true} />);
    advance(100);
    expect(gate()).toBe('true');
    view.rerender(<Probe data={false} />);
    advance(RIVE_MAX_WAIT_MS * 2);
    expect(gate()).toBe('true');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves nothing scheduled when the page goes away first', () => {
    const view = render(<Probe data={true} />);
    advance(16);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
    const late = render(<Probe data={false} />);
    late.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('is open outside the shell, where there is nothing to wait for', () => {
    function Reader() {
      return <output data-testid="gate">{String(useRiveStart())}</output>;
    }
    const alone = render(<Reader />);
    expect(gate()).toBe('true');
    alone.unmount();
    render(
      <RiveStartContext.Provider value={false}>
        <Reader />
      </RiveStartContext.Provider>,
    );
    expect(gate()).toBe('false');
  });
});

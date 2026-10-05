import { act, cleanup, render } from '@testing-library/react';
import { AnimatePresence, m } from 'motion/react';
import { useEffect, useState } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Screen } from './Screen';

/*
 * Issue #11: content that mounts inside a screen after its first frame (a tab, "Show all", details
 * that a real ApiSource brings after the match has opened) must play its entrance, even though the
 * screen itself sits in an AnimatePresence initial={false} and showed at once.
 */

const handle = { addLate: () => {} };
function Content() {
  const [late, setLate] = useState(false);
  useEffect(() => {
    handle.addLate = () => setLate(true);
  });
  return (
    <>
      <m.div data-testid="first" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
      {late && <m.div data-testid="late" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />}
    </>
  );
}

beforeEach(() => vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('a screen shown at once', () => {
  it('shows its first render at rest, and lets what mounts later start from its initial', () => {
    const view = render(
      <MemoryRouter>
        <AnimatePresence initial={false}>
          <Screen key="match" pane="match" contentKey="1" label="Match">
            <Content />
          </Screen>
        </AnimatePresence>
      </MemoryRouter>,
    );
    // the first render skips its entrance: the Lua opens a screen already there
    expect(view.getByTestId('first').style.opacity).toBe('1');
    // a frame later something arrives (a tab's body, details from the source)
    act(() => void vi.advanceTimersByTime(20));
    act(() => handle.addLate());
    expect(view.getByTestId('late').style.opacity).toBe('0');
  });
});

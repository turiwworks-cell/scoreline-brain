import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { Button } from './Button';
import { Glass } from './Glass';
import { spotRadius } from './feel';
import { Tabs } from './Tabs';

afterEach(cleanup);

describe('feel', () => {
  test('spot radius follows spotR: 0.42 of the long side, clamped to 26..78', () => {
    expect(spotRadius(40, 40)).toBe(26);
    expect(spotRadius(120, 36)).toBeCloseTo(50.4);
    expect(spotRadius(354, 160)).toBe(78);
  });

  test('pointer moves write --mx / --my to the element without re-rendering', () => {
    let renders = 0;
    function Probe() {
      renders++;
      return <Button label="Go" />;
    }
    render(<Probe />);
    const btn = screen.getByRole('button', { name: 'Go' });
    btn.getBoundingClientRect = () => ({ left: 10, top: 20, width: 100, height: 36, right: 110, bottom: 56, x: 10, y: 20, toJSON() {} });
    fireEvent.pointerEnter(btn, { clientX: 30, clientY: 30 });
    fireEvent.pointerMove(btn, { clientX: 60, clientY: 40 });
    expect(btn.style.getPropertyValue('--mx')).toBe('50px');
    expect(btn.style.getPropertyValue('--my')).toBe('20px');
    expect(renders).toBe(1);
  });

  test('a press sets data-pressed and starts the letter roll', () => {
    render(<Button label="Go" />);
    const btn = screen.getByRole('button', { name: 'Go' });
    fireEvent.pointerDown(btn, { button: 0, clientX: 1, clientY: 1 });
    expect(btn.hasAttribute('data-pressed')).toBe(true);
    expect(btn.querySelector('[data-roll]')?.hasAttribute('data-rolling')).toBe(true);
  });
});

describe('Tabs', () => {
  const items = [
    { id: 'a', label: 'Facts' },
    { id: 'b', label: 'Stats' },
  ];
  test('marks the chosen tab and moves with the arrow keys', () => {
    const onChange = vi.fn();
    render(<Tabs aria-label="Match" items={items} value="a" onChange={onChange} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(tabs[1]?.tabIndex).toBe(-1);
    fireEvent.keyDown(tabs[0]!, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('b');
    fireEvent.click(tabs[1]!);
    expect(onChange).toHaveBeenLastCalledWith('b');
  });
});

describe('nested controls', () => {
  test('a press on a button inside a lit pane dips only the button', () => {
    render(
      <Glass lit data-testid="card">
        <Button label="One" />
        <Button label="Two" />
      </Glass>,
    );
    const card = screen.getByTestId('card');
    const one = screen.getByRole('button', { name: 'One' });
    fireEvent.pointerDown(one, { button: 0, clientX: 1, clientY: 1 });
    expect(one.hasAttribute('data-pressed')).toBe(true);
    expect(card.hasAttribute('data-pressed')).toBe(false);
    const rolling = Array.from(card.querySelectorAll('[data-roll]')).map((l) => l.hasAttribute('data-rolling'));
    expect(rolling).toEqual([true, false]);
  });

  test('a press on the pane itself does not roll the buttons inside it', () => {
    render(
      <Glass lit data-testid="card">
        <Button label="One" />
      </Glass>,
    );
    const card = screen.getByTestId('card');
    fireEvent.pointerDown(card, { button: 0, clientX: 1, clientY: 1 });
    expect(card.hasAttribute('data-pressed')).toBe(true);
    expect(card.querySelector('[data-roll]')?.hasAttribute('data-rolling')).toBe(false);
  });

  test('a key on a nested button does not press the pane', () => {
    render(
      <Glass lit data-testid="card">
        <Button label="One" />
      </Glass>,
    );
    fireEvent.keyDown(screen.getByRole('button', { name: 'One' }), { key: ' ' });
    expect(screen.getByTestId('card').hasAttribute('data-pressed')).toBe(false);
  });
});

describe('handlers passed by the caller', () => {
  test('run alongside the built-in feel instead of replacing it', () => {
    const onPointerDown = vi.fn();
    const onKeyDown = vi.fn();
    render(<Button label="Go" onPointerDown={onPointerDown} onKeyDown={onKeyDown} />);
    const btn = screen.getByRole('button', { name: 'Go' });
    fireEvent.pointerDown(btn, { button: 0, clientX: 1, clientY: 1 });
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(btn.hasAttribute('data-pressed')).toBe(true);
    fireEvent.keyDown(btn, { key: 'Enter' });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  test('also on a lit Glass', () => {
    const onPointerMove = vi.fn();
    render(<Glass lit data-testid="card" onPointerMove={onPointerMove} />);
    const card = screen.getByTestId('card');
    fireEvent.pointerMove(card, { clientX: 5, clientY: 6 });
    expect(onPointerMove).toHaveBeenCalledTimes(1);
    expect(card.style.getPropertyValue('--mx')).not.toBe('');
  });
});

describe('a control cannot stay pressed', () => {
  const dipEnd = (el: HTMLElement) => {
    const ev = new Event('transitionend');
    Object.defineProperty(ev, 'propertyName', { value: '--dip' });
    el.dispatchEvent(ev);
  };

  afterEach(() => vi.useRealTimers());

  test('release clears the press at once when the dip has finished', () => {
    render(<Button label="Go" />);
    const btn = screen.getByRole('button', { name: 'Go' });
    fireEvent.pointerDown(btn, { button: 0, clientX: 1, clientY: 1 });
    dipEnd(btn);
    expect(btn.hasAttribute('data-pressed')).toBe(true);
    fireEvent.pointerUp(window);
    expect(btn.hasAttribute('data-pressed')).toBe(false);
  });

  test('a quick tap waits for the dip, and the timer clears it if transitionend never comes', () => {
    vi.useFakeTimers();
    render(<Button label="Go" />);
    const btn = screen.getByRole('button', { name: 'Go' });
    btn.style.setProperty('--dur-press', '120ms');
    fireEvent.pointerDown(btn, { button: 0, clientX: 1, clientY: 1 });
    fireEvent.pointerUp(window);
    expect(btn.hasAttribute('data-pressed')).toBe(true); // the whole dip still shows
    vi.advanceTimersByTime(119);
    expect(btn.hasAttribute('data-pressed')).toBe(true);
    vi.advanceTimersByTime(200);
    expect(btn.hasAttribute('data-pressed')).toBe(false);
  });

  test('a late transitionend after the timer is harmless', () => {
    vi.useFakeTimers();
    render(<Button label="Go" />);
    const btn = screen.getByRole('button', { name: 'Go' });
    fireEvent.pointerDown(btn, { button: 0, clientX: 1, clientY: 1 });
    fireEvent.pointerUp(window);
    vi.advanceTimersByTime(1000);
    dipEnd(btn);
    expect(btn.hasAttribute('data-pressed')).toBe(false);
  });

  test('a press that is still held is not cut short', () => {
    vi.useFakeTimers();
    render(<Button label="Go" />);
    const btn = screen.getByRole('button', { name: 'Go' });
    fireEvent.pointerDown(btn, { button: 0, clientX: 1, clientY: 1 });
    vi.advanceTimersByTime(60_000);
    expect(btn.hasAttribute('data-pressed')).toBe(true);
    fireEvent.pointerUp(window);
    vi.advanceTimersByTime(1000);
    expect(btn.hasAttribute('data-pressed')).toBe(false);
  });

  test('a cancelled pointer and a lost window focus also release', () => {
    vi.useFakeTimers();
    render(<Button label="Go" />);
    const btn = screen.getByRole('button', { name: 'Go' });
    fireEvent.pointerDown(btn, { button: 0, clientX: 1, clientY: 1 });
    fireEvent.pointerCancel(window);
    vi.advanceTimersByTime(1000);
    expect(btn.hasAttribute('data-pressed')).toBe(false);
    fireEvent.pointerDown(btn, { button: 0, clientX: 1, clientY: 1 });
    fireEvent.blur(window);
    vi.advanceTimersByTime(1000);
    expect(btn.hasAttribute('data-pressed')).toBe(false);
  });

  test('an element removed mid-press leaves nothing running', () => {
    vi.useFakeTimers();
    const { unmount } = render(<Button label="Go" />);
    const btn = screen.getByRole('button', { name: 'Go' });
    fireEvent.pointerDown(btn, { button: 0, clientX: 1, clientY: 1 });
    unmount();
    fireEvent.pointerUp(window);
    expect(() => vi.runAllTimers()).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('Tabs indicator and fonts', () => {
  afterEach(() => {
    Reflect.deleteProperty(document, 'fonts');
    vi.restoreAllMocks();
  });

  test('is placed again once the font has loaded', async () => {
    let ready!: () => void;
    const fontsReady = new Promise<void>((r) => (ready = r));
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: fontsReady, addEventListener: vi.fn(), removeEventListener: vi.fn() },
    });
    let width = 60; // the fallback face
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(() => width);
    const items = [
      { id: 'a', label: 'Sat 19' },
      { id: 'b', label: 'Today' },
    ];
    render(<Tabs aria-label="Day" variant="day" items={items} value="a" onChange={() => {}} />);
    const ind = document.querySelector<HTMLElement>('[aria-hidden="true"]')!;
    const first = ind.style.transform;
    expect(first).toContain(`scaleX(${(60 - 26) / 100})`);
    width = 80; // Hanken Grotesk arrives
    ready();
    await fontsReady;
    await Promise.resolve();
    expect(ind.style.transform).toContain(`scaleX(${(80 - 26) / 100})`);
    expect(ind.style.transform).not.toBe(first);
  });

  test('an inline items array does not re-run placement on every render', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(50);
    const { rerender } = render(<Tabs aria-label="T" items={[{ id: 'a', label: 'A' }]} value="a" onChange={() => {}} />);
    const calls = spy.mock.calls.length;
    rerender(<Tabs aria-label="T" items={[{ id: 'a', label: 'A' }]} value="a" onChange={() => {}} />);
    expect(spy.mock.calls.length).toBe(calls);
  });
});

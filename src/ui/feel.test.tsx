import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { Button } from './Button';
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

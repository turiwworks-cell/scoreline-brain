import { describe, expect, it } from 'vitest';
import { CARD_H, cardGap, cardHeight, cardMetrics, fitSize, minuteSize, nameChoice, targetWidth } from './cardLayout';

describe('live card layout', () => {
  it('grows from 128 px at kick-off to 244 px at 90 minutes', () => {
    expect(cardHeight(0)).toBe(CARD_H.min);
    expect(cardHeight(45)).toBe(186);
    expect(cardHeight(90)).toBe(CARD_H.max);
    expect(cardHeight(120)).toBe(CARD_H.max);
  });

  it('five cards share the strip, four px apart', () => {
    expect(targetWidth(5)).toBe(70);
    expect(targetWidth(1)).toBe(366);
    expect(targetWidth(0)).toBe(0);
  });

  it('metrics follow the card’s width and stop at the Lua’s limits', () => {
    const narrow = cardMetrics(40);
    expect(narrow.s).toBe(0);
    expect(narrow.pad).toBe(8);
    expect(narrow.crest).toBeCloseTo(14, 5);
    expect(narrow.name).toBe(10.5);
    const wide = cardMetrics(366);
    expect(wide.s).toBe(1);
    expect(wide.pad).toBe(14);
    expect(wide.crest).toBe(24);
    expect(wide.name).toBe(15);
    expect(wide.minute).toBe(58);
    const five = cardMetrics(70);
    expect(five.crest).toBeCloseTo(14, 5);
    expect(five.score).toBeCloseTo(13, 5);
  });

  it('the gap closes as a card folds away', () => {
    expect(cardGap(100)).toBe(4);
    expect(cardGap(12)).toBe(2);
    expect(cardGap(0)).toBe(0);
  });

  it('fits text by shrinking its size', () => {
    expect(fitSize(16, 100, 150)).toBe(16);
    expect(fitSize(16, 200, 100)).toBe(8);
    expect(fitSize(16, 0, 100)).toBe(16);
  });

  it('chooses the full name only when the card is wide enough and it fits', () => {
    const m = cardMetrics(366);
    expect(nameChoice(366, m, { score: 14, name: 60, nameDrawn: 62, short: 30 })).toBe('name');
    expect(nameChoice(366, m, { score: 14, name: 400, nameDrawn: 402, short: 30 })).toBe('short');
    const five = cardMetrics(70);
    expect(nameChoice(70, five, { score: 8, name: 30, nameDrawn: 31, short: 20 })).toBe('short');
    expect(nameChoice(70, five, { score: 8, name: 100, nameDrawn: 101, short: 100 })).toBe('none');
  });

  it('the minute shrinks to the card’s width less its padding', () => {
    const m = cardMetrics(70);
    expect(minuteSize(m, 70, 30)).toBe(m.minute);
    expect(minuteSize(m, 70, 100)).toBeCloseTo((m.minute * (70 - 2 * m.pad - 8)) / 100, 5);
  });
});

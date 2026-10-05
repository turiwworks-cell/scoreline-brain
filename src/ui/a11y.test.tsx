import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { RatingBadge } from './RatingBadge';
import { SubOffTag } from './Tags';

afterEach(cleanup);

test('the rating badge and the off capsule are announced by their labels', () => {
  render(
    <>
      <RatingBadge value={7.25} best />
      <SubOffTag minute={72} />
    </>,
  );
  expect(screen.getByRole('img', { name: 'Rating 7.3, best in the match' })).toBeTruthy();
  expect(screen.getByRole('img', { name: "Off 72'" })).toBeTruthy();
});

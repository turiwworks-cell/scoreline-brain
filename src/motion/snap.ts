import type { TransformTemplate } from 'motion/react';

/*
 * Slides that land on whole device pixels. An eased slide spends its last frames a hair away from
 * rest (translateY(0.0001px)), and the browser rounds what it draws under a fractional translation
 * its own way: crests, text and edges each to their nearest pixel. When the transform clears they
 * round again from where they really are, and the block settles by a pixel, a crest one way and
 * its name another. Snapped, every frame is a whole-pixel shift of the settled block, the tail is
 * already at rest, and nothing moves when the slide ends. CSS round() does the rounding, so a share
 * of the element (a layer's 100 % in, the list's 22 % aside) is rounded against its own box.
 */

let rounds: boolean | undefined;

/**
 * A Motion `transformTemplate` that puts a slide's `x` and `y` (px, or % of the element) on whole
 * device pixels. For slides only: a scale or a rotation on the same element would be dropped.
 * Without CSS round() the browser keeps Motion's own transform.
 */
export const snapPx: TransformTemplate = ({ x = '0px', y = '0px' }, generated) => {
  rounds ??= window.CSS?.supports('top', 'round(1px,1px)');
  if (!rounds) return generated || 'none';
  if (!parseFloat(`${x}`) && !parseFloat(`${y}`)) return 'none';
  // round() rounds to the nearest by default
  const px = `${1 / devicePixelRatio}px`;
  return `translate(round(${x},${px}),round(${y},${px}))`;
};

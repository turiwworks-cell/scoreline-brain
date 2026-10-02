import type { HTMLAttributes, ReactNode } from 'react';
import type { SharedEnd } from './sharedIds';

export type SharedProps = Omit<HTMLAttributes<HTMLSpanElement>, 'id'> & {
  /** the shared name, from sharedIds.ts: the same at both ends */
  id: string;
  /** which end this is */
  end: SharedEnd;
  children: ReactNode;
};

/**
 * Marks one end of a shared element. Both ends stay mounted (the list never unmounts, panes sit
 * side by side), so nothing here animates by itself: when navigation opens or closes a screen,
 * the shell flies a copy between the two ends (flight.ts) and hides both meanwhile.
 *
 * Rules for the content (Parts 10–15):
 * - Style it with its own classes, not through a parent's selector: the copy that flies is
 *   drawn outside the parent. Inherited text styles (font, colour) are carried over.
 * - Keep it the same visual at both ends, at whatever size: the copy is scaled uniformly and
 *   cross-fades from one end's look to the other's.
 * - The wrapper is inline-block; pass a class to lay it out otherwise (never display: contents).
 */
export function Shared({ id, end, className, children, ...rest }: SharedProps) {
  return (
    <span data-shared={id} data-shared-end={end} className={className ? `m-shared ${className}` : 'm-shared'} {...rest}>
      {children}
    </span>
  );
}

import { useId } from 'react';
import { UNIT_PATHS } from './icons';

/* The follow star in the spectrum (gstar, luau:3120): STOPS[3] across the star's box. */
export function Star({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg className={className} viewBox="-1 -1 2 2" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} x1="-1" y1="0" x2="1" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6B58F5" />
          <stop offset="0.4" stopColor="#A58FE6" />
          <stop offset="0.76" stopColor="#E7C1D6" />
          <stop offset="1" stopColor="#FFF0E6" />
        </linearGradient>
      </defs>
      <path d={UNIT_PATHS.star} fill={`url(#${id})`} />
    </svg>
  );
}

import { useMemo, type CSSProperties } from 'react';
import { softLightGradient, type SoftLightSpec } from './softLightGradient';

/*
 * A soft light drawn inside its box (the box clips it, like the Lua's clipRect).
 * Place it absolutely in a positioned parent; it never takes pointer events.
 */
export function SoftLight({ className, style, ...spec }: SoftLightSpec & { className?: string; style?: CSSProperties }) {
  const { color, alpha, cx, cy, rx, ry } = spec;
  const backgroundImage = useMemo(() => softLightGradient({ color, alpha, cx, cy, rx, ry }), [color, alpha, cx, cy, rx, ry]);
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', backgroundImage, ...style }}
    />
  );
}

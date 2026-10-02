import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { feel } from './feel';

/*
 * A glass pane (glass(), luau:3304): dark pane, sheen, 1 px rim brighter at the bottom.
 * With `lit`, the pane is a hover target and shows the hover light under the cursor.
 */
export type GlassProps = HTMLAttributes<HTMLDivElement> & {
  /** corner radius in px (the Lua's rad); defaults to 16 */
  radius?: number;
  /** thinner pane for use over pictures (body 0.7 instead of 0.96) */
  thin?: boolean;
  /** pane colour instead of the dark glass, e.g. a team tint */
  tint?: string;
  /** shows the hover light */
  lit?: boolean;
  children?: ReactNode;
};

export function Glass({ radius, thin, tint, lit, className, style, children, ...rest }: GlassProps) {
  const cls = ['m-glass', thin && 'm-glass-thin', lit && 'm-feel', className].filter(Boolean).join(' ');
  const st: CSSProperties = { ...style };
  if (radius !== undefined) st.borderRadius = radius;
  if (tint) (st as Record<string, string>)['--glass-tint'] = tint;
  return (
    <div className={cls} style={st} {...(lit ? feel : null)} {...rest}>
      {children}
    </div>
  );
}

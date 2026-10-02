import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Pill.module.css';

/*
 * A pill: a small glass capsule holding a label, with an optional tag in front.
 * Sizes are the Lua's capsules:
 *   label  24 px, uppercase tracked label, muted (Kick-off / Half-time, luau:5159)
 *   sm     24 px, S 11.5 (goal minute next to the ball, luau:4361)
 *   md     28 px, M 12.5 (player tags, luau:6081)
 *   lg     30 px, S 12.5 (On / Off, luau:6117)
 * Tones: glass (default), live (the Live toggle's green, luau:4632), spectrum (the
 * chosen segment, luau:6803).
 */
export type PillProps = HTMLAttributes<HTMLSpanElement> & {
  size?: 'label' | 'sm' | 'md' | 'lg';
  tone?: 'glass' | 'live' | 'spectrum';
  /** thinner glass for use over pictures */
  thin?: boolean;
  /** a tag or dot drawn before the label */
  icon?: ReactNode;
  children: ReactNode;
};

export function Pill({ size = 'md', tone = 'glass', thin, icon, className, children, ...rest }: PillProps) {
  const cls = [
    styles.pill,
    styles[size],
    tone === 'glass' ? 'm-glass' : styles[tone],
    tone === 'glass' && thin && 'm-glass-thin',
    icon != null && styles.withIcon,
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={cls} {...rest}>
      {icon != null && <span className={styles.icon}>{icon}</span>}
      <span className={styles.text}>{children}</span>
    </span>
  );
}

/* The live dot: 4.5 px radius; while not toggled on, a ring pulses out from it (luau:4636-4643). */
export function LiveDot({ pulse = false, ink = false }: { pulse?: boolean; ink?: boolean }) {
  return <span className={[styles.dot, pulse && styles.pulse, ink && styles.dotInk].filter(Boolean).join(' ')} aria-hidden="true" />;
}

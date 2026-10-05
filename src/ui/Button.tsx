import type { ButtonHTMLAttributes, CSSProperties, ReactNode, Ref } from 'react';
import { withFeel } from './feel';
import { RollLabel } from './RollLabel';
import styles from './Button.module.css';

/*
 * Every button is glass (luau:3381-3454): a soft white light under the cursor on
 * hover, a small dip when pressed, and its label rolls letter by letter when it is
 * clicked (never on hover).
 *
 *   <Button label="Show all 24 events" />              pill, 36 px (pillBtn)
 *   <RoundButton aria-label="Menu">{icon}</RoundButton>  40 px circle (roundBtn)
 */
export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label: string;
  /** px; the Lua's pill buttons are 36 */
  height?: number;
  minWidth?: number;
};

export function Button({ label, height, minWidth, className, style, type, ...rest }: ButtonProps) {
  const st: CSSProperties = { ...style };
  if (height !== undefined) (st as Record<string, string>)['--h'] = `${height}px`;
  if (minWidth !== undefined) st.minWidth = minWidth;
  return (
    <button type={type ?? 'button'} className={cx(styles.pill, className)} style={st} {...withFeel(rest)}>
      <RollLabel text={label} />
    </button>
  );
}

export type RoundButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  'aria-label': string;
  children: ReactNode;
  ref?: Ref<HTMLButtonElement>;
};

export function RoundButton({ className, children, type, ...rest }: RoundButtonProps) {
  return (
    <button type={type ?? 'button'} className={cx(styles.round, className)} {...withFeel(rest)}>
      {children}
    </button>
  );
}

function cx(base: string | undefined, extra?: string) {
  return `m-feel m-glass m-dip ${styles.button} ${base ?? ''}${extra ? ` ${extra}` : ''}`;
}

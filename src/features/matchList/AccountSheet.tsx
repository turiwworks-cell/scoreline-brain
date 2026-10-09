import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { feel, Icon, matchStops, RoundButton } from '../../ui';
import { useScoreline } from '../../store';
import { selectSheetPairs, selectTeams } from './selectors';
import styles from './AccountSheet.module.css';

/*
 * The account sheet (drawSheet, luau:6680–6758), opened by the list header's menu button. It rises
 * over the list (the whole screen on a phone, the list pane on desktop, as in the Lua's
 * drawDesktop): tonight's match colours as seven pastel bars, "Sign in to follow your clubs.",
 * two buttons and "Not now". A prototype screen: every button only closes it.
 *
 * Motion (luau:6683–6703): the sheet glides up in 0.6 s and eases down in 0.45 s; on opening the
 * bars rise 340 px in turn, 0.12 s in, 0.05 s apart, over 0.9 s. On closing they stay where they
 * are while the sheet goes.
 */

/** The seven bars' heights and how far each starts below the clip's top (luau:6698). */
const BAR_H = [120, 150, 170, 130, 160, 110, 140] as const;
const BAR_TOP = [40, 14, 0, 30, 6, 50, 22] as const;

export type AccountSheetProps = {
  open: boolean;
  onClose: () => void;
};

export function AccountSheet({ open, onClose }: AccountSheetProps) {
  const pairs = useScoreline(selectSheetPairs);
  const teams = useScoreline(selectTeams);
  const root = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  // The sheet is visually contained in the list pane, but its declared modal behavior applies
  // to every pane. Own only the inert attributes we add, leaving covered screens' guards alone.
  useLayoutEffect(() => {
    const dialog = root.current;
    if (!open) {
      // Run after the closed DOM is committed: React's selection restoration can otherwise
      // move focus back to the sheet after the opening effect's cleanup.
      returnTo.current?.focus({ preventScroll: true });
      returnTo.current = null;
      return;
    }
    if (!dialog) return;
    returnTo.current ??= document.activeElement as HTMLElement | null;
    const blocked: Element[] = [];
    for (let branch: HTMLElement = dialog; branch.parentElement; branch = branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && !sibling.hasAttribute('inert')) {
          sibling.setAttribute('inert', '');
          blocked.push(sibling);
        }
      }
    }
    close.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Tab') {
        const buttons = dialog.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]');
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (document.activeElement === (e.shiftKey ? first : last)) {
          e.preventDefault();
          (e.shiftKey ? last : first)?.focus();
        }
      }
    };
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('keydown', key, true);
      for (const element of blocked) element.removeAttribute('inert');
    };
  }, [open, onClose]);

  const list = pairs ? pairs.split('|') : [];
  const bars = BAR_H.map((h, i) => {
    const [home = '', away = ''] = (list[i % Math.max(list.length, 1)] ?? ':').split(':');
    const th = teams[home];
    const ta = teams[away];
    const stops = th && ta ? matchStops(th, ta) : null;
    const style = {
      top: BAR_TOP[i],
      height: h,
      '--i': i,
      background: stops ? `linear-gradient(180deg, ${stops[0]} 0%, ${stops[1]} 42%, ${stops[2]} 62%, ${stops[3]} 100%)` : 'var(--c-surf)',
    } as CSSProperties;
    return <span key={i} className={styles.bar} style={style} />;
  });

  return (
    <div
      ref={root}
      className={styles.sheet}
      data-open={open ? '' : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-title"
      aria-hidden={open ? undefined : true}
      inert={!open}
    >
      <span className={styles.label}>Account</span>
      <RoundButton ref={close} className={styles.close} aria-label="Close" onClick={onClose}>
        <Icon name="close" />
      </RoundButton>
      <div className={styles.bars} aria-hidden="true">
        {bars}
      </div>
      <div className={styles.copy}>
        <h2 id="account-title" className={styles.title}>
          Sign in to follow your clubs.
        </h2>
        <p className={styles.body}>Save your favourite teams and players, get a goal alert the second it lands, and keep your matchday in sync on every device.</p>
      </div>
      <div className={styles.actions}>
        <button type="button" className={`m-feel ${styles.primary}`} onClick={onClose} {...feel}>
          Continue with email
        </button>
        <button type="button" className={`m-feel ${styles.secondary}`} onClick={onClose} {...feel}>
          <span className={`m-light ${styles.secondaryLight}`} aria-hidden="true" />
          Continue with phone number
        </button>
        <button type="button" className={`m-feel ${styles.later}`} onClick={onClose} {...feel}>
          Not now
        </button>
        <p className={styles.note}>Prototype screen. Nothing is sent or stored.</p>
        <a className={styles.review} href={`${import.meta.env.BASE_URL}review.html`}>
          Phone preview for review
        </a>
      </div>
    </div>
  );
}

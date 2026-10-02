import type { ReactNode } from 'react';
import styles from './DevKit.module.css';

export function Section({ title, note, children, wide }: { title: string; note?: string; children: ReactNode; wide?: boolean }) {
  return (
    <section className={wide ? `${styles.section} ${styles.wide}` : styles.section} aria-label={title}>
      <h2 className={styles.head}>{title}</h2>
      {note && <p className={styles.note}>{note}</p>}
      {children}
    </section>
  );
}

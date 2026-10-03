import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { feel } from '../../ui';
import { dayLayout, dayPlace, type DayWidths } from './dayLayout';
import styles from './DayTabs.module.css';

/*
 * The day tabs. Not the shared Tabs: these centre the chosen tab, fade at both ends and carry the
 * Today↔Ongoing morph. The strip and the indicator are placed by writing a transform from the
 * measured words (so a slide is a CSS transition on transform alone); the Today tab's width and
 * the cross-fade of its two words follow --live-k, the page's Live tween.
 */

export type DayTab = { id: string; label: string };

export type DayTabsProps = {
  items: readonly DayTab[];
  value: string;
  /** the id of the tab that says "Ongoing" while Live is on */
  morph: string;
  live: boolean;
  onChange: (id: string) => void;
};

const ONGOING = 'Ongoing';

export function DayTabs({ items, value, morph, live, onChange }: DayTabsProps) {
  const viewRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLSpanElement>(null);
  const [words, setWords] = useState<DayWidths | null>(null);
  const [ready, setReady] = useState(false);
  const morphAt = items.findIndex((t) => t.id === morph);
  const labels = items.map((t) => `${t.id}:${t.label}`).join('|');

  // the words' widths, measured; again when the face loads or the labels change
  useLayoutEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const measure = () => {
      const w: number[] = [];
      let today = 0;
      let ongoing = 0;
      strip.querySelectorAll<HTMLElement>('[role="tab"]').forEach((tab, i) => {
        const spans = tab.querySelectorAll<HTMLElement>('[data-word]');
        if (i === morphAt) {
          today = spans[0]?.getBoundingClientRect().width ?? 0;
          ongoing = spans[1]?.getBoundingClientRect().width ?? 0;
          w.push(today);
        } else w.push(spans[0]?.getBoundingClientRect().width ?? 0);
      });
      setWords((prev) => (prev && prev.today === today && prev.ongoing === ongoing && prev.words.length === w.length && prev.words.every((x, i) => x === w[i]) ? prev : { words: w, morph: morphAt, today, ongoing }));
    };
    measure();
    const fonts = typeof document === 'undefined' ? undefined : document.fonts;
    let alive = true;
    void fonts?.ready.then(() => alive && measure());
    fonts?.addEventListener?.('loadingdone', measure);
    return () => {
      alive = false;
      fonts?.removeEventListener?.('loadingdone', measure);
    };
  }, [labels, morphAt]);

  // where the strip and the indicator go, for the layout Live is heading to
  const [vw, setVw] = useState(354);
  useLayoutEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const read = () => setVw(view.clientWidth || 354);
    read();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(read);
    ro?.observe(view);
    return () => ro?.disconnect();
  }, []);

  const at = items.findIndex((t) => t.id === value);
  const place = words && at >= 0 ? dayPlace(dayLayout(words, live ? 1 : 0), at, vw) : null;
  useLayoutEffect(() => {
    if (!place) return;
    // placing is a style write, so it never goes through React's render
    if (stripRef.current) stripRef.current.style.transform = `translateX(${place.shift}px)`;
    if (indRef.current) indRef.current.style.transform = `translateX(${place.indX}px) scaleX(${place.indW / 100})`;
  }, [place?.shift, place?.indX, place?.indW]); // eslint-disable-line react-hooks/exhaustive-deps
  // the first placement doesn't slide
  useLayoutEffect(() => {
    if (!place || ready) return;
    const raf = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(raf);
  }, [place, ready]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = items.findIndex((t) => t.id === value);
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % items.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    const item = items[next];
    if (!item) return;
    e.preventDefault();
    onChange(item.id);
    Array.from(stripRef.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [])
      .find((el) => el.dataset.tab === item.id)
      ?.focus();
  };

  const vars = words ? ({ '--wt': words.today, '--wo': words.ongoing } as CSSProperties) : undefined;
  return (
    <div className={styles.wrap}>
      <div ref={viewRef} className={styles.tabs} role="tablist" aria-label="Day" onKeyDown={onKeyDown}>
        <div ref={stripRef} className={styles.strip} style={vars} data-ready={ready ? '' : undefined}>
          {items.map((t) => {
            const on = t.id === value;
            const isMorph = t.id === morph;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                data-tab={t.id}
                aria-selected={on}
                aria-label={isMorph && live ? ONGOING : t.label}
                tabIndex={on ? 0 : -1}
                className={`m-feel ${styles.tab} ${isMorph ? styles.morph : ''}`}
                onClick={() => onChange(t.id)}
                {...feel}
              >
                {isMorph ? (
                  <>
                    <span data-word="" className={`${styles.word} ${styles.today}`} aria-hidden="true">
                      {t.label}
                    </span>
                    <span data-word="" className={`${styles.word} ${styles.ongoing}`} aria-hidden="true">
                      {ONGOING}
                    </span>
                  </>
                ) : (
                  <span data-word="" className={styles.word}>
                    {t.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <span className={`${styles.fade} ${styles.fadeL}`} aria-hidden="true" />
        <span className={`${styles.fade} ${styles.fadeR}`} aria-hidden="true" />
      </div>
      <span className={styles.rule} aria-hidden="true" />
      <span ref={indRef} className={styles.indicator} data-ready={ready ? '' : undefined} aria-hidden="true" />
    </div>
  );
}

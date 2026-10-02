import { memo, type HTMLAttributes, type SVGAttributes } from 'react';
import { ICON_SRC, tagId, type TagKind } from './icons';
import { tagLayout, tagList, type TagCounts } from './tagLayout';
import { useSvgId } from './svgId';
import styles from './Tags.module.css';

/*
 * The small round tags (luau:3462-3600): ball (goal), boot (assist), yellow and red cards,
 * substitution out and in. Each is one sprite symbol; these components only place them.
 */

const NAMES: Record<TagKind, string> = {
  goal: 'Goal',
  assist: 'Assist',
  yellow: 'Yellow card',
  red: 'Red card',
  subOut: 'Substituted off',
  subIn: 'Substituted on',
};

export type TagProps = Omit<SVGAttributes<SVGSVGElement>, 'children'> & {
  kind: TagKind;
  /** diameter in px (the Lua's rad × 2); 14 by default */
  size?: number;
  /** an accessible name; `true` uses the tag's own ("Goal", "Yellow card", …) */
  label?: string | true;
};

/** One round tag. */
export function Tag({ kind, size = 14, label, ...rest }: TagProps) {
  const name = label === true ? NAMES[kind] : label;
  return (
    <svg
      width={size}
      height={size}
      {...(name ? { role: 'img', 'aria-label': name } : { 'aria-hidden': true })}
      focusable="false"
      data-tag={kind}
      {...rest}
    >
      <use href={`#${tagId(kind)}`} width="100%" height="100%" />
    </svg>
  );
}

export type EventTagsProps = TagCounts &
  Omit<SVGAttributes<SVGSVGElement>, 'children'> & {
    /** the tag's radius (rad, 7 by default) */
    radius?: number;
  };

/**
 * What a player did, as a row of round tags (eventTags / countTags, luau:3570-3632). Repeats
 * stack like coins: each lies on the next with a thin shade only where it overlaps it, never
 * around the outside. Renders nothing when there is nothing to show.
 */
export const EventTags = memo(function EventTags({ goals, assists, yellow, red, radius: r = 7, ...rest }: EventTagsProps) {
  const id = useSvgId('sl-tags');
  const list = tagList({ goals, assists, yellow, red });
  if (list.length === 0) return null;
  const { xs, width } = tagLayout(list, r);
  const parts = [
    // the real counts: only the drawing stops at 3
    goals ? `${goals} ${goals === 1 ? 'goal' : 'goals'}` : '',
    assists ? `${assists} ${assists === 1 ? 'assist' : 'assists'}` : '',
    yellow ? 'yellow card' : '',
    red ? 'red card' : '',
  ].filter(Boolean);
  const k = (r + 1.2) / r;
  // drawn last to first, so each tag lies on the one after it
  const items = [];
  for (let i = list.length - 1; i >= 0; i--) {
    const px = xs[i]!;
    const next = xs[i + 1];
    if (next !== undefined && next - px < r * 2) {
      items.push(
        <g key={`s${i}`} clipPath={`url(#${id}-${i + 1})`}>
          <circle cx={px} cy={r} r={r * k} fill="rgb(0 0 0 / 0.6)" />
        </g>,
      );
    }
    items.push(<use key={i} href={`#${tagId(list[i]!)}`} x={px - r} y={0} width={r * 2} height={r * 2} />);
  }
  return (
    <svg width={width} height={r * 2} viewBox={`0 0 ${width} ${r * 2}`} role="img" aria-label={parts.join(', ')} focusable="false" data-tags={list.join(' ')} {...rest}>
      <defs>
        {xs.map((x, i) =>
          i > 0 ? (
            <clipPath key={i} id={`${id}-${i}`}>
              <circle cx={x} cy={r} r={r} />
            </clipPath>
          ) : null,
        )}
      </defs>
      {items}
    </svg>
  );
});

export type SubOffTagProps = HTMLAttributes<HTMLSpanElement> & { minute: number };

/** Substituted off, on the pitch: a red capsule with the arrow and the minute (subOffTag, luau:3528). */
export function SubOffTag({ minute, className, ...rest }: SubOffTagProps) {
  return (
    <span className={className ? `${styles.subOff} ${className}` : styles.subOff} role="img" aria-label={`Off ${minute}'`} {...rest}>
      <svg className={styles.subOffArrow} width={8} height={16} viewBox="-4 -8 8 16" aria-hidden="true" focusable="false">
        <path d={ICON_SRC.arrowL} transform="scale(8.4)" fill="none" stroke="currentColor" strokeWidth={0.19} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span aria-hidden="true">{minute}'</span>
    </span>
  );
}

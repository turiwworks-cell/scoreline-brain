import { memo, useMemo } from 'react';
import type { Player, Team } from '../../../domain';
import { Glass, SoftLight, type PhotoSources } from '../../../ui';
import { PITCH, pitchLayout } from './formation';
import { Marker } from './Marker';
import type { Marks } from './model';
import styles from './Lineup.module.css';

/*
 * The pitch (luau:5478): our half on glass, attacking upwards, lit softly from the top in the
 * team colour, a mowing stripe behind each line of players, the centre arc, the penalty and goal
 * areas and the spot in white at 9 %. The eleven stand in rows, every row evenly spaced, and rise
 * into place line by line, the forwards first.
 */

const LINE = 'rgb(255 255 255 / 0.09)';

export type PitchProps = {
  team: Team;
  form: string;
  xi: readonly number[];
  /** the pitch's width: the pane's less 2 × 18 */
  width: number;
  players: Readonly<Record<string, Player>>;
  marks: ReadonlyMap<number, Marks>;
  /** the rating of each shirt that has one and took part */
  ratings: ReadonlyMap<number, number>;
  best: number;
  followed: number | null;
  photoOf: (n: number) => PhotoSources | undefined;
  nameOf: (n: number) => string;
  hold: boolean;
  onOpen: (n: number, from: Element) => void;
};

export const Pitch = memo(function Pitch({ team, form, xi, width: pw, players, marks, ratings, best, followed, photoOf, nameOf, hold, onOpen }: PitchProps) {
  const ph = PITCH.height;
  const xiKey = xi.join(',');
  // the layout is read again only when the formation, the eleven or the width change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layout = useMemo(() => pitchLayout(form, xi, pw), [form, xiKey, pw]);
  return (
    <Glass radius={22} className={styles.pitch} data-formation={layout.form} data-pitch="">
      <span className={styles.field} aria-hidden="true">
        {/* the Lua's stops end at half the radius it is given (luau:3325), so the light is drawn at half of (0.92 pw, 0.78 ph) */}
        <SoftLight color={team.colors[0]} alpha={0.34} cx={pw / 2} cy={0} rx={pw * 0.46} ry={ph * 0.39} />
        <svg className={styles.lines} width={pw} height={ph} viewBox={`0 0 ${pw} ${ph}`} focusable="false">
          {layout.bands.map((b, i) => (
            <rect key={i} x={0} y={b.y} width={pw} height={b.h} fill="#fff" fillOpacity={b.shade} />
          ))}
          <g fill="none" stroke={LINE} strokeWidth={1}>
            <circle cx={pw / 2} cy={0} r={58} />
            <rect x={pw * 0.2} y={ph - ph * 0.16} width={pw * 0.6} height={ph * 0.16 + 2} />
            <rect x={pw * 0.37} y={ph - ph * 0.06} width={pw * 0.26} height={ph * 0.06 + 2} />
          </g>
          <circle cx={pw / 2} cy={ph - ph * 0.115} r={1.6} fill={LINE} />
        </svg>
      </span>
      {layout.slots.map((slot) => {
        const p = players[`${team.id}:${slot.n}`];
        return (
          <Marker
            key={slot.n}
            team={team}
            slot={slot}
            player={p}
            name={nameOf(slot.n)}
            marks={marks.get(slot.n)}
            rating={ratings.get(slot.n) ?? 0}
            best={slot.n === best}
            followed={followed === slot.n}
            photo={photoOf(slot.n)}
            hold={hold}
            onOpen={onOpen}
          />
        );
      })}
    </Glass>
  );
});

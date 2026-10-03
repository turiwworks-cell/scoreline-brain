import { memo } from 'react';
import type { League, Match, Team } from '../../domain';
import { Crest, Glass, MatchClock, textWidth, useFontVersion } from '../../ui';
import { EventsFeed } from './EventsFeed';
import { formOf, type FormResult } from './form';
import { H4 } from './H4';
import styles from './Panels.module.css';

/*
 * Facts (facts, luau:5300): before kick-off, the kick-off time, both sides' form and the match
 * info; once it has started, the momentum (Part 12 draws the chart), the commentary and the
 * match info.
 */

export type FactsProps = {
  match: Match;
  home: Team;
  away: Team;
  league: League | undefined;
  width: number;
  onReplayGoal?: (eventId: string) => void;
};

export const Facts = memo(function Facts({ match, home, away, league, width, onReplayGoal }: FactsProps) {
  const matchday = league?.matchday ?? 1;
  if (match.status === 'scheduled') {
    return (
      <div className={styles.facts}>
        <H4 left="Kick-off" right={`Matchday ${matchday}`} />
        <p className={styles.bigTime}>{match.kickoff}</p>
        <Form match={match} home={home} away={away} />
        <div className={styles.gap34} />
        <MatchInfo match={match} league={league} width={width} />
      </div>
    );
  }
  const count = match.events.length;
  return (
    <div className={styles.facts}>
      <H4 left="Momentum" right={<MatchClock match={match} className={styles.h4Clock} />} />
      <MomentumSlot />
      <H4
        left="Events"
        right={
          match.status === 'live' ? (
            <span className={styles.liveLabel}>
              <span className={styles.liveDot} aria-hidden="true" />
              Live
            </span>
          ) : (
            String(count)
          )
        }
      />
      <EventsFeed match={match} home={home} away={away} onReplayGoal={onReplayGoal}>
        <div className={styles.gap34} />
        <MatchInfo match={match} league={league} width={width} />
      </EventsFeed>
    </div>
  );
});

/**
 * Where the momentum chart goes (luau:4890): its headline, the chart on glass and the minute
 * axis, 269.8 px in all. Part 12 draws it; until then the space and the glass are kept so
 * everything under it sits where the Lua puts it.
 */
function MomentumSlot() {
  return (
    <div className={styles.momentum} data-part="12">
      <Glass radius={20} className={styles.momentumGlass}>
        <span className={styles.momentumNote}>Momentum chart · Part 12</span>
      </Glass>
    </div>
  );
}

/** The largest size (≤ `size`) at which `s` fits in `maxW` (fit, luau:1634). */
function fitSize(s: string, size: number, maxW: number): number {
  const w = textWidth(500, size, 0, s);
  return w <= maxW || w <= 0 ? size : (size * maxW) / w;
}

/**
 * Match info (matchInfo, luau:5246): glass tiles two by two, venue, referee and attendance when
 * the feed knows them, the kick-off, and the competition when the count is odd.
 */
export function MatchInfo({ match, league, width }: { match: Match; league: League | undefined; width: number }) {
  useFontVersion();
  const tiles: [string, string, string][] = [];
  const v = match.venue;
  if (v) {
    tiles.push(['Venue', v.name, v.city]);
    tiles.push(['Referee', v.referee, '']);
    if (v.attendance !== '') tiles.push(['Attendance', v.attendance, '']);
  }
  // the Lua knew no kick-off time for a match under way and showed 20:45 for the featured one,
  // 20:00 for the rest; a feed that sends one shows it
  const ko = match.kickoff !== '' ? match.kickoff : match.featured ? '20:45' : '20:00';
  tiles.push(['Kick-off', match.status === 'scheduled' ? match.kickoff : ko, 'Local time']);
  if (tiles.length % 2 === 1) tiles.push(['Competition', league?.name ?? match.league, `Matchday ${league?.matchday ?? 1}`]);
  const tileW = (width - 36 - 8) / 2;
  return (
    <section aria-label="Match info">
      <H4 left="Match info" />
      <div className={styles.tiles}>
        {tiles.map(([label, value, sub]) => (
          <Glass key={label} radius={16} className={styles.tile}>
            <span className={styles.tileLabel}>{label}</span>
            <span className={styles.tileValue} style={{ fontSize: fitSize(value, 15, tileW - 28) }}>
              {value}
            </span>
            {sub !== '' && <span className={styles.tileSub}>{sub}</span>}
          </Glass>
        ))}
      </div>
    </section>
  );
}

/** Form (formBlock, luau:5269): each side's last five, W white, D grey, L outlined. */
export function Form({ match, home, away }: { match: Pick<Match, 'id'>; home: Team; away: Team }) {
  return (
    <section aria-label="Form">
      <H4 left="Form" right="Last five" />
      {[home, away].map((t) => (
        <div key={t.id} className={styles.formRow}>
          <Crest team={t} size={16} className={styles.formCrest} />
          <span className={styles.formName}>{t.name}</span>
          <span className={styles.formBoxes} aria-label={`${t.name}: ${formOf(t.id, match.id).join(' ')}`}>
            {formOf(t.id, match.id).map((r, i) => (
              <FormBox key={i} r={r} />
            ))}
          </span>
        </div>
      ))}
    </section>
  );
}

function FormBox({ r }: { r: FormResult }) {
  return (
    <span className={styles.formBox} data-r={r} aria-hidden="true">
      {r}
    </span>
  );
}

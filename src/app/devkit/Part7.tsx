import { useState } from 'react';
import { TEAMS } from '../../data/demo/data';
import type { Team } from '../../domain';
import { Crest, EventTags, Glass, Icon, ICON_NAMES, KitDisc, MatchClock, PhotoTile, PlayerPhoto, RatingBadge, SubOffTag, Tag, TAG_KINDS, type ClockMatch } from '../../ui';
import { Section } from './Section';
import styles from './Part7.module.css';

/*
 * Part 7 on /dev/kit: the icon sprite, crests, tags, ratings, photos and the clock, with every
 * team-coloured primitive shown for every demo team.
 */

const hex = (n: number) => `#${n.toString(16).padStart(6, '0').toUpperCase()}`;

/** The demo's 23 national sides, as the store holds them (no `flag` sent: the built-in flags draw). */
const DEMO_TEAMS: Team[] = TEAMS.map((t) => ({ id: t.id, name: t.name, short: t.short, colors: [hex(t.c1), hex(t.c2)] }));

/** A club the feed sends with its own `flag` (DATA-CONTRACT example), and one sent with no flag at all. */
const FEED_TEAMS: { team: Team; note: string }[] = [
  { team: { id: 'mci', name: 'Man City', short: 'MCI', colors: ['#6CABDD', '#1C2C5B'], flag: [['h', '#6CABDD', '#FFFFFF', '#6CABDD']] }, note: 'flag sent' },
  { team: { id: 'whu', name: 'West Ham', short: 'WHU', colors: ['#7A263A', '#1BB1E7'] }, note: 'no flag: c1 disc, c2 ring' },
  { team: { id: 'fra', name: 'France', short: 'FRA', colors: ['#0055A4', '#EF4135'], flag: [['s', 15, 15, 12, '#EF4135'], ['cs', 15, 15, 13, 2, '#0055A4']] }, note: 'sent flag beats built-in' },
];

// A drawn stand-in for a bust (288 × 360, head in CROP.face) to check the crop geometry until Part 8 brings real photos.
const standIn = (c: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="288" height="360" viewBox="0 0 288 360">` +
      `<path d="M14 360 C14 226 70 182 144 182 C218 182 274 226 274 360 Z" fill="${c}"/>` +
      `<rect x="122" y="128" width="44" height="64" rx="18" fill="#a77b62"/>` +
      `<ellipse cx="144" cy="92" rx="50" ry="60" fill="#c89f86"/>` +
      `<path d="M94 82 C96 36 192 30 194 82 C178 58 112 58 94 82 Z" fill="#2a1d16"/>` +
      `<rect x="60" y="8" width="168" height="168" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-dasharray="4 4"/>` +
      `</svg>`,
  )}`;

const RATINGS = [5.4, 6.1, 6.6, 7.3, 8.1];

const TAG_ROWS: { label: string; goals?: number; assists?: number; yellow?: boolean; red?: boolean }[] = [
  { label: '1 goal', goals: 1 },
  { label: '2 goals', goals: 2 },
  { label: 'hat-trick', goals: 3 },
  { label: '4 goals (3 shown)', goals: 4 },
  { label: 'goal, assist', goals: 1, assists: 1 },
  { label: '2 assists, booked', assists: 2, yellow: true },
  { label: 'goal, booked, sent off', goals: 1, yellow: true, red: true },
  { label: 'sent off', red: true },
];

function useDemoClocks(): { label: string; match: ClockMatch }[] {
  // fixed at mount: the live clocks run from here, as one synced from the feed would
  const [at] = useState(() => Date.now());
  return [
    { label: 'Live, first half', match: { status: 'live', clock: { minute: 38, second: 50, at }, kickoff: '20:00' } },
    { label: 'Live', match: { status: 'live', clock: { minute: 58, second: 40, at }, kickoff: '20:00' } },
    { label: 'Added time', match: { status: 'live', clock: { minute: 92, second: 10, at }, kickoff: '20:00' } },
    { label: 'Finished', match: { status: 'finished', clock: { minute: 90, second: 0, at }, kickoff: '18:30' } },
    { label: 'Scheduled', match: { status: 'scheduled', clock: { minute: 0, second: 0, at }, kickoff: '20:45' } },
  ];
}

export function Part7() {
  const clocks = useDemoClocks();
  return (
    <>
      <header className={styles.partHead}>
        <h2 className={styles.partTitle}>Part 7 · SVG primitives and PlayerPhoto</h2>
      </header>
      <div className={styles.grid}>
        <Section title="Icons" note="The sprite from ICON_SRC (luau:3031-3105), at the Lua's size and stroke, then at 2×.">
          <ul className={styles.icons}>
            {ICON_NAMES.map((name) => (
              <li key={name}>
                <span className={styles.iconBox}>
                  <Icon name={name} scale={name === 'star' ? 8 : 1} />
                </span>
                <span className={styles.iconBox}>
                  <Icon name={name} scale={name === 'star' ? 16 : 2} />
                </span>
                <span className={styles.caption}>{name}</span>
              </li>
            ))}
            <li>
              <span className={styles.iconBox}>
                <Icon name="follow" on />
              </span>
              <span className={styles.iconBox}>
                <Icon name="follow" on scale={2} />
              </span>
              <span className={styles.caption}>follow on</span>
            </li>
          </ul>
        </Section>

        <Section title="Tags" note="Ball, boot, cards, subs (luau:3462-3532) at R 7 and R 12. Repeats stack like coins, shaded only where they overlap.">
          <div className={styles.tagRow}>
            {TAG_KINDS.map((k) => (
              <Tag key={k} kind={k} size={14} label />
            ))}
          </div>
          <div className={styles.tagRow}>
            {TAG_KINDS.map((k) => (
              <Tag key={k} kind={k} size={24} />
            ))}
          </div>
          <ul className={styles.tagList}>
            {TAG_ROWS.map(({ label, ...counts }) => (
              <li key={label}>
                <span className={styles.caption}>{label}</span>
                <EventTags {...counts} />
                <EventTags {...counts} radius={8} />
              </li>
            ))}
          </ul>
          <div className={styles.tagRow}>
            <SubOffTag minute={72} />
            <SubOffTag minute={9} />
            <span className={styles.caption}>off, on the pitch (luau:3528)</span>
          </div>
        </Section>

        <Section title="RatingBadge" note="Spectrum at 8+, then green, yellow, orange, red (luau:3538-3569). Star for the best in the match.">
          {[10, 12].map((size) => (
            <div key={size} className={styles.tagRow}>
              {RATINGS.map((v) => (
                <RatingBadge key={v} value={v} size={size} />
              ))}
              <RatingBadge value={8.6} best size={size} />
            </div>
          ))}
        </Section>

        <Section title="MatchClock" note="A leaf subscriber to one shared 1 Hz ticker. Only the clock re-renders, and only when its label changes.">
          <ul className={styles.clocks}>
            {clocks.map(({ label, match }) => (
              <li key={label}>
                <span className={styles.caption}>{label}</span>
                <MatchClock match={match} className={styles.clock} data-testid={`clock-${label}`} />
              </li>
            ))}
          </ul>
        </Section>

        <Section title="PlayerPhoto" note="Head and shoulders standing on the box's bottom edge (luau:3654); the holder clips them. Stand-in busts until Part 8.">
          <div className={styles.photoRow}>
            <PhotoTile team={DEMO_TEAMS[0]!} n={10} size={52} src={standIn('#1d3e8a')} alt="Stand-in bust" />
            <PhotoTile team={DEMO_TEAMS[1]!} n={10} size={42} src={standIn('#74acdf')} alt="Stand-in bust" />
            <PhotoTile team={DEMO_TEAMS[1]!} n={10} size={52} src="/img/players/missing.avif" data-testid="broken-photo" />
            <PhotoTile team={DEMO_TEAMS[1]!} n={0} size={52} />
            <Glass radius={18} className={styles.card}>
              <PlayerPhoto team={DEMO_TEAMS[0]!} n={7} src={standIn('#1d3e8a')} width={84} />
            </Glass>
            <Glass radius={18} className={styles.card}>
              <PlayerPhoto team={DEMO_TEAMS[0]!} n={7} width={84} />
            </Glass>
          </div>
          <p className={styles.caption}>stand-in · stand-in · broken src → kit disc · no player → crest · in a card, photo and none</p>
          <div className={styles.photoRow}>
            <KitDisc team={DEMO_TEAMS[1]!} n={10} size={38} />
            <KitDisc team={DEMO_TEAMS[0]!} n={7} size={40} />
            <KitDisc team={DEMO_TEAMS[2]!} n={9} size={88} />
          </div>
        </Section>

        <Section title="Feed crests" note="teams[].flag: a sent flag wins over the built-in one; with neither, a disc in c1 ringed in c2 (luau:7712-7723).">
          <ul className={styles.feedCrests}>
            {FEED_TEAMS.map(({ team, note }) => (
              <li key={team.id + note}>
                <Crest team={team} size={38} label={team.name} />
                <Crest team={team} size={20} />
                <span className={styles.caption}>
                  {team.name} · {note}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Teams" wide note="Every demo team: crest at 13, 20 and 38 (luau:3143), kit discs for 7 and 10, photo tiles at 52 and 42 without a photo, and with no player known.">
          <ul className={styles.teams} data-testid="kit-teams">
            {DEMO_TEAMS.map((t) => (
              <li key={t.id} data-team={t.id}>
                <span className={styles.teamName}>
                  <span>{t.short}</span>
                  <span className={styles.caption}>{t.name}</span>
                </span>
                <Crest team={t} size={13} />
                <Crest team={t} size={20} />
                <Crest team={t} size={38} label={t.name} />
                <KitDisc team={t} n={7} size={38} />
                <KitDisc team={t} n={10} size={38} />
                <PhotoTile team={t} n={10} size={52} />
                <PhotoTile team={t} n={0} size={42} />
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </>
  );
}

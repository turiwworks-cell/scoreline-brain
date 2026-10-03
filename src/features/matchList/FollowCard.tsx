import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { minText, nameOf, playerKey, scoreStr, type Match, type NextFixture, type Team } from '../../domain';
import { sharedPlayer } from '../../motion';
import { selectMatch, selectTeam, useScoreline } from '../../store';
import { Crest, EventTags, feel, Icon, KitDisc, MatchClock, mix, pastel, PlayerPhoto, RatingBadge, SoftLight, Tag, tagList, tagLayout, textWidth, useFontVersion, type PhotoSources } from '../../ui';
import { fitSize } from './cardLayout';
import { bandCells, eveningNote, type Cell } from './follow/cells';
import { useNowMs } from './follow/clock';
import { useCardFrames } from './follow/cardFrames';
import { goalFeed } from './goalFeed';
import { countdown, followHeight, followPhase, goalLine, goalsBy, nextView, onPitch, playerFlags, playerStats, RED_SECONDS, sideOf, type Flags, type Followed, type PStats } from './follow/model';
import type { FollowLive } from './follow/live';
import { selectFollowMatchId, selectNext, selectPlayers } from './selectors';
import styles from './Follow.module.css';

/*
 * The card of the player you follow (drawFollow, luau:4192–4527): a glass pane 64 px tall closed
 * and 200–300 px open. Open it has his chest-up photo, his name (or, for a few seconds after he
 * scores, GOAL), his evening in one line, and a four-cell stats band; after his match, his next
 * fixture with a countdown; while he is on the pitch, his last acts. Closed it has his face, his
 * name and the one thing that matters now. A red card floods it. The whole card opens his page.
 */

const WARM = '#F7F2EA';
const PAD = (v: number) => String(Math.floor(v)).padStart(2, '0');
// the roll of a countdown digit takes this long, and ends on the second the digit changes (luau:4200)
const ROLL_MS = 550;

export type FollowCardProps = {
  followed: Followed;
  live: FollowLive;
  open: boolean;
  /** the picker has taken the card's place: it stays mounted, with everything it has learned */
  hidden: boolean;
  onToggle: () => void;
  onOpenPlayer: (p: Followed, from: Element) => void;
  /** the bust files of a team's player (the photo manifest, ui/photoManifest.ts); none = the kit disc */
  photoOf?: PhotoOf;
};

export type PhotoOf = (team: Team, n: number) => PhotoSources | undefined;

/** The attributes a shared element carries (Shared.tsx), for one that is an end only some of the time. */
const sharedEnd = (id: string, active: boolean) => (active ? { 'data-shared': id, 'data-shared-end': 'face' } : {});

export function FollowCard({ followed, live, open, hidden, onToggle, onOpenPlayer, photoOf }: FollowCardProps) {
  const { team: teamId, n } = followed;
  const team = useScoreline(selectTeam(teamId)) as Team | undefined;
  const players = useScoreline(selectPlayers);
  const matchId = useScoreline(selectFollowMatchId(teamId));
  const match = useScoreline(selectMatch(matchId ?? 0)) as Match | undefined;
  const side = match ? sideOf(match, teamId) : 'home';
  const oppId = match ? (side === 'home' ? match.away : match.home) : '';
  const opp = useScoreline(selectTeam(oppId)) as Team | undefined;
  const next = useScoreline(selectNext(teamId));
  const nextOpp = useScoreline(selectTeam(next?.opponent ?? '')) as Team | undefined;
  useFontVersion();

  const flags = useMemo(() => (match ? playerFlags({ players }, match, side, n) : undefined), [match, players, side, n]);

  // a red card shows its flood for RED_SECONDS, then the card settles into "after his match"
  const clock = goalFeed.clock;
  const [redOver, setRedOver] = useState(0);
  useEffect(() => {
    if (live.redAt <= 0 || redOver === live.redAt) return;
    const left = RED_SECONDS - (clock.now() - live.redAt);
    const id = setTimeout(() => setRedOver(live.redAt), Math.max(0, left) * 1000);
    return () => clearTimeout(id);
  }, [live.redAt, redOver, clock]);
  const phase = followPhase(match, flags, live.redAt > 0 && redOver !== live.redAt ? 0 : Infinity);

  const [t0] = useState(Date.now);
  const tick = useNowMs(phase === 'live' || phase === 'post' || phase === 'red' ? 1000 : 0);
  const nowMs = tick || t0;
  const st = match ? playerStats({ players }, match, side, n, nowMs) : undefined;
  const onP = phase === 'live' && flags !== undefined && onPitch(flags);
  const full = followHeight(phase, onP);

  const card = useRef<HTMLDivElement>(null);
  useCardFrames(card, live.goalAt, live.redAt, phase, clock.now);

  const player = players[playerKey(teamId, n)];
  const [photoFailed, setPhotoFailed] = useState<string | undefined>();
  if (!team) return null;

  const first = player?.first ?? '';
  const last = player ? player.last : nameOf({ players }, teamId, n);
  const files = photoOf?.(team, n);
  const photo = files !== undefined && photoFailed !== files.src ? files : undefined;
  const after = phase === 'post' || phase === 'red';
  const faceId = sharedPlayer(teamId, n);

  const style = {
    '--full': full,
    '--f0': pastel(team.colors[0]),
    '--f1': pastel(mix(team.colors[1], WARM, 0.3)),
  } as CSSProperties;

  const lastSize = fitSize(26, textWidth(600, 26, -0.02, last), 196);
  const closedSize = fitSize(16, textWidth(600, 16, -0.01, last), 120);

  return (
    <div
      ref={card}
      className={`m-glass m-feel ${styles.follow} ${styles.rim}`}
      data-open={open}
      data-phase={phase}
      data-short={open ? undefined : ''}
      hidden={hidden}
      style={style}
      {...feel}
    >
      <button
        type="button"
        className={styles.hit}
        data-focus-key={`follow-${teamId}-${n}`}
        aria-label={`${first ? `${first} ` : ''}${last}, the player you follow`}
        onClick={(e) => onOpenPlayer(followed, e.currentTarget)}
      >
        {/* softLight(…, 230, 150): its stops end halfway along the gradient's radius (luau:3321), so the light reaches 115 × 75 */}
        <SoftLight color={team.colors[0]} alpha={0.5} cx="80%" cy={88} rx={115} ry={75} />
        <span className={styles.flood} aria-hidden="true" />

        <span className={`${styles.layer} ${styles.open}`}>
          {/* the chest-up photo, standing on the stats band */}
          {photo ? (
            <span className={styles.chestPos}>
              <span className={styles.chest} {...sharedEnd(faceId, open && !hidden)}>
                <picture>
                  {photo.sources.map((s) => (
                    <source key={s.type} type={s.type} srcSet={s.srcSet} sizes="144px" />
                  ))}
                  <img
                    className={styles.chestImg}
                    src={photo.src}
                    srcSet={photo.srcSet}
                    sizes="144px"
                    alt=""
                    width={144}
                    height={180}
                    draggable={false}
                    onError={() => setPhotoFailed(photo.src)}
                  />
                </picture>
              </span>
            </span>
          ) : (
            <span className={styles.kitPos}>
              <span className={styles.kit} {...sharedEnd(faceId, open && !hidden)}>
                <KitDisc team={team} n={n} size={88} />
              </span>
            </span>
          )}

          <span className={styles.nameBlock}>
            <span className={`${styles.text} ${styles.first}`}>{first}</span>
            <span className={`${styles.text} ${styles.last}`} style={{ fontSize: lastSize, top: 62 - lastSize }}>
              {last}
            </span>
            <span className={styles.vs}>
              <Crest team={team} size={14} />
              <span className={styles.vsText}>{opp ? `vs ${opp.name}` : team.name}</span>
            </span>
            <span className={after ? `${styles.line} ${styles.lineIn}` : styles.line} style={after ? { gap: 8 } : undefined}>
              {after && match && st && flags && team ? (
                <AfterLine team={team} opp={opp} match={match} side={side} st={st} flags={flags} />
              ) : (
                <Goals match={match} side={side} n={n} note={eveningNote(match, st, onP)} />
              )}
            </span>
          </span>

          <span className={styles.goalBlock}>
            <span className={`${styles.text} ${styles.goalWord}`}>GOAL</span>
            <span className={`${styles.text} ${styles.goalName}`}>{last}</span>
            <span className={`${styles.text} ${styles.goalLine}`}>{goalLine(flags?.goals ?? 0)}</span>
          </span>

          <span className={styles.fade} data-in={phase === 'post' ? '' : undefined}>
            <span className={styles.band}>
              {bandCells(st, phase, match, opp?.name ?? '', n).map((c, i) => (
                <StatCell key={i} index={i} cell={c} />
              ))}
            </span>
          </span>

          {(after || onP) && <span className={styles.rule} data-in={after ? '' : undefined} />}
          {after && (
            <span className={styles.fade} data-in="">
              <span className={styles.next}>
                <NextMatch next={next} opp={nextOpp} nowMs={nowMs} />
              </span>
            </span>
          )}
          {onP && <Acts live={live} />}
        </span>

        <span className={`${styles.layer} ${styles.closed}`}>
          <span className={styles.faceBox} {...sharedEnd(faceId, !open && !hidden)}>
            <PlayerPhoto team={team} n={n} width={54} src={photo?.src} srcSet={photo?.srcSet} sources={photo?.sources} alt="" />
          </span>
          <span className={`${styles.text} ${styles.cName}`} style={{ fontSize: closedSize }}>
            {last}
          </span>
          {after ? (
            <span className={styles.fade} data-in="">
              <span className={`${styles.text} ${styles.cWho}`}>{nextOpp ? `Next · vs ${nextOpp.name}` : 'Next · Friendly'}</span>
              <span className={styles.cNext}>
                <span className={styles.cDay}>{nextView(next).day}</span>
                <span className={styles.cClock}>{nextView(next).clock}</span>
              </span>
            </span>
          ) : (
            <>
              <span className={styles.cSub}>
                {phase === 'live' && match ? (
                  <>
                    <span className={styles.cDot} data-ball={live.ball ? '' : undefined} aria-hidden="true" />
                    <span>
                      <MatchClock match={match} />
                      {opp ? ` · vs ${opp.name}` : ' · '}
                    </span>
                  </>
                ) : (
                  <span>{opp ? `vs ${opp.name}` : team.name}</span>
                )}
              </span>
              {st?.played && flags && (
                <span className={styles.cRight}>
                  <EventTags goals={flags.goals} assists={flags.assists} yellow={flags.yellow} red={flags.redAt !== undefined} radius={8} />
                  {st.rating > 0 && <RatingBadge value={st.rating} size={12} />}
                </span>
              )}
            </>
          )}
        </span>

        {phase === 'red' && (
          <>
            <span className={styles.red} aria-hidden="true" />
            <span className={styles.redText} aria-hidden="true">
              <span className={`${styles.text} ${styles.redWord}`}>RED CARD</span>
              <span className={`${styles.text} ${styles.redMeta}`}>{`${last}${flags?.redAt !== undefined ? ` · ${minText(flags.redAt)}` : ''} · off`}</span>
              <span className={styles.redCard} />
            </span>
          </>
        )}
      </button>

      <button
        type="button"
        className={`m-glass m-feel m-dip ${styles.toggle}`}
        aria-label={open ? 'Show less' : 'Show more'}
        aria-expanded={open}
        onClick={onToggle}
        {...feel}
      >
        <Icon name="chevUp" />
      </button>
    </div>
  );
}

/** His last match in one line: rating, what he did, and how it ended (luau:4337). */
function AfterLine({ team, opp, match, side, st, flags }: { team: Team; opp: Team | undefined; match: Match; side: 'home' | 'away'; st: PStats; flags: Flags }) {
  const home = side === 'home' ? team : opp;
  const away = side === 'home' ? opp : team;
  const sent = flags.redAt;
  const note = sent !== undefined ? `Sent off ${minText(sent)}` : `Full time · ${home?.short ?? ''} ${scoreStr(match.score[0], match.score[1])} ${away?.short ?? ''}`;
  // the note takes what the tags leave of the line's 196 px, at a size that fits (fit, luau:4358)
  const rated = st.played && st.rating > 0;
  const tags = tagLayout(tagList({ goals: flags.goals, assists: flags.assists, yellow: flags.yellow, red: sent !== undefined }), 7.5).width;
  const used = (rated ? textWidth(700, 11.5, 0, st.rating.toFixed(1)) + 11.5 * 1.1 + 8 : 0) + (tags > 0 ? tags + 8 : 0);
  const size = fitSize(12, textWidth(500, 12, 0, note), 196 - used);
  return (
    <span className={styles.after}>
      {rated && <RatingBadge value={st.rating} size={11.5} />}
      <EventTags goals={flags.goals} assists={flags.assists} yellow={flags.yellow} red={sent !== undefined} radius={7.5} />
      <span className={`${styles.note} ${sent !== undefined ? styles.noteRed : styles.noteM}`} style={{ fontSize: size }}>
        {note}
      </span>
    </span>
  );
}

/** His goals tonight as glass chips with the ball and the minute, or the note that says why not (luau:4349). */
function Goals({ match, side, n, note }: { match: Match | undefined; side: 'home' | 'away'; n: number; note: string }) {
  const chips: ReactNode[] = [];
  if (match) {
    let at = 0;
    for (const e of goalsBy(match, side, n)) {
      const label = minText(e.minute);
      const w = textWidth(600, 11.5, 0, label) + 32;
      if (at + w < 192) {
        chips.push(
          <span key={e.id} className={`m-glass m-glass-thin ${styles.goalChip}`}>
            <Tag kind="goal" size={14} />
            <span>{label}</span>
          </span>,
        );
      }
      at += w + 6;
    }
  }
  return chips.length > 0 ? <>{chips}</> : <span className={styles.note}>{note}</span>;
}

/** One cell of the stats band: it comes in with the card, one after another (luau:4162). */
function StatCell({ index, cell }: { index: number; cell: Cell }) {
  return (
    <span className={styles.cell} style={{ '--i': index } as CSSProperties}>
      <span className={`${styles.label} ${styles.cellLabel}`}>{cell.label}</span>
      <span className={styles.cellValue} data-kind={cell.kind}>
        {cell.kind === 'r' ? typeof cell.value === 'number' && cell.value > 0 ? <RatingBadge value={cell.value} size={12.5} /> : '–' : cell.value}
      </span>
    </span>
  );
}

/** After his match: who is next, when, and a quiet countdown (followNext, luau:4178). */
function NextMatch({ next, opp, nowMs }: { next: NextFixture | undefined; opp: Team | undefined; nowMs: number }) {
  const v = nextView(next);
  const [d, h, m] = v.at === undefined ? [0, 0, 0] : countdown(v.at, nowMs + ROLL_MS);
  return (
    <>
      <span className={`${styles.label} ${styles.nextLabel}`}>Next match</span>
      <span className={styles.nextWho}>
        {opp && <Crest team={opp} size={20} />}
        <span className={styles.nextName}>{v.opponent ? `vs ${opp?.name ?? v.opponent.toUpperCase()}` : 'Friendly · TBC'}</span>
      </span>
      <span className={styles.nextWhen}>{v.clock ? `${v.day} · ${v.clock}` : v.day}</span>
      {v.at !== undefined && (
        <span className={styles.count}>
          <span className={`${styles.label} ${styles.countLabel}`}>Kick-off in</span>
          <Unit index={0} value={d} name="D" />
          <span className={styles.colon} style={{ '--i': 0 } as CSSProperties}>
            :
          </span>
          <Unit index={1} value={h} name="H" />
          <span className={styles.colon} style={{ '--i': 1 } as CSSProperties}>
            :
          </span>
          <Unit index={2} value={m} name="M" />
        </span>
      )}
    </>
  );
}

/** One unit of the countdown: when it changes the old value eases up and out while the new one comes in from below. */
function Unit({ index, value, name }: { index: number; value: number; name: string }) {
  const [shown, setShown] = useState({ cur: value, old: -1 });
  if (shown.cur !== value) setShown({ cur: value, old: shown.cur });
  return (
    <span className={styles.unit} style={{ '--i': index } as CSSProperties}>
      {shown.old >= 0 && (
        <span key={`o${shown.old}`} className={styles.digit} data-old="" onAnimationEnd={() => setShown((s) => ({ cur: s.cur, old: -1 }))}>
          {PAD(shown.old)}
        </span>
      )}
      <span key={shown.cur} className={styles.digit} data-new={shown.old >= 0 ? '' : undefined}>
        {PAD(shown.cur)}
      </span>
      <span className={styles.unitName}>{name}</span>
    </span>
  );
}

interface ActRow {
  key: string;
  text: string;
  clock: string;
  tone: 'live' | 'text' | 'muted';
  weight: 'm' | 'r';
}

const TONE = { live: 'var(--c-live)', text: 'var(--c-text)', muted: 'var(--c-muted)' } as const;

/** While he is on the pitch: has he the ball, and his last two acts (luau:4401). */
function Acts({ live }: { live: FollowLive }) {
  const { acts } = live;
  const onBall = live.ball && acts.length > 0;
  const rows: ActRow[] = [];
  const a0 = acts[0];
  const a1 = acts[1];
  if (!a0) rows.push({ key: 'watching', text: 'Watching every touch…', clock: '', tone: 'muted', weight: 'r' });
  else if (onBall) {
    rows.push({ key: `a${a0.t}`, text: a0.txt, clock: a0.clock, tone: a0.kind === 'goal' ? 'live' : 'text', weight: 'm' });
    if (a1) rows.push({ key: `a${a1.t}`, text: a1.txt, clock: a1.clock, tone: 'muted', weight: 'r' });
  } else {
    rows.push({ key: `off${live.ballAt}`, text: 'Off the ball right now', clock: '', tone: 'muted', weight: 'm' });
    rows.push({ key: `a${a0.t}`, text: a0.txt, clock: a0.clock, tone: 'muted', weight: 'r' });
  }
  return (
    <span className={styles.acts}>
      <span className={styles.ballDot} data-ball={onBall ? '' : undefined} />
      {rows.map((r, i) => (
        <span key={r.key} className={styles.act} data-row={i} data-weight={r.weight} style={{ color: TONE[r.tone] }}>
          <span className={styles.actIn}>
            <span className={styles.actText}>{r.text}</span>
            {r.clock && <span className={styles.actClock}>{r.clock}</span>}
          </span>
        </span>
      ))}
    </span>
  );
}

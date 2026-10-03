import { useState } from 'react';
import type { Team } from '../../domain';
import { useScoreline } from '../../store';
import { feel } from '../../ui';
import { Block } from './cascade';
import { FollowCard } from './FollowCard';
import { FollowPicker } from './FollowPicker';
import { useFollowLive } from './follow/live';
import type { Followed } from './follow/model';
import { useFollowed, type FollowPref } from './follow/pref';
import { selectFollowMatchId } from './selectors';
import { Star } from './Star';
import styles from './Follow.module.css';

/*
 * The section of the player you follow (drawFollow, luau:4231): a label with the spectrum star and,
 * once you follow someone, Change (which opens the picker) or Done; then the picker or the card.
 * With nobody followed it is the picker, under "Your player". Choosing a player starts a card of
 * his own: what it has learned of his evening, whether it is open and whether the picker is out
 * all belong to him.
 */

export type FollowSectionProps = {
  pref: FollowPref;
  /** the section's place among the list's blocks, which times its entrance */
  index: number;
  /** it shows on Today and Ongoing; elsewhere it stays mounted, unseen, keeping what it has learned */
  shown: boolean;
  onOpenPlayer: (p: Followed, from: Element) => void;
  photoOf?: (team: Team) => string | undefined;
};

export function FollowSection({ pref, index, shown, onOpenPlayer, photoOf }: FollowSectionProps) {
  const followed = useFollowed(pref);
  return (
    <Block index={index} className={styles.section} hidden={!shown}>
      {followed ? (
        <Following key={`${followed.team}:${followed.n}`} followed={followed} pref={pref} shown={shown} onOpenPlayer={onOpenPlayer} photoOf={photoOf} />
      ) : (
        <section aria-label="Your player">
          <Head title="Your player" />
          <FollowPicker followed={null} staged={false} onPick={pref.set} onUnfollow={() => {}} photoOf={photoOf} />
        </section>
      )}
    </Block>
  );
}

function Following({ followed, pref, shown, onOpenPlayer, photoOf }: { followed: Followed; pref: FollowPref; shown: boolean; onOpenPlayer: FollowSectionProps['onOpenPlayer']; photoOf?: FollowSectionProps['photoOf'] }) {
  const [picking, setPicking] = useState(false);
  const [open, setOpen] = useState(true);
  const matchId = useScoreline(selectFollowMatchId(followed.team));
  const live = useFollowLive(followed, matchId);
  return (
    <section aria-label="Following">
      <Head title="Following" action={{ label: picking ? 'Done' : 'Change', onClick: () => setPicking((p) => !p) }} />
      {picking && (
        <FollowPicker
          followed={followed}
          staged
          onPick={(p) => {
            pref.set(p);
            setPicking(false);
          }}
          onUnfollow={() => pref.set(null)}
          photoOf={photoOf}
        />
      )}
      <FollowCard followed={followed} live={live} open={open} hidden={picking || !shown} onToggle={() => setOpen((o) => !o)} onOpenPlayer={onOpenPlayer} photoOf={photoOf} />
    </section>
  );
}

function Head({ title, action }: { title: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className={styles.head}>
      <Star className={styles.star} />
      <h2 className={`${styles.label} ${styles.title}`}>{title}</h2>
      {action && (
        <button type="button" className={`m-feel ${styles.change}`} onClick={action.onClick} {...feel}>
          <span className={styles.label}>{action.label}</span>
        </button>
      )}
    </div>
  );
}

import { useCallback } from 'react';
import { followPref, useFollowed } from '../../features/matchList';
import { PlayerView } from '../../features/player';
import { selectLoaded, selectMatch, selectMatchIdOfTeam, useScoreline } from '../../store';
import { demoFollowed } from '../followed';
import { useNav } from '../nav/useNav';
import type { MatchRef, PlayerRef, PlayerStep } from '../nav/url';
import { Missing } from './Missing';

/**
 * The player screen: the feature for the player in the URL, with the navigation. His numbers come
 * from the match he was opened from when his team plays in it, else from his team's own match
 * (a direct link, the list's follow card).
 */
export function PlayerScreen({ player, match, step, chrome }: { player: PlayerRef; match: MatchRef | null; step?: PlayerStep; chrome: 'back' | 'close' | 'none' }) {
  const nav = useNav();
  const loaded = useScoreline(selectLoaded);
  const opened = useScoreline(selectMatch(match?.id ?? -1));
  const ofTeam = useScoreline(selectMatchIdOfTeam(player.team));
  const plays = opened !== undefined && (opened.home === player.team || opened.away === player.team);
  const pref = followPref(demoFollowed());
  const followed = useFollowed(pref);
  const following = followed?.team === player.team && followed.n === player.n;
  const { team, n } = player;
  const onFollow = useCallback((on: boolean) => pref.set(on ? { team, n } : null), [pref, team, n]);
  return (
    <PlayerView
      team={team}
      n={n}
      matchId={plays ? opened.id : ofTeam}
      following={following}
      onFollow={onFollow}
      chrome={chrome}
      onBack={nav.back}
      enter={step ?? 0}
      onStep={(to, dir) => nav.stepPlayer(to, dir)}
      missing={<Missing back={chrome !== 'none'} loaded={loaded} what="This player" />}
    />
  );
}

import { useEffect } from 'react';
import { playerKey } from '../../domain';
import { selectMatch, selectPlayer, selectTeam, useScoreline } from '../../store';
import type { Nav } from '../nav/url';

const APP = 'Scoreline';

/**
 * The name of what the URL shows (the player, else the match, else the list), kept as the
 * document title so history entries and screen readers name each screen.
 */
export function useScreenTitle(nav: Nav): string {
  const player = useScoreline(selectPlayer(nav.player ? playerKey(nav.player.team, nav.player.n) : ''));
  const playerTeam = useScoreline(selectTeam(nav.player?.team ?? ''));
  const match = useScoreline(selectMatch(nav.match?.id ?? 0));
  const home = useScoreline(selectTeam(match?.home ?? ''));
  const away = useScoreline(selectTeam(match?.away ?? ''));

  let name = '';
  if (nav.player) name = player ? `${player.first} ${player.last}` : playerTeam ? `${playerTeam.name} #${nav.player.n}` : '';
  else if (nav.match) name = home && away ? `${home.name} – ${away.name}` : '';
  const title = name ? `${name} · ${APP}` : APP;

  useEffect(() => {
    document.title = title;
  }, [title]);
  return name || APP;
}

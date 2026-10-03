import { followPref, useFollowed } from '../../features/matchList';
import { MatchDetail } from '../../features/match';
import { selectLoaded, useScoreline } from '../../store';
import { demoFollowed } from '../followed';
import { useNav } from '../nav/useNav';
import type { MatchRef } from '../nav/url';
import { Missing } from './Missing';

/** The match screen: the feature on the URL's tab, with the navigation. */
export function MatchScreen({ match, chrome }: { match: MatchRef; chrome: 'back' | 'none' }) {
  const nav = useNav();
  const loaded = useScoreline(selectLoaded);
  const followed = useFollowed(followPref(demoFollowed()));
  return (
    <MatchDetail
      id={match.id}
      tab={match.tab}
      chrome={chrome}
      onBack={nav.back}
      onTab={(tab) => nav.setTab(match.id, tab)}
      onOpenPlayer={(player, from) => nav.openPlayer(player, { under: match, from })}
      followed={followed}
      missing={<Missing back={chrome === 'back'} loaded={loaded} what="This match" />}
    />
  );
}

import { MatchDetail } from '../../features/match';
import { selectLoaded, useScoreline } from '../../store';
import { useNav } from '../nav/useNav';
import type { MatchRef } from '../nav/url';
import { LineupPlaceholder } from './LineupPlaceholder';
import { Missing } from './Missing';

/** The match screen: the feature on the URL's tab, with the navigation and Part 13's placeholder line-up. */
export function MatchScreen({ match, chrome }: { match: MatchRef; chrome: 'back' | 'none' }) {
  const nav = useNav();
  const loaded = useScoreline(selectLoaded);
  return (
    <MatchDetail
      id={match.id}
      tab={match.tab}
      chrome={chrome}
      onBack={nav.back}
      onTab={(tab) => nav.setTab(match.id, tab)}
      onOpenPlayer={(player, from) => nav.openPlayer(player, { under: match, from })}
      lineup={<LineupPlaceholder id={match.id} />}
      missing={<Missing back={chrome === 'back'} loaded={loaded} what="This match" />}
    />
  );
}

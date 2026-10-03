import { lazy, Suspense } from 'react';
import { followPref, useFollowed } from '../../features/matchList';
import { demoFollowed } from '../followed';
import { useNav } from '../nav/useNav';
import type { MatchRef } from '../nav/url';

const Insights = lazy(() => import('../../features/insights/Insights'));

/** Lazy desktop-only content; routing stays in the app, not in the feature. */
export function InsightsScreen({
  tab,
  match,
  onShowPlayer,
}: {
  tab: 'tables' | 'leaders';
  match: MatchRef | null;
  onShowPlayer: () => void;
}) {
  const nav = useNav();
  const followed = useFollowed(followPref(demoFollowed()));
  return (
    <Suspense
      fallback={
        <p role="status" style={{ margin: '106px 18px', color: 'var(--c-muted)' }}>
          Loading…
        </p>
      }
    >
      <Insights
        tab={tab}
        matchId={match?.id}
        followed={followed}
        onOpenPlayer={(player, matchId, from) => {
          onShowPlayer();
          nav.openPlayer(player, { under: { id: matchId, tab: match?.id === matchId ? match.tab : 'facts' }, from });
        }}
        onOpenGoal={(matchId, _event, from) => {
          // Goal-scene replay is connected by Parts 17/18; until then open its match's Facts.
          nav.openMatch(matchId, { tab: 'facts', from });
        }}
      />
    </Suspense>
  );
}

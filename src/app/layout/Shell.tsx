import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router';
import { selectFeaturedMatchId, selectLiveMatchIds, selectMatchIdOfTeam, useScoreline } from '../../store';
import { preloadRive } from '../../rive/preload';
import { canonicalPath, parseNav } from '../nav/url';
import { useLayoutMode } from './layoutMode';
import { ListPane } from './ListPane';
import { PhoneStack } from './PhoneStack';
import { resolve } from './resolve';
import { Stage } from './Stage';
import { ThreePane } from './ThreePane';
import { TwoPane } from './TwoPane';
import { useNavFocus } from './useNavFocus';
import { useMoments } from './useMoments';
import { useScreenTitle } from './useScreenTitle';
import { useSharedFlights } from './useSharedFlights';
import styles from './Shell.module.css';

/**
 * The app shell: one element for every route, so nothing under it remounts on navigation.
 * Layout is a function of route and width (ARCHITECTURE §6): the URL says what is open
 * (nav/url.ts), the width picks PhoneStack, TwoPane or ThreePane, and resolve.ts decides what
 * each pane shows. The list always renders first under the same key, so it never unmounts.
 */
export function Shell() {
  const location = useLocation();
  const navType = useNavigationType();
  const layout = useLayoutMode();
  const nav = useMemo(() => parseNav(location.pathname, location.search, location.state), [location.pathname, location.search, location.state]);
  const featured = useScoreline(selectFeaturedMatchId);
  const hasLiveMatch = useScoreline(selectLiveMatchIds).length > 0;
  useEffect(() => preloadRive(hasLiveMatch), [hasLiveMatch]);
  const teamMatch = useScoreline(selectMatchIdOfTeam(nav.player?.team ?? ''));
  const r = useMemo(() => resolve(nav, layout, { featured, teamMatch }), [nav, layout, featured, teamMatch]);

  // one spelling per screen: `/match/7` becomes `/match/7/facts` before it paints (the parse
  // above already reads both the same, so nothing changes on screen)
  const navigate = useNavigate();
  const canonical = canonicalPath(location.pathname);
  useLayoutEffect(() => {
    if (canonical !== null) void navigate(canonical + location.search, { replace: true, state: location.state });
  }, [canonical, location.search, location.state, navigate]);

  const root = useRef<HTMLElement>(null);
  const title = useScreenTitle(nav);
  const [said, setSaid] = useState('');
  const titleRef = useRef(title);
  useLayoutEffect(() => {
    titleRef.current = title;
  });
  const announce = useCallback(() => setSaid(titleRef.current), []);

  const moment = useMoments(r);

  useSharedFlights(r, location.key);
  useNavFocus(r, location.key, navType, root, announce);

  const phone = layout === 'phone';
  return (
    <main ref={root} className={styles.shell} data-layout={layout} data-testid="app-shell" aria-label="Scoreline">
      <ListPane key="list" layout={layout} shifted={phone && !!r.match} covered={phone && !!(r.match || r.player)} list={r.list} openId={r.match?.id} />
      {phone ? <PhoneStack key="phone" r={r} /> : layout === 'two' ? <TwoPane key="two" r={r} /> : <ThreePane key="three" r={r} />}
      {/* the phone plays toasts and scenes over everything; the panes play them inside (Part 18) */}
      {phone && <Stage key="stage" slot="all" />}
      <p key="announcer" className={styles.announcer} aria-live="polite">
        {said}
      </p>
      {/* goals, red cards, kick-offs and full time, as the MomentDirector delivers them (Part 17) */}
      <p key="moments" className={styles.announcer} role="status" aria-atomic="true" data-testid="moment-announcer">
        {moment ? <span key={moment.n}>{moment.text}</span> : null}
      </p>
    </main>
  );
}

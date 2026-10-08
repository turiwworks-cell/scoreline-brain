import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router';
import { demoMode } from '../../data';
import { selectFeaturedMatchId, selectLoaded, selectMatchIdOfTeam, selectMatchOrder, useScoreline } from '../../store';
import { afterPaint } from '../../rive/afterPaint';
import { warmPlayerPhoto } from '../../ui/photoManifest';
import { HERO } from '../../features/player/layout';
import { prepareScreen, preloadScreens } from '../screens/screenChunks';
import { canonicalPath, hrefOf, parseNav } from '../nav/url';
import { useLayoutMode } from './layoutMode';
import { ListPane } from './ListPane';
import { PhoneStack } from './PhoneStack';
import { RiveGate } from './RiveGate';
import { recoverDemoNav, resolve } from './resolve';
import { Stage } from './Stage';
import { ThreePane } from './ThreePane';
import { TwoPane } from './TwoPane';
import { useNavFocus } from './useNavFocus';
import { useMoments } from './useMoments';
import { useScreenTitle } from './useScreenTitle';
import styles from './Shell.module.css';

/**
 * The app shell: one element for every route, so nothing under it remounts on navigation.
 * Layout is a function of route and width (ARCHITECTURE §6): the URL says what is open
 * (nav/url.ts), the width picks PhoneStack, TwoPane or ThreePane, and resolve.ts decides what
 * each pane shows. The list always renders first under the same key, so it never unmounts.
 */
export function Shell() {
  useEffect(() => afterPaint(preloadScreens), []);
  const location = useLocation();
  const navType = useNavigationType();
  const layout = useLayoutMode();
  const routeNav = useMemo(() => parseNav(location.pathname, location.search, location.state), [location.pathname, location.search, location.state]);
  const loaded = useScoreline(selectLoaded);
  const matchIds = useScoreline(selectMatchOrder);
  const nav = loaded && demoMode(location.search) ? recoverDemoNav(routeNav, matchIds) : routeNav;
  const featured = useScoreline(selectFeaturedMatchId);
  const teamMatch = useScoreline(selectMatchIdOfTeam(nav.player?.team ?? ''));
  const r = resolve(nav, layout, { featured, teamMatch });
  const playerTeam = r.player?.team;
  const playerNumber = r.player?.n;
  useEffect(() => {
    if (playerTeam && playerNumber !== undefined) warmPlayerPhoto(playerTeam, playerNumber, `${HERO.w}px`);
  }, [playerTeam, playerNumber]);

  // one spelling per screen: `/match/7` becomes `/match/7/facts` before it paints (the parse
  // above already reads both the same, so nothing changes on screen)
  const navigate = useNavigate();
  const canonical = canonicalPath(location.pathname);
  useLayoutEffect(() => {
    if (nav !== routeNav) {
      // Replace the stale entry rather than push another one. Back/Forward can revisit older
      // entries; each is validated again against the current feed before its screen paints.
      void navigate(hrefOf(nav, location.search), { replace: true, state: null });
    } else if (canonical !== null) void navigate(canonical + location.search, { replace: true, state: location.state });
  }, [canonical, nav, routeNav, location.search, location.state, navigate]);

  const root = useRef<HTMLElement>(null);
  const title = useScreenTitle(nav);
  const [said, setSaid] = useState('');
  const titleRef = useRef(title);
  useLayoutEffect(() => {
    titleRef.current = title;
  });
  const announce = useCallback(() => setSaid(titleRef.current), []);

  const moment = useMoments(r);

  useNavFocus(r, location.key, navType, root, announce);

  const phone = layout === 'phone';
  // Rive (runtime, artwork, the word) starts once the first data is drawn and painted, not with the page. The gate keeps its state
  // in RiveGate, so opening it does not render the shell again.
  return (
    <RiveGate>
      <main ref={root} className={styles.shell} data-layout={layout} data-testid="app-shell" aria-label="Scoreline" onPointerDownCapture={(e) => prepareScreen(e.target)} onFocusCapture={(e) => prepareScreen(e.target)}>
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
    </RiveGate>
  );
}

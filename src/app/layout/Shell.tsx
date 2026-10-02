import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router';
import { selectFeaturedMatchId, selectMatchIdOfTeam, useScoreline } from '../../store';
import { parseNav } from '../nav/url';
import { useLayoutMode } from './layoutMode';
import { ListPane } from './ListPane';
import { PhoneStack } from './PhoneStack';
import { resolve } from './resolve';
import { ThreePane } from './ThreePane';
import { TwoPane } from './TwoPane';
import { useNavFocus } from './useNavFocus';
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
  const teamMatch = useScoreline(selectMatchIdOfTeam(nav.player?.team ?? ''));
  const r = useMemo(() => resolve(nav, layout, { featured, teamMatch }), [nav, layout, featured, teamMatch]);

  const root = useRef<HTMLElement>(null);
  const title = useScreenTitle(nav);
  const [said, setSaid] = useState('');
  const titleRef = useRef(title);
  useLayoutEffect(() => {
    titleRef.current = title;
  });
  const announce = useCallback(() => setSaid(titleRef.current), []);

  useSharedFlights(r, location.key);
  useNavFocus(r, location.key, navType, root, announce);

  const phone = layout === 'phone';
  return (
    <main ref={root} className={styles.shell} data-layout={layout} data-testid="app-shell" aria-label="Scoreline">
      <ListPane key="list" layout={layout} shifted={phone && !!r.match} covered={phone && !!(r.match || r.player)} list={r.list} openId={r.match?.id} />
      {phone ? <PhoneStack key="phone" r={r} /> : layout === 'two' ? <TwoPane key="two" r={r} /> : <ThreePane key="three" r={r} />}
      <p key="announcer" className={styles.announcer} aria-live="polite">
        {said}
      </p>
    </main>
  );
}

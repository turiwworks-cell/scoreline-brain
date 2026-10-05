import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { MatchEvent, Team } from '../../src/domain';
import { Momentum } from '../../src/features/match/Momentum';
import { MotionProvider } from '../../src/motion/MotionProvider';
import { IconSprite } from '../../src/ui/IconSprite';
import '../../src/styles/tokens.css';
import '../../src/styles/materials.css';
import '../../src/styles/global.css';

const home: Team = { id: 'fra', name: 'France', short: 'FRA', colors: ['#0055A4', '#EF4135'] };
const away: Team = { id: 'arg', name: 'Argentina', short: 'ARG', colors: ['#74ACDF', '#F6B40E'] };
const initial = Array.from({ length: 64 }, (_, i) => Math.sin(i * 0.31) * 0.65 + Math.sin(i * 0.73) * 0.2);
const fullSeries = [...initial, ...initial.slice(0, 27)];
const emptySeries: readonly number[] = [];
const initialGoals: readonly MatchEvent[] = [
  { id: 'france-12', seq: 1, kind: 'goal', side: 'home', minute: 12, name: 'Mbappé' },
  { id: 'argentina-38', seq: 2, kind: 'goal', side: 'away', minute: 38, name: 'Messi' },
];

export function Fixture() {
  const [clock, setClock] = useState(0);
  const [momentum, setMomentum] = useState(initial);
  const [events, setEvents] = useState(initialGoals);
  const scenario = new URLSearchParams(location.search).get('scenario');
  const finished = scenario === 'finished';
  const empty = scenario === 'empty';
  const minute = empty ? 0 : finished ? 94 : 63;
  useEffect(() => {
    const interval = setInterval(() => setClock((v) => v + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  return <MotionProvider><IconSprite />
    <main style={{ width: 390, maxWidth: '100%', margin: '24px auto' }}>
      <Momentum matchId={1} minute={minute} status={empty ? 'scheduled' : finished ? 'finished' : 'live'} home={home} away={away}
        momentum={empty ? emptySeries : finished ? fullSeries : momentum} events={empty ? [] : events} />
      <div style={{ margin: '32px 18px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <output aria-label="Parent clock">{clock}</output>
        <button onClick={() => setMomentum((v) => v.map((n) => -n))}>Update momentum</button>
        <button onClick={() => setEvents((v) => [...v, { id: 'new-goal', seq: 3, kind: 'goal', side: 'home', minute: 63 }])}>Add goal</button>
        <button onClick={() => setEvents((v) => v.map((e) => e.id === 'argentina-38' ? { ...e, cancelled: true } : e))}>Cancel goal</button>
      </div>
    </main>
  </MotionProvider>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);

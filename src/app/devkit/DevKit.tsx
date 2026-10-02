import { useState, type CSSProperties } from 'react';
import { Button, Glass, Icon, LiveDot, Pill, RoundButton, SoftLight, spotRadius, Tabs, Tag } from '../../ui';
import { Part7 } from './Part7';
import { Section } from './Section';
import styles from './DevKit.module.css';

/*
 * /dev/kit: every Part 6 material on one page, laid out at the Lua's phone width
 * (354 px of content between 18 px gutters) so it can be held up against the
 * Rive-era build at 390 and 1280.
 */

const COLOURS: [string, string, string][] = [
  ['BG', '--c-bg', '#000000'],
  ['SURF', '--c-surf', '#161616'],
  ['TEXT', '--c-text', '#F3F2EF'],
  ['MUTED', '--c-muted', '#85847F'],
  ['DIM', '--c-dim', '#43423F'],
  ['HAIR', '--c-hair', 'white 10 %'],
  ['LIVE', '--c-live', '#34E39A'],
  ['CARD', '--c-card', '#E7C94A'],
  ['RED', '--c-red', '#FF5A5A'],
  ['INK', '--c-ink', 'black 86 %'],
  ['INK_DARK', '--c-ink-dark', '#032616'],
  ['GLASS', '--c-glass', '#121212'],
];

const TYPE: [string, string, string, string][] = [
  // role, font token, tracking token, sample
  ['label · M 10.5 +0.16 caps', '--type-label', '--track-label', 'Live now'],
  ['tab · S 10.5 +0.16 caps', '--type-tab', '--track-label', 'Facts'],
  ['body · R 12', '--type-body', '--track-0', 'Off the ball, drifting into space'],
  ['tag · M 12.5', '--type-tag', '--track-0', '1 goal'],
  ['button · S 13', '--type-button', '--track-0', 'Show all 24 events'],
  ['row · M 15 −0.01', '--type-row', '--track-1', 'Argentina'],
  ['name · S 16 −0.01', '--type-name', '--track-1', 'Messi'],
  ['heading · S 17 −0.01', '--type-heading', '--track-1', 'Follow a player'],
  ['empty · R 20 −0.02', '--type-empty', '--track-2', 'Nothing in play.'],
  ['title · M 22 −0.03', '--type-title', '--track-3', 'France on top'],
  ['wordmark · M 25 −0.045', '--type-wordmark', '--track-45', 'scoreline'],
  ['hero · M 26 −0.035', '--type-hero', '--track-35', 'France'],
  ['time · L 40 −0.04', '--type-time', '--track-4', '20:45'],
  ['goal · B 46 −0.02', '--type-goal', '--track-2', 'GOAL'],
  ['score · L 60 −0.05', '--type-score', '--track-5', '2'],
  ['score-xl · L 86 −0.05', '--type-score-xl', '--track-5', '58′'],
];

const MATCH_TABS = [
  { id: 'facts', label: 'Facts' },
  { id: 'stats', label: 'Stats' },
  { id: 'lineup', label: 'Lineup' },
  { id: 'table', label: 'Table' },
] as const;
const DAY_TABS = [
  { id: 'sat', label: 'Sat 19' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
] as const;
const DESK_TABS = [
  { id: 'player', label: 'Player' },
  { id: 'tables', label: 'Tables' },
  { id: 'leaders', label: 'Leaders' },
] as const;

const v = (o: Record<string, string | number>) => o as CSSProperties;

function MenuGlyph() {
  return (
    <span className={styles.menu} aria-hidden="true">
      <span />
      <span />
    </span>
  );
}

export function DevKit() {
  const [tab, setTab] = useState<string>('facts');
  const [day, setDay] = useState<string>('today');
  const [desk, setDesk] = useState<string>('player');
  const [live, setLive] = useState(true);

  return (
    <main className={styles.kit} data-testid="dev-kit">
      <header className={styles.top}>
        <h1 className={styles.title}>Kit · Parts 6 and 7</h1>
        <p className={styles.note}>Tokens from tokens.css, recipes from materials.css, components and SVG primitives from src/ui.</p>
      </header>

      <div className={styles.grid}>
        <Section title="Header" note="The list header (luau:4602-4654): spectrum mark, wordmark, Live pill on glass, round menu button.">
          <div className={styles.header}>
            <span className={styles.mark} aria-hidden="true">
              <span style={{ background: 'var(--spectrum-2-v)', height: 16, marginTop: 6 }} />
              <span style={{ background: 'var(--spectrum-3-v)', height: 22 }} />
              <span style={{ background: 'var(--spectrum-5-v)', height: 12, marginTop: 4 }} />
            </span>
            <span className={styles.wordmark}>scoreline</span>
            <button type="button" className={`m-glass ${styles.livePill}`} aria-pressed={live} onClick={() => setLive((x) => !x)}>
              <span className={live ? `${styles.liveIn} ${styles.liveOn}` : styles.liveIn}>
                <LiveDot pulse={!live} ink={live} />
                <span>Live</span>
              </span>
              <span className={styles.count}>5</span>
            </button>
            <RoundButton aria-label="Menu">
              <MenuGlyph />
            </RoundButton>
          </div>
        </Section>

        <Section title="Colours" note="luau:1025-1030">
          <ul className={styles.swatches}>
            {COLOURS.map(([name, token, hex]) => (
              <li key={name}>
                <span className={styles.chip} style={{ background: `var(${token})` }} />
                <span className={styles.swName}>{name}</span>
                <span className={styles.swHex}>{hex}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Spectrum" note="The 5 brand gradients, STOPS 1-5 (luau:1031-1037), across and down.">
          <div className={styles.spectra}>
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className={styles.spectrumRow}>
                <span className={styles.spectrumN}>{n}</span>
                <span className={styles.bar} style={{ background: `var(--spectrum-${n})` }} />
              </div>
            ))}
          </div>
          <div className={styles.columns}>
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} style={{ background: `var(--spectrum-${n}-v)` }} />
            ))}
          </div>
          <p className={`m-spectrum-text ${styles.gradWord}`}>Ongoing</p>
        </Section>

        <Section title="Type scale" note="Hanken Grotesk at the Lua's sizes. L 300 · R 400 · M 500 · S 600 · B 700.">
          <ul className={styles.type}>
            {TYPE.map(([role, font, track, sample]) => (
              <li key={role}>
                <span className={styles.typeRole}>{role}</span>
                <span
                  className={styles.typeSample}
                  style={{ font: `var(${font})`, letterSpacing: `var(${track})`, textTransform: role.includes('caps') ? 'uppercase' : undefined }}
                >
                  {sample}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Glass" note="Dark pane, sheen, 1 px rim brighter at the bottom (luau:3228-3308). Thin over pictures.">
          <Glass radius={24} className={styles.followCard} lit>
            <span className={styles.cardEyebrow}>Lionel</span>
            <span className={styles.cardName}>Messi</span>
            <span className={styles.cardSub}>vs France</span>
            <Pill size="sm" thin icon={<Tag kind="goal" size={14} />}>
              39′
            </Pill>
          </Glass>
          <div className={styles.photo}>
            <Glass thin radius={16} className={styles.thinPane}>
              <span className={styles.cardSub}>Thin glass (body 0.7) over a picture</span>
            </Glass>
          </div>
          <div className={styles.row}>
            <Glass radius={14} className={styles.swatchPane} />
            <Glass radius={20} className={styles.swatchPane} />
            <Glass radius={14} tint="#0b2b1d" className={styles.swatchPane} />
          </div>
          <Glass radius={16} tint="#0b2b1d" className={styles.tintedCard} data-testid="tinted-card">
            <span className={styles.cardSub}>Tinted pane, plain glass pill inside</span>
            <Pill size="md" data-testid="nested-pill">
              Untinted
            </Pill>
          </Glass>
        </Section>

        <Section title="SoftLight" note="(1 − t²)³ fall-off over 25 stops, core mixed toward white (luau:3310-3336). No banding, no noise.">
          <div className={styles.lightBox}>
            <SoftLight color="#74acdf" alpha={0.5} cx={177} cy={150} rx={330} ry={340} />
            <span className={styles.lightNum}>10</span>
          </div>
          <div className={styles.horizon}>
            {/* the line of light under the player (horizon, luau:5862-5872): tint = mix(c1, white, 0.45) */}
            <SoftLight color="#b3d1ed" alpha={0.42} cx={177} cy={90} rx={235} ry={72} style={{ height: 90 }} />
            <SoftLight color="#b3d1ed" alpha={0.2} cx={177} cy={0} rx={190} ry={28} style={{ top: 90, height: 40 }} />
            <span className={styles.horizonLine} />
          </div>
          <div className={styles.row}>
            <div className={styles.lightTile}>
              <SoftLight color="#0055a4" alpha={0.55} cx={30} cy={120} rx={150} ry={90} />
            </div>
            <div className={styles.lightTile}>
              <SoftLight color="#ff2d2d" alpha={0.5} cx={30} cy={120} rx={150} ry={90} />
            </div>
          </div>
        </Section>

        <Section title="Hover light" note="A soft white spot that follows the cursor inside the control, with a brighter catch on the rim. --mx / --my are written from pointermove; React never sees them.">
          <Glass lit radius={22} className={styles.hoverPad} data-testid="hover-pad">
            <span className={styles.cardSub}>Move the pointer over this pane</span>
          </Glass>
          <p className={styles.note}>Frozen at full light, for screenshots:</p>
          <div className={styles.row}>
            <Glass radius={22} className={`m-feel ${styles.frozen}`} style={v({ '--lit': 1, '--mx': '48px', '--my': '30px', '--spot-r': `${spotRadius(140, 64)}px` })} />
            <Button label="Lit button" minWidth={110} style={v({ '--lit': 1, '--mx': '40px', '--my': '12px', '--spot-r': `${spotRadius(110, 36)}px` })} />
            <RoundButton aria-label="Lit menu" style={v({ '--lit': 1, '--mx': '14px', '--my': '12px', '--spot-r': `${spotRadius(40, 40)}px` })}>
              <MenuGlyph />
            </RoundButton>
          </div>
        </Section>

        <Section title="Button" note="Glass pill (36 px) and round (40 px). Press: 5 % dip, label rolls letter by letter (luau:3339-3454).">
          <div className={styles.row}>
            <Button label="Show all 24 events" />
            <Button label="Show less" />
          </div>
          <div className={styles.row}>
            <RoundButton aria-label="Menu">
              <MenuGlyph />
            </RoundButton>
            <RoundButton aria-label="Follow">
              <Icon name="follow" />
            </RoundButton>
            <Button label="Pressed" style={v({ '--dip': 1, '--mx': '40px', '--my': '18px' })} />
            <Button label="Change" height={30} />
          </div>
        </Section>

        <Section title="Pill" note="Glass capsules at the Lua's sizes: label 24, sm 24, md 28, lg 30. Live and spectrum tones.">
          <div className={styles.row}>
            <Pill size="label">Kick-off</Pill>
            <Pill size="label">Half-time · 1–0</Pill>
          </div>
          <div className={styles.row}>
            <Pill size="sm" icon={<Tag kind="goal" size={14} />}>
              39′
            </Pill>
            <Pill size="md" icon={<Tag kind="goal" size={16} />}>
              1 goal
            </Pill>
            <Pill size="lg" icon={<Tag kind="subOut" size={16} />}>
              Off 72′
            </Pill>
          </div>
          <div className={styles.row}>
            <Pill tone="live" icon={<LiveDot ink />}>
              Live
            </Pill>
            <Pill icon={<LiveDot pulse />}>Live</Pill>
            <Pill tone="spectrum">Player</Pill>
          </div>
        </Section>

        <Section title="Tabs" note="Sliding spectrum indicator. Line (match tabs, rolls), day (word-wide bar), segment (desktop pane switch).">
          <Tabs aria-label="Match" items={MATCH_TABS} value={tab} onChange={setTab} />
          <div className={styles.gap} />
          <Tabs aria-label="Day" variant="day" items={DAY_TABS} value={day} onChange={setDay} />
          <div className={styles.gap} />
          <Tabs aria-label="Insights" variant="segment" items={DESK_TABS} value={desk} onChange={setDesk} className={styles.segment} />
        </Section>
      </div>

      <Part7 />
    </main>
  );
}

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { m, useMotionValueEvent, useTransform, type MotionValue } from 'motion/react';
import { minText } from '../../domain';
import { bez, clamp, CURVES, ease, goalLetters, lerp, prog, timing, type MomentDirector, type Presentation, type Timing } from '../../motion';
import { Crest, Icon, KitDisc, matchStops, mix, pastel, RoundButton, SoftLight, Star, textWidth, useFontVersion, type PhotoSources } from '../../ui';
import {
  BUST_K,
  BUST_LIFT,
  BUST_SRC,
  DESIGN_FLOOR,
  FLASH,
  FLOOR_FROM_BOTTOM,
  HIT,
  LAND,
  NAME_AFTER,
  SCENE_FADE_IN,
  SCENE_FADE_OUT,
  SHAKE,
  SLAM,
  SLAM_WORD,
  SLASHES,
  WALL,
  WORDS,
  wordWidth,
} from './choreo';
import type { MomentInfo } from './model';
import { useStageTime } from './useStageTime';
import { Word } from './Word';
import styles from './Moments.module.css';

/*
 * The goal and red card scenes (goalScene / redScene / sceneStory, luau:6423-6656), in the DOM.
 * Every element is a function of the scene's time, read from the director's clock each frame,
 * with the Lua's own formulas: a first tap moves the start back and everything lands at once.
 *
 * Goal: the team's flash; the flag over GOAAAL in the middle, which then rise to the top; a wall of
 * four cards in the match's colours rises behind the scorer, who comes up on the floor; his name
 * and the commentary come in under it; the score strip rolls the new digit.
 * Red card: the hit (shake, strobes, slashes), the card slamming in, RED CARD, then the same
 * story; the card flies to the top corner.
 *
 * The word is a plain DOM stand-in (Word.tsx) until Rive's GoalWord (Parts 19-20).
 */

export type SceneProps = {
  p: Presentation;
  info: MomentInfo;
  d: MomentDirector;
  photo: PhotoSources | undefined;
  followed: boolean;
};

interface Geo {
  W: number;
  H: number;
  floor: number;
  /** centre-stage heights scale with the floor */
  ky: number;
  cx: number;
}

const geoOf = (W: number, H: number): Geo => {
  const floor = Math.max(H - FLOOR_FROM_BOTTOM, 320);
  return { W, H, floor, ky: floor / DESIGN_FLOOR, cx: W / 2 };
};

/** The scene's box, measured before paint and on resize (390 × 844 where nothing lays out, as in tests). */
function useBox(ref: RefObject<HTMLElement | null>): Geo {
  const [size, setSize] = useState<[number, number]>([390, 844]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setSize((s) => (s[0] === r.width && s[1] === r.height ? s : [r.width, r.height]));
    };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return geoOf(size[0], size[1]);
}

export function Scene({ p, info, d, photo, followed }: SceneProps) {
  useFontVersion();
  const root = useRef<HTMLDivElement>(null);
  const g = useBox(root);
  const { t, out } = useStageTime(p, d.clock);
  const [T] = useState(() => timing('goal'));
  const red = p.variant === 'red';

  // the scene fades in over 0.2 s and out over 0.4 s (drawScene, luau:6662)
  const base = useTransform(() => prog(t.get(), 0, SCENE_FADE_IN) * (out.get() >= 0 ? 1 - prog(out.get(), 0, SCENE_FADE_OUT) : 1));

  // Escape closes it, like the close button
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) d.dismiss(p.key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [d, p.key]);

  const title = `${red ? 'Red card' : 'Goal'}: ${info.n > 0 ? `${info.last}, ` : ''}${info.team.name}, ${minText(info.minute)}`;
  return (
    <div
      ref={root}
      className={styles.scene}
      data-testid="moment-scene"
      data-variant={p.variant}
      data-phase={p.phase}
      onClick={() => d.tap(p.key)}
      role="group"
      aria-label={title}
    >
      <m.div className={styles.sceneFade} style={{ opacity: base }}>
        {/* keyed by the box: a resize lays the choreography out again */}
        <div key={`${g.W}x${g.H}`} className={styles.sceneArt} aria-hidden="true">
          {red ? <RedArt t={t} T={T} p={p} info={info} g={g} photo={photo} followed={followed} /> : <GoalArt t={t} T={T} p={p} info={info} g={g} photo={photo} followed={followed} />}
        </div>
        <RoundButton
          className={styles.sceneClose}
          aria-label={red ? 'Close red card' : 'Close goal'}
          onClick={(e) => {
            e.stopPropagation();
            d.dismiss(p.key);
          }}
        >
          <Icon name="close" />
        </RoundButton>
      </m.div>
    </div>
  );
}

type ArtProps = { t: MotionValue<number>; T: Timing; p: Presentation; info: MomentInfo; g: Geo; photo: PhotoSources | undefined; followed: boolean };

/** bez(T.c, prog(t, at, T.dur)) as a motion value. */
function useBeat(t: MotionValue<number>, T: Timing, at: number, dur = T.duration) {
  return useTransform(() => bez(T.ease, prog(t.get(), at, dur)));
}

const WARM = '#F7F2EA';

function GoalArt({ t, T, p, info, g, photo, followed }: ArtProps) {
  const B = p.beats!;
  const c1 = info.team.colors[0];
  const u = useBeat(t, T, B.up);
  const pS = useBeat(t, T, B.delay);
  const stops = matchStops(info.home, info.away);

  // the stage light behind the scorer, sinking toward the floor as the headline rises
  const lightBoxTop = 120;
  const light0 = 380 * g.ky;
  const lightY = useTransform(() => lerp(light0, g.floor - 120, u.get()) - light0);

  // the headline: the flag over GOAAAL, centre stage, then both rise to the top
  const { gap, land } = goalLetters();
  const w100 = wordWidth('GOAAAL', 100) / 100;
  const fitTo = (s: number) => Math.min(s, (g.W - 64) / w100);
  const size0 = fitTo(104);
  const size1 = fitTo(72);
  const base0 = 436 * g.ky;
  const landed = B.delay + 5 * gap + land * 0.55;
  const settle = land + 5 * gap + T.duration;
  const wordMid = useTransform(() => {
    const size = lerp(size0, size1, u.get());
    return lerp(base0, 196, u.get()) - size * 0.35;
  });
  const wordScale = useTransform(() => (lerp(size0, size1, u.get()) / size0) * lerp(1.08, 1, bez(LAND, prog(t.get(), B.delay, settle))));
  const wordY = useTransform(() => wordMid.get() - size0 / 2);
  const flare = useTransform(() => prog(t.get(), landed - 0.1, 0.25) * (1 - 0.55 * ease(CURVES.inout, t.get(), landed + 0.15, 0.9)));
  const flareScale = useTransform(() => 0.8 + 0.2 * flare.get());
  const flareY = useTransform(() => wordMid.get() - 170);

  const flagX = useTransform(() => lerp(g.cx, 38, u.get()) - 32);
  const flagY = useTransform(() => lerp(318 * g.ky, 72, u.get()) - 32);
  const flagS = useTransform(() => (lerp(64, 40, u.get()) / 64) * lerp(0.6, 1, pS.get()));

  const flash = useTransform(() => FLASH.alpha * (1 - ease(CURVES.ease, t.get(), 0, FLASH.dur)));
  const pTop = useBeat(t, T, B.up + T.duration * 0.3);
  const roll = useBeat(t, T, B.commentary);

  const gs = `${pastel(c1)} 0%, ${pastel(mix(info.team.colors[1], WARM, 0.25))} 55%, ${pastel(c1)} 100%`;

  return (
    <>
      <m.div className={styles.clip} style={{ top: lightBoxTop, height: g.floor - lightBoxTop, opacity: pS }}>
        <m.div className={styles.fill} style={{ y: lightY }}>
          <SoftLight color={c1} alpha={0.6} cx={g.cx} cy={light0 - lightBoxTop} rx={165} ry={160} />
        </m.div>
      </m.div>
      {/* the wall behind him: four cards in the match's colours, rising one after another; on a
          shorter stage it shortens with the floor, so it never reaches the headline */}
      <div className={styles.clip} style={{ top: 0, height: g.floor }}>
        {WALL.heights.map((h, i) => (
          <WallCard key={i} t={t} T={T} i={i} g={g} hh={h * WALL.tall * Math.min(g.ky, 1)} at={B.player - WALL.lead + i * T.duration * WALL.step} stops={stops} />
        ))}
        <Bust t={t} T={T} at={B.player} g={g} info={info} photo={photo} />
      </div>
      <Story t={t} T={T} p={p} info={info} g={g} followed={followed} red={false} line={`linear-gradient(90deg, ${stops.join(', ')})`} />
      {/* the headline */}
      <m.div className={styles.flag} style={{ x: flagX, y: flagY, scale: flagS, opacity: pS }}>
        <Crest team={info.team} size={64} />
      </m.div>
      <m.div className={styles.flare} style={{ y: flareY, opacity: flare, scale: flareScale }}>
        <SoftLight color={pastel(c1)} alpha={0.55} cx="50%" cy={170} rx={115} ry={65} />
      </m.div>
      <m.div className={styles.word} style={{ y: wordY, height: size0, scale: wordScale }}>
        <Word word="GOAAAL" size={size0} t={t} t0={B.delay} gap={gap} land={land} curve={LAND} mode="shout" stops={gs} glow={pastel(c1)} />
      </m.div>
      {/* once at the top: who scored, and the score */}
      <m.div className={styles.topLine} style={{ left: 68, opacity: pTop }}>
        <span className={styles.topName}>{info.team.name}</span>
        <span className={styles.topSub}>Scores · {minText(info.minute)}</span>
      </m.div>
      <m.div className={styles.strip} style={{ opacity: pTop }}>
        <ScoreStrip info={info} roll={roll} rolls />
      </m.div>
      <m.div className={styles.flash} style={{ background: c1, opacity: flash }} />
    </>
  );
}

function RedArt({ t, T, p, info, g, photo, followed }: ArtProps) {
  const B = p.beats!;
  const u = useBeat(t, T, B.up);
  // shake: hard on the hit, then gone
  const shake = (f: number, trig: (x: number) => number) => {
    const v = t.get();
    const sh = v > HIT && v < HIT + SHAKE.len ? SHAKE.amp * Math.exp(-(v - HIT) * SHAKE.decay) : 0;
    return sh * trig(v * f);
  };
  const jx = useTransform(() => shake(SHAKE.fx, Math.sin));
  const jy = useTransform(() => shake(SHAKE.fy, Math.cos));
  const lightA = useTransform(() => 1 - 0.35 * u.get());

  // the card: slams in huge and spinning, lands, then flies to the top corner
  const pIn = useTransform(() => bez(SLAM, prog(t.get(), 0.02, HIT)));
  const cardS = useTransform(() => lerp(lerp(2.8, 1, pIn.get()), 0.22, u.get()));
  const cardR = useTransform(() => `${lerp(lerp(-0.9, -0.16, pIn.get()), -0.08, u.get())}rad`);
  const cardX = useTransform(() => lerp(g.cx, 30, u.get()) - 75);
  const cardY = useTransform(() => lerp(316 * g.ky, 72, u.get()) - 107);
  const cardO = useTransform(() => clamp(pIn.get() * 2, 0, 1));

  // RED CARD: letters slam in after the hit, then rise to the top with the card
  const w100 = wordWidth('RED CARD', 100) / 100;
  const fitTo = (s: number) => Math.min(s, (g.W - 44) / w100);
  const size0 = fitTo(70);
  const size1 = fitTo(56);
  const base0 = 500 * g.ky;
  const wordY = useTransform(() => lerp(base0, 196, u.get()) - lerp(size0, size1, u.get()) * 0.35 - size0 / 2);
  const wordScale = useTransform(() => lerp(size0, size1, u.get()) / size0);

  const pTop = useBeat(t, T, B.up + T.duration * 0.3);
  // red strobes: the hit, and twice more
  const strobe = useTransform(() => {
    const v = t.get();
    if (v < HIT && v > 0.18) return 0;
    return 0.9 * Math.max(1 - ease(CURVES.ease, v, 0, 0.18), 0.85 * (1 - ease(CURVES.ease, v, HIT, 0.4)), 0.45 * (1 - ease(CURVES.ease, v, HIT + 0.22, 0.25)));
  });

  return (
    <>
      <m.div className={styles.fill} style={{ x: jx, y: jy }}>
        <m.div className={styles.clip} style={{ top: 0, height: g.floor, opacity: lightA }}>
          <SoftLight color="#B3141B" alpha={0.75} cx={g.cx} cy={340 * g.ky} rx={180} ry={210} />
        </m.div>
        {Array.from({ length: SLASHES.n }, (_, i) => (
          <Slash key={i} t={t} i={i} g={g} />
        ))}
        <div className={styles.clip} style={{ top: 0, height: g.floor }}>
          <Bust t={t} T={T} at={B.player} g={g} info={info} photo={photo} />
        </div>
        <Story t={t} T={T} p={p} info={info} g={g} followed={followed} red line="linear-gradient(90deg, #FF2D2D, #8E0A10)" />
        <m.div className={styles.bigCard} style={{ x: cardX, y: cardY, scale: cardS, rotate: cardR, opacity: cardO }} />
        <m.div className={styles.word} style={{ y: wordY, height: size0, scale: wordScale }}>
          <Word word="RED CARD" size={size0} t={t} t0={HIT + SLAM_WORD.after} gap={SLAM_WORD.gap} land={T.duration} curve={T.ease} mode="slam" stops="#FF6A5E 0%, #FF2D2D 50%, #C2101A 100%" />
        </m.div>
        <m.div className={styles.topCrest} style={{ opacity: pTop }}>
          <Crest team={info.team} size={22} />
        </m.div>
        <m.div className={styles.topLine} style={{ left: 90, opacity: pTop }}>
          <span className={styles.topName}>{info.team.name}</span>
          <span className={styles.topSub}>Down to ten · {minText(info.minute)}</span>
        </m.div>
        <m.div className={styles.strip} style={{ opacity: pTop }}>
          <ScoreStrip info={info} roll={pTop} rolls={false} />
        </m.div>
      </m.div>
      <m.div className={styles.flash} style={{ background: '#FF1E1E', opacity: strobe }} />
    </>
  );
}

function WallCard({ t, T, i, g, hh, at, stops }: { t: MotionValue<number>; T: Timing; i: number; g: Geo; hh: number; at: number; stops: readonly string[] }) {
  const cw = (g.W - 2 * WALL.side - 3 * WALL.gap) / 4;
  const q = useTransform(() => prog(t.get(), at, T.duration * WALL.rise));
  const y = useTransform(() => hh * (1 - bez(LAND, q.get())));
  const shown = useTransform(() => (q.get() > 0 ? 0.94 : 0));
  // the landing: a flash along the top edge, gone in a moment
  const flash = useTransform(() => {
    const lt = t.get() - at - T.duration * WALL.rise * 0.22;
    return lt > -0.08 ? Math.exp(-((lt / WALL.flash) ** 2)) : 0;
  });
  const style: CSSProperties = { left: WALL.side + i * (cw + WALL.gap), top: g.floor - hh, width: cw, height: hh, background: `linear-gradient(180deg, ${stops[0]} 0%, ${stops[1]} 42%, ${stops[2]} 62%, ${stops[3]} 100%)` };
  return (
    <m.div className={styles.wallCard} style={{ ...style, y, opacity: shown }}>
      <span className={styles.wallSheen} />
      <m.span className={styles.wallFlash} style={{ opacity: flash }} />
    </m.div>
  );
}

/** The slashes lean -0.38 rad (luau:6616), in degrees for Motion. */
const SLASH_TURN = (-0.38 * 180) / Math.PI;

function Slash({ t, i, g }: { t: MotionValue<number>; i: number; g: Geo }) {
  const q = useTransform(() => prog(t.get(), HIT + i * SLASHES.gap, SLASHES.len));
  const x = useTransform(() => lerp(-260, g.W + 40, bez(CURVES.glide, q.get())));
  const o = useTransform(() => (q.get() > 0 && q.get() < 1 ? 0.55 * (1 - q.get()) : 0));
  return <m.div className={styles.slash} style={{ top: (160 + i * 120) * g.ky, height: 5 - i, x, rotate: SLASH_TURN, opacity: o }} />;
}

/** The scorer rising behind the floor (sceneStory, luau:6423). */
function Bust({ t, T, at, g, info, photo }: { t: MotionValue<number>; T: Timing; at: number; g: Geo; info: MomentInfo; photo: PhotoSources | undefined }) {
  const [failed, setFailed] = useState(false);
  const pB = useTransform(() => bez(T.ease, prog(t.get(), at, T.duration)));
  const lift = useTransform(() => BUST_LIFT * (1 - pB.get()));
  const o = useTransform(() => clamp(pB.get() * 1.6, 0, 1));
  const dw = BUST_SRC.w * BUST_K;
  const dh = BUST_SRC.h * BUST_K;
  if (photo && !failed) {
    const w = 288 * BUST_K;
    return (
      <m.div className={styles.bust} style={{ left: g.cx - dw / 2, top: g.floor - dh, width: dw, height: dh, y: lift, opacity: o }}>
        <picture>
          {photo.sources.map((s) => (
            <source key={s.type} type={s.type} srcSet={s.srcSet} sizes={`${w}px`} />
          ))}
          <img
            src={photo.src}
            srcSet={photo.srcSet}
            sizes={`${w}px`}
            width={w}
            height={360 * BUST_K}
            alt=""
            decoding="async"
            draggable={false}
            style={{ left: -BUST_SRC.x * BUST_K, top: -BUST_SRC.y * BUST_K }}
            onError={() => setFailed(true)}
          />
        </picture>
      </m.div>
    );
  }
  if (info.n <= 0) return null;
  return (
    <m.div className={styles.bust} style={{ left: g.cx - 84, top: g.floor - 110 - 84, width: 168, height: 168, y: lift, opacity: o }}>
      <KitDisc team={info.team} n={info.n} size={168} />
    </m.div>
  );
}

/** Under the floor: the line, his name, the minute and assist, and the commentary (luau:6441-6495). */
function Story({ t, T, p, info, g, followed, red, line }: { t: MotionValue<number>; T: Timing; p: Presentation; info: MomentInfo; g: Geo; followed: boolean; red: boolean; line: string }) {
  const B = p.beats!;
  const pF = useBeat(t, T, B.player);
  const pN = useBeat(t, T, B.player + NAME_AFTER);
  const nameY = useTransform(() => 18 * (1 - pN.get()));
  const pC = useBeat(t, T, B.commentary);
  const cY = useTransform(() => 10 * (1 - pC.get()));
  const maxW = g.W - 36;
  const lastSize = Math.min(40, (40 * maxW) / Math.max(textWidth(600, 40, -0.03, info.last), 1));
  const dot = <span className={styles.muted}>·</span>;
  let meta: ReactNode = null;
  if (red) {
    meta = (
      <>
        {dot}
        <span className={styles.red}>Sent off</span>
      </>
    );
  } else if (info.assist) {
    meta = (
      <>
        {dot}
        <span className={styles.muted}>Assist {info.assist}</span>
      </>
    );
  }
  return (
    <div className={styles.floor} style={{ top: g.floor }}>
      <m.span className={styles.floorLine} style={{ background: line, scaleX: pF }} />
      <m.div className={styles.story} style={{ y: nameY, opacity: pN }}>
        <span className={styles.first}>{info.first || ' '}</span>
        <span className={styles.last} style={{ fontSize: lastSize }}>
          {info.last}
        </span>
        <span className={styles.meta}>
          <span className={red ? styles.red : styles.live}>{minText(info.minute)}</span>
          {meta}
          {followed && (
            <>
              {dot}
              <Star className={styles.metaStar} />
              <span className={styles.text}>Your player</span>
            </>
          )}
        </span>
      </m.div>
      {info.commentary && (
        <m.div className={styles.commentary} style={{ y: cY, opacity: pC }}>
          <span className={styles.commentaryHead}>
            <span className={styles.commentaryBar} style={{ background: red ? 'var(--c-red)' : 'var(--c-text)' }} />
            <span className={styles.muted}>Commentary</span>
          </span>
          <Words text={info.commentary} t={t} at={B.commentary + WORDS.after} />
        </m.div>
      )}
    </div>
  );
}

/** The commentary, word by word over 1.4 s (luau:6482). */
function Words({ text, t, at }: { text: string; t: MotionValue<number>; at: number }) {
  const words = text.split(/\s+/).filter(Boolean);
  const count = (v: number) => Math.min(words.length, Math.floor(words.length * prog(v, at, WORDS.over) + 0.999));
  const [shown, setShown] = useState(() => count(t.get()));
  useMotionValueEvent(t, 'change', (v) => setShown(count(v)));
  return (
    <p className={styles.commentaryText}>
      {words.map((w, i) => (
        <span key={i} style={i < shown ? undefined : { visibility: 'hidden' }}>
          {w}{' '}
        </span>
      ))}
    </p>
  );
}

/** The score strip, top right; on a goal the new digit rolls in (scoreStrip, luau:6497). */
function ScoreStrip({ info, roll, rolls }: { info: MomentInfo; roll: MotionValue<number>; rolls: boolean }) {
  const homeRolls = rolls && info.side === 'home' && info.before[0] !== info.score[0];
  const awayRolls = rolls && info.side === 'away' && info.before[1] !== info.score[1];
  return (
    <>
      <Crest team={info.home} size={18} />
      <Digit prev={info.before[0]} cur={info.score[0]} rolls={homeRolls} roll={roll} />
      <span className={styles.dash}>–</span>
      <Digit prev={info.before[1]} cur={info.score[1]} rolls={awayRolls} roll={roll} />
      <Crest team={info.away} size={18} />
    </>
  );
}

function Digit({ prev, cur, rolls, roll }: { prev: number; cur: number; rolls: boolean; roll: MotionValue<number> }) {
  const y = useTransform(() => (rolls ? -26 * roll.get() : -26));
  return (
    <span className={styles.digit}>
      <m.span className={styles.digitCol} style={{ y }}>
        <span>{rolls ? prev : ''}</span>
        <span>{cur}</span>
      </m.span>
    </span>
  );
}

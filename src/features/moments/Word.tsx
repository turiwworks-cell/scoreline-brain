import { memo } from 'react';
import { m, useTransform, type MotionValue } from 'motion/react';
import { bez, clamp, lerp, prog } from '../../motion';
import { textWidth } from '../../ui';
import { WORD_TRACK, WORD_WEIGHT as WEIGHT, wordWidth } from './choreo';

/*
 * The headline word, in plain DOM: a stand-in until Rive's GoalWord lands (Parts 19 and 20,
 * ARCHITECTURE §3). The container that holds it moves it (Scene.tsx); this only draws the letters
 * landing, the way shoutWord / slamWord do (luau:6323-6422):
 * - `shout` (GOAAAL): each letter comes in big and soft in the team's light and lands sharp,
 *   `gap` apart, each over `land`; the whole word settles from 1.08.
 * - `slam` (RED CARD): each letter slams in from 1.4×, `gap` apart, each over `land`.
 * The fill runs across the whole word (stopsPaint over the word's advance).
 */


export type WordProps = {
  word: string;
  /** px; the caller has already fitted it to the width */
  size: number;
  t: MotionValue<number>;
  /** seconds the first letter starts */
  t0: number;
  gap: number;
  land: number;
  curve: readonly [number, number, number, number];
  mode: 'shout' | 'slam';
  /** CSS gradient stops for the fill, across the word */
  stops: string;
  /** shout: the colour of a letter still arriving */
  glow?: string;
};

export const Word = memo(function Word({ word, size, t, t0, gap, land, curve, mode, stops, glow }: WordProps) {
  const width = wordWidth(word, size);
  const letters = [...word];
  let i = 0;
  return (
    <span style={{ display: 'inline-flex', fontSize: size, fontWeight: WEIGHT, letterSpacing: `${WORD_TRACK}em`, lineHeight: 1, whiteSpace: 'pre' }} aria-hidden="true">
      {letters.map((ch, k) => {
        const offset = textWidth(WEIGHT, size, WORD_TRACK, word.slice(0, k));
        const at = t0 + (ch === ' ' ? i : i++) * gap;
        return ch === ' ' ? (
          <span key={k}> </span>
        ) : (
          <Letter key={k} ch={ch} t={t} at={at} land={land} curve={curve} mode={mode} stops={stops} glow={glow} width={width} offset={offset} />
        );
      })}
    </span>
  );
});

type LetterProps = { ch: string; t: MotionValue<number>; at: number; land: number; curve: WordProps['curve']; mode: WordProps['mode']; stops: string; glow?: string; width: number; offset: number };

function Letter({ ch, t, at, land, curve, mode, stops, glow, width, offset }: LetterProps) {
  const pL = useTransform(() => bez(curve, prog(t.get(), at, land)));
  const shout = mode === 'shout';
  const scale = useTransform(() => lerp(shout ? 1.85 : 1.4, 1, pL.get()));
  const alpha = useTransform(() => clamp(pL.get() * (shout ? 2.4 : 1.8), 0, 1));
  const focus = useTransform(() => (shout ? clamp((pL.get() - 0.3) / 0.6, 0, 1) : 1));
  const sharp = useTransform(() => alpha.get() * focus.get());
  const soft = useTransform(() => alpha.get() * (1 - focus.get()));
  const blur = useTransform(() => `blur(${((1 - focus.get()) * 7).toFixed(2)}px)`);
  const fill = {
    backgroundImage: `linear-gradient(90deg, ${stops})`,
    backgroundSize: `${width}px 100%`,
    backgroundPosition: `${-offset}px 0`,
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    color: 'transparent',
  } as const;
  return (
    <m.span style={{ position: 'relative', display: 'inline-block', scale, transformOrigin: '50% 60%' }}>
      {shout && glow && (
        <m.span style={{ position: 'absolute', inset: 0, color: glow, opacity: soft, filter: blur }} aria-hidden="true">
          {ch}
        </m.span>
      )}
      <m.span style={{ ...fill, display: 'inline-block', opacity: sharp }}>{ch}</m.span>
    </m.span>
  );
}

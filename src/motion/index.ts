// Public surface of the motion core (Part 9). Features import from here.
export {
  CURVES,
  holds,
  motionTokens,
  MOTION_DEF,
  resetMotion,
  timing,
  TIMING_DEF,
  TIMING_KEYS,
  tuneMotion,
  type Bezier,
  type MotionGlobals,
  type MotionPatch,
  type MotionTokens,
  type Timing,
  type TimingDef,
  type TimingKey,
} from './tokens';
export { AT_REST, CASCADE, cascade, drawn, HAIR, LANDED, LAYER, paneSwap, playerPage, pushBase, pushLayer, scrim, sheetRise, slide, transition, type CascadeOptions, type TransitionOptions } from './variants';
export { play, stop, type PlayOptions } from './play';
export { useAfterPaint } from './afterPaint';
export { MotionProvider } from './MotionProvider';
export { bez, clamp, ease, env, lerp, prog } from './curve';
export * from './moments';

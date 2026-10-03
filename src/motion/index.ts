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
export { CASCADE, cascade, LAYER, paneSwap, playerPage, pushBase, pushLayer, scrim, sheetRise, transition, type CascadeOptions, type TransitionOptions } from './variants';
export { MotionProvider } from './MotionProvider';
export { Shared, type SharedProps } from './Shared';
export { sharedMatch, sharedMatchGroup, sharedPlayer, sharedPlayerGroup, type MatchPart, type SharedEnd } from './sharedIds';
export { flightCount, fly, isFlying, landAll, restingBox, type FlightRequest } from './flight';
export * from './moments';

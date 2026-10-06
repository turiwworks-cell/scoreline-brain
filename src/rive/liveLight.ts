/*
 * How far the capsule is open (0 Live off, 1 on) through the art's two timelines, read from the
 * export's state machine every frame from the moment `islive` changes. Opening, the capsule first
 * gathers itself (closes a little), opens past its mark and settles back; closing, it first swells,
 * closes past its mark and settles. When the art first draws, Rive plays the timeline of the state
 * it starts in. The hover light follows these, so its rim stays on the capsule's; re-measure them
 * when the art's timing changes (verification/rive/live-light.spec.ts prints them).
 */
type Track = readonly (readonly [ms: number, open: number])[];
export const LIVE_OPENING: Track = [
  [0, 0], [17, -0.0263], [33, -0.0373], [83, -0.0537], [133, -0.0603], [183, -0.0614], [200, -0.049],
  [217, -0.0208], [233, 0.0293], [267, 0.2168], [283, 0.3575], [317, 0.6738], [333, 0.806], [350, 0.9079],
  [367, 0.9803], [383, 1.0307], [400, 1.0604], [417, 1.0757], [433, 1.0789], [450, 1.0757], [483, 1.0636],
  [567, 1.0175], [600, 1.0055], [633, 1],
];
export const LIVE_CLOSING: Track = [
  [0, 1], [50, 1.0077], [183, 1.0735], [217, 1.0789], [233, 1.0746], [250, 1.0636], [267, 1.0428],
  [283, 1.0132], [300, 0.9715], [333, 0.8454], [367, 0.6522], [400, 0.4134], [433, 0.1996], [467, 0.0538],
  [500, -0.0263], [517, -0.0471], [533, -0.0592], [583, -0.0592], [633, -0.0449], [717, -0.011], [783, 0],
];

/** How long the art's timeline into `live` runs, in ms. */
export const liveTimelineMs = (live: boolean) => (live ? LIVE_OPENING : LIVE_CLOSING).at(-1)![0];

/** The hover light through one timeline: --open, how far the capsule is open (Header.module.css .liveLight). */
export function liveLightMotion(live: boolean): { keyframes: Keyframe[]; duration: number } {
  const track = live ? LIVE_OPENING : LIVE_CLOSING;
  const duration = liveTimelineMs(live);
  return { keyframes: track.map(([ms, open]) => ({ offset: ms / duration, '--open': String(open) })), duration };
}

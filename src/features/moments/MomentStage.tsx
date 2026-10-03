import { lazy, Suspense, useEffect } from 'react';
import { afterPaint } from '../../rive/afterPaint';
import { useReducedMotion } from 'motion/react';
import { appMoments, useMomentStage, type MomentDirector } from '../../motion';
import { useScoreline } from '../../store';
import { playerPhoto, usePhotoManifest } from '../../ui';
import { momentInfo } from './model';
import { Toast } from './Toast';

const loadScene = () => import('./Scene');
const Scene = lazy(() => loadScene().then((module) => ({ default: module.Scene })));

export type StageSlot = 'all' | 'scene' | 'toast';

export type MomentStageProps = {
  /**
   * What this mount shows. The phone shows everything over the whole screen; the tablet shows
   * everything in the match pane; the desktop plays scenes in the match pane and toasts in the third
   * pane (drawDesktop, luau:7051-7083).
   */
  slot: StageSlot;
  /** a tap on a toast opens its match */
  onOpenMatch: (matchId: number) => void;
  /** is this the player you follow (the star by his name) */
  isFollowed: (team: string, n: number) => boolean;
  /** the director to render (tests); the app's by default */
  director?: MomentDirector;
  /** reduced motion (tests); the user's setting by default */
  reducedMotion?: boolean;
};

/**
 * Renders what the MomentDirector has on its stage (Part 17's contract): the scene, the toast or
 * the summary, keyed by the presentation so each showing mounts fresh. Exits are played from
 * `phase: 'out'`; when the stage empties or moves on, the element goes.
 */
export function MomentStage({ slot, onOpenMatch, isFollowed, director, reducedMotion }: MomentStageProps) {
  // Warm the Rive-aware scene after paint, outside the initial dependency graph.
  useEffect(() => afterPaint(() => { void loadScene().catch(() => {}); }), []);
  const d = director ?? appMoments();
  const p = useMomentStage(d);
  const prefers = useReducedMotion() ?? false;
  const reduced = reducedMotion ?? prefers;
  const domain = useScoreline((s) => s.domain);
  const { manifest } = usePhotoManifest();
  if (!p) return null;
  const scene = p.kind === 'scene';
  if ((slot === 'scene' && !scene) || (slot === 'toast' && scene)) return null;
  const info = momentInfo(domain, p.moment);
  const photo = info && info.n > 0 ? playerPhoto(manifest, info.team.id, info.n) : undefined;
  const followed = !!info && info.n > 0 && isFollowed(info.team.id, info.n);
  if (scene) return info && p.beats ? <Suspense fallback={null}><Scene key={p.key} p={p} info={info} d={d} photo={photo} followed={followed} /></Suspense> : null;
  return <Toast key={p.key} p={p} info={info} d={d} reduced={reduced} photo={photo} followed={followed} onOpen={onOpenMatch} />;
}

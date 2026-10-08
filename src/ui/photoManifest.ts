import { useEffect, useSyncExternalStore } from 'react';
import { PHOTO_ROOT, photoSources, warmPhoto, type FaceFrame, type PhotoKind, type PhotoSources } from './photos';

/*
 * Which players have a photo: public/img/players/manifest.json (Part 8), read once for the whole
 * app. The first screen that asks starts the request, every later one shares its answer, and a
 * team the manifest doesn't know keeps the kit disc. One request in all, never one per player.
 *
 * Players are keyed by app id (`fra:10`); the coaches sit under `coaches.<team>` and have no shirt.
 */

export interface PhotoManifest {
  /** `<team>:<n>` → the file path stem, `<team>/<n>` */
  readonly players: Readonly<Record<string, string>>;
  /** team id → the coach's file path stem, `<team>/0` */
  readonly coaches: Readonly<Record<string, string>>;
  /** file path stem → where the head is on that bust, for the ones the manifest measured */
  readonly faces?: Readonly<Record<string, FaceFrame>>;
}

export type PhotoManifestState = { readonly status: 'idle' | 'loading' | 'failed'; readonly manifest: null } | { readonly status: 'ready'; readonly manifest: PhotoManifest };

const EMPTY: PhotoManifest = { players: {}, coaches: {}, faces: {} };

const stems = (entries: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  if (typeof entries !== 'object' || entries === null) return out;
  for (const [key, v] of Object.entries(entries)) {
    const path = (v as { path?: unknown } | null)?.path;
    if (typeof path === 'string' && path !== '') out[key] = path;
  }
  return out;
};

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const faceOf = (v: unknown): FaceFrame | undefined => {
  const f = (v as { face?: { top?: unknown; w?: unknown; cx?: unknown } } | null)?.face;
  const top = num(f?.top), w = num(f?.w), cx = num(f?.cx);
  return top !== undefined && w !== undefined && w > 0 && cx !== undefined ? { top, w, cx } : undefined;
};
const facesOf = (...groups: unknown[]): Record<string, FaceFrame> => {
  const out: Record<string, FaceFrame> = {};
  for (const g of groups) {
    if (typeof g !== 'object' || g === null) continue;
    for (const v of Object.values(g)) {
      const path = (v as { path?: unknown } | null)?.path;
      const face = faceOf(v);
      if (typeof path === 'string' && face) out[path] = face;
    }
  }
  return out;
};

/** The manifest as slice-atlas writes it, reduced to the paths and faces. Anything unexpected is left out. */
export function parsePhotoManifest(json: unknown): PhotoManifest {
  if (typeof json !== 'object' || json === null) return EMPTY;
  const j = json as { players?: unknown; coaches?: unknown };
  return { players: stems(j.players), coaches: stems(j.coaches), faces: facesOf(j.players, j.coaches) };
}

const IDLE: PhotoManifestState = { status: 'idle', manifest: null };
let state: PhotoManifestState = IDLE;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: PhotoManifestState) {
  state = next;
  for (const l of [...listeners]) l();
}

/** Starts the one request (a no-op while it runs or once it has answered). A failed one may be asked again. */
export function loadPhotoManifest(): Promise<void> {
  if (state.status === 'ready') return Promise.resolve();
  if (inflight) return inflight;
  if (typeof fetch === 'undefined') {
    set({ status: 'failed', manifest: null });
    return Promise.resolve();
  }
  set({ status: 'loading', manifest: null });
  inflight = fetch(`${PHOTO_ROOT}/manifest.json`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((json: unknown) => set({ status: 'ready', manifest: parsePhotoManifest(json) }))
    .catch(() => set({ status: 'failed', manifest: null }))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Tests, and a host that already has the manifest. `null` forgets it. */
export function setPhotoManifest(manifest: PhotoManifest | null) {
  set(manifest ? { status: 'ready', manifest } : IDLE);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const snapshot = () => state;

/**
 * The manifest's state. Calling it asks for the manifest, so only screens that show photos pay
 * for the request; the state object changes only when the answer arrives.
 */
export function usePhotoManifest(): PhotoManifestState {
  const s = useSyncExternalStore(subscribe, snapshot, snapshot);
  // asked once when the screen mounts: a failure is tried again by the next screen, not in a loop
  useEffect(() => {
    if (state.status === 'idle' || state.status === 'failed') void loadPhotoManifest();
  }, []);
  return s;
}

// one object per file path, so memoised photos aren't handed a new set of sources every render
const sources = new Map<string, PhotoSources>();
const sourcesOf = (path: string, kind: PhotoKind = 'bust', face?: FaceFrame): PhotoSources => {
  const key = `${kind}:${path}:${face ? `${face.top},${face.w},${face.cx}` : ''}`;
  let s = sources.get(key);
  if (!s) sources.set(key, (s = photoSources(path, kind, face)));
  return s;
};

/** A player's photo files, or undefined when the manifest has none (the kit disc stands in). */
export function playerPhoto(manifest: PhotoManifest | null, team: string, n: number): PhotoSources | undefined {
  const path = manifest?.players[`${team}:${n}`];
  return path ? sourcesOf(path, 'bust', manifest?.faces?.[path]) : undefined;
}

/** Warm only the selected profile, alongside its lazy screen download. */
export function warmPlayerPhoto(team: string, n: number, sizes: string): void {
  void loadPhotoManifest().then(() => {
    const photo = playerPhoto(state.manifest, team, n);
    if (photo) warmPhoto(photo, sizes);
  });
}

/** The same player's frosted bust (the pre-blurred picture seen through glass), or undefined. */
export function frostPhoto(manifest: PhotoManifest | null, team: string, n: number): PhotoSources | undefined {
  const path = manifest?.players[`${team}:${n}`];
  return path ? sourcesOf(path, 'frost') : undefined;
}

/** A coach's photo files, or undefined. */
export function coachPhoto(manifest: PhotoManifest | null, team: string): PhotoSources | undefined {
  const path = manifest?.coaches[team];
  return path ? sourcesOf(path, 'bust', manifest?.faces?.[path]) : undefined;
}

/** The props `PlayerPhoto` takes for a player's files (nothing for no photo). */
export function photoProps(files: PhotoSources | undefined): { src?: string; srcSet?: string; sources?: PhotoSources['sources']; face?: FaceFrame } {
  return files ? { src: files.src, srcSet: files.srcSet, sources: files.sources, ...(files.face ? { face: files.face } : {}) } : {};
}

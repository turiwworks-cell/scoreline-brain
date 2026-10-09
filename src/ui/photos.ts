/*
 * Player photo URLs: the files scripts/slice-atlas.ts cuts from the squad atlases (Part 8),
 * at public/img/players/<team>/<n>-<kind>@<1|2>x.<avif|webp> (ARCHITECTURE §8).
 *
 * Each kind comes at two widths, described in `w` so the browser takes the smallest file that
 * covers the box at the screen's density. AVIF first, WebP for browsers without it.
 */

export type PhotoKind = 'bust' | 'head' | 'frost';

export const PHOTO_ROOT = `${import.meta.env.BASE_URL}img/players`;

/**
 * Pixel sizes of each kind's files. @2x is the atlas's own pixels (2 per design unit,
 * ATLAS.k, luau:1469), @1x half that. The bust is 288 × 360 design units; the head cut-out
 * covers CROP.head (180 units) in 224 px; the frost is the bust at a quarter, pre-blurred.
 */
export const PHOTO_SIZES: Readonly<Record<PhotoKind, { readonly 1: readonly [number, number]; readonly 2: readonly [number, number] }>> = {
  bust: { 1: [288, 360], 2: [576, 720] },
  head: { 1: [112, 112], 2: [224, 224] },
  frost: { 1: [72, 90], 2: [144, 180] },
};

/**
 * Where a player's head is on his bust, in design units (measured by scripts/slice-atlas.ts):
 * the top of his hair, his head's width and its centre. The squads were framed differently, so
 * faces are cut from these rather than from one fixed crop (PlayerPhoto).
 */
export interface FaceFrame {
  readonly top: number;
  readonly w: number;
  readonly cx: number;
}

export interface PhotoSources {
  /** WebP @1x, for `<img src>` */
  readonly src: string;
  /** WebP at both widths */
  readonly srcSet: string;
  /** AVIF at both widths, for a `<source>` ahead of the `<img>` */
  readonly sources: readonly { readonly type: string; readonly srcSet: string }[];
  /** where his head is on the bust, when the manifest measured it */
  readonly face?: FaceFrame;
}

/** `path` is a manifest entry's `path` (`<team>/<n>`). */
export function photoSources(path: string, kind: PhotoKind = 'bust', face?: FaceFrame): PhotoSources {
  const url = (scale: 1 | 2, format: 'avif' | 'webp') => `${PHOTO_ROOT}/${path}-${kind}@${scale}x.${format}`;
  const set = (format: 'avif' | 'webp') => `${url(1, format)} ${PHOTO_SIZES[kind][1][0]}w, ${url(2, format)} ${PHOTO_SIZES[kind][2][0]}w`;
  return { src: url(1, 'webp'), srcSet: set('webp'), sources: [{ type: 'image/avif', srcSet: set('avif') }], ...(face ? { face } : {}) };
}

/**
 * Starts loading the file a `<picture>` of `photo` shown at `sizes` would choose (the AVIF where the
 * browser takes it, the WebP otherwise, at the screen's density) before that picture is on the page,
 * by building the same picture off the page. The request is the picture's own, so it is not repeated.
 */
export function warmPhoto(photo: PhotoSources, sizes: string): void {
  if (typeof document === 'undefined') return;
  const picture = document.createElement('picture');
  for (const s of photo.sources) {
    const source = document.createElement('source');
    source.type = s.type;
    source.sizes = sizes;
    source.srcset = s.srcSet;
    picture.append(source);
  }
  const img = document.createElement('img');
  img.decoding = 'async';
  img.fetchPriority = 'high';
  img.alt = '';
  img.sizes = sizes;
  img.srcset = photo.srcSet;
  picture.append(img);
  img.src = photo.src;
}

